# Redis + BullMQ Deep Stress

> Target: `http://localhost:4000` · Redis `redis://127.0.0.1:16379` · tenant `acme-corp-001`  
> Tester login: `hr@acme.test` · Generated **2026-08-03T03:39:57.880Z**  
> Constraints: no Render · no migrate · no git commit · Hostinger Redis tunnel only (not killed)

## Verdict

**PASS (read-only payroll path)** — Redis enabled + reachable; cache set/get/del-by-prefix stable under 100 parallel ops; BullMQ queue `payroll-calculate` healthy (`completed=52`, `failed=0`, no waiting/active); hot-config `cache:tenantcfg:*` + statutory `cache:statpacks:*` present. Calculate **not** triggered (no DRAFT/CALCULATING; mutate would recompute Hostinger payroll).

---

## 1) `redisEnabled` confirmation

```bash
node --env-file=.env --input-type=module -e \
  "import { redisEnabled, getRedis } from './src/lib/redis.js';
   const r = getRedis(); console.log({ redisEnabled, url: process.env.REDIS_URL, ping: await r.ping() });"
```

| Check | Result |
|-------|--------|
| `redisEnabled` | `true` |
| `REDIS_URL` | `redis://127.0.0.1:16379` |
| `PING` | `PONG` |

Source: `src/lib/redis.js` — `export const redisEnabled = !!REDIS_URL`.

---

## 2) Cache stress — `cacheGet` / `cacheSet` / `cacheDelByPrefix`

Prefix: `stress:redis-bullmq:<ts>:` · **100** parallel set→get pairs · TTL 120s · then `cacheDelByPrefix`.

| Metric | Value |
|--------|------:|
| Ops (parallel keys) | 100 |
| set→get hits | **100 / 100** |
| Misses | 0 |
| Wall clock | **151 ms** |
| Avg / key | **1.51 ms** |
| Leftovers after `cacheDelByPrefix` (sample 20) | **0** |
| Exact `cacheDel` | OK |

**OK:** wrappers never threw; JSON round-trip intact; prefix SCAN delete cleared stress keys.

---

## 3) Payroll + BullMQ (prefer inspect over mutate)

### Caution

`POST /payroll/runs/:id/calculate` only accepts **DRAFT** and enqueues BullMQ job `calc-<runId>` (or sync-falls-back). That **mutates** run status / payslips on Hostinger.  
At probe time: **DRAFT=0**, **CALCULATING=0** → **calculate not triggered**. Evidence taken from existing queue history + read-only run listing.

### Queue `payroll-calculate`

| State | Count |
|-------|------:|
| waiting | 0 |
| active | 0 |
| delayed | 0 |
| failed | **0** |
| completed | **52** |
| `bull:*` key count (SCAN) | **57** |

### Newest completed jobs

| Job ID | Run ID | Duration | Finished (UTC) |
|--------|--------|----------|----------------|
| `calc-cmsbwp4gy002112xqipqgzuf1` | `cmsbwp4gy002112xqipqgzuf1` | 189 ms | 2026-08-02T14:39:23.976Z |
| `calc-cmrgtrca3001a5ij3hbkuvocm` | `cmrgtrca3001a5ij3hbkuvocm` | 142 ms | 2026-07-11T20:36:16.993Z |
| `calc-cmr4bzb1a0020grln6910vymg` | `cmr4bzb1a0020grln6910vymg` | 120 ms | 2026-07-03T02:45:21.226Z |

Job payload shape: `{ runId, tenantId }` · `attemptsMade: 1` · `failedReason: null`.

### HR API listing (`hr@acme.test`)

| Filter | HTTP | Count | Notes |
|--------|------|------:|-------|
| `status=DRAFT` | 200 | 0 | No safe calculate target |
| `status=CALCULATING` | 200 | 0 | No in-flight job |
| `status=REVIEW` | 200 | 2 | Includes `cmsbwp4gy002112xqipqgzuf1` (matches newest completed Bull job) |
| (unfiltered page) | 200 | 20 | Mostly CANCELLED recent periods |

### Route existence probe (safe)

`POST /payroll/runs/does-not-exist-stress/calculate` → **404** `NOT_FOUND` ("Payroll run not found") — route wired; no enqueue.

### Code path (reference)

- Enqueue: `src/lib/payrollQueue.js` → `enqueueCalculate` / Worker concurrency 2 / jobId `calc-${runId}`
- Service: `src/modules/payroll/payroll.service.js` `calculatePayrollRun` → queue when Redis up, else sync `repo.calculatePayrollRun`
- Worker started from `src/server.js` via `startPayrollWorker()`

---

## 4) Redis briefly unreachable (wrong-port child — Hostinger Redis **not** killed)

Child process with `REDIS_URL=redis://127.0.0.1:19999` (nothing listening):

| API | Behavior |
|-----|----------|
| `cacheSet` | **resolved, no throw** (swallowed) |
| `cacheGet` | **resolved `null`, no throw** |
| `cacheDelByPrefix` | **resolved, no throw** |
| `enqueueCalculate` | **did not resolve within 3s** (timed out in probe); client logged `ECONNREFUSED` |
| Wrappers never threw | **true** |

Raw ioredis (offline queue off) against `:19999` throws immediately (`Stream isn't writeable…` / `ECONNREFUSED`).

**Note / gap:** cache helpers degrade cleanly (return null / no-op). `enqueueCalculate` relies on BullMQ connection — when Redis is down mid-flight it *should* catch and return `false` (sync fallback), but a cold connect to a refused port can **hang** before rejecting. Do not treat queue add as instant-fail under total Redis outage without a timeout at the call site.

Hostinger tunnel Redis on `:16379` was left running.

---

## 5) Hot-config cache paths (settings + payroll)

| Key / path | Evidence |
|------------|----------|
| `cache:tenantcfg:<tenantId>` | Present: `cache:tenantcfg:cmqjpydkv0000kpjdelztyg88` |
| Writer | `settings.service.js` `getTenantConfig` → `cacheGet` / `cacheSet(..., 300)`; invalidate via `cacheDel` on `updateTenantConfig` |
| `GET /settings/tenant` | 200 then 200 (latencies ~174 ms / ~184 ms — Hostinger DB still dominates; Redis hit not separately instrumented in response) |
| Cached fields (sample) | `legalName`, `displayName`, `company_name`, `timezone`, `working_hours_*`, `fiscal_year_start`, … |
| `cache:statpacks:<tenantId>:all` | Present — payroll `getStatutoryPacks` (`TTL 300`; invalidated by `cacheDelByPrefix` on pack mutate) |
| Direct lib round-trip | `cacheSet`/`cacheGet` probe on tenantcfg key → OK |

---

## Summary matrix

| Area | Result |
|------|--------|
| Redis enabled + PING | PASS |
| 100-key parallel cache | PASS (100/100, 151 ms) |
| Prefix delete | PASS |
| BullMQ queue health | PASS (52 completed, 0 failed, idle) |
| Live calculate enqueue | SKIPPED (no DRAFT; mutate caution) |
| Historical job complete | PASS (newest 189 ms) |
| Cache degrade (bad port) | PASS (never throw) |
| Enqueue degrade (bad port) | PARTIAL (hang risk before false/fallback) |
| Hot-config / statpack keys | PASS |

## Artifacts

- This file: `docs/e2e-ui-screenshots/stress/redis-bullmq/RESULTS.md`
- Contract append: `docs/E2E_STRESS_BACKEND_CONTRACT.md` → `## REDIS-BULLMQ`
