# Proof log — Hostinger-critical hardening (2026-07-18)

## Verdict: PARTIAL PASS (implementation complete; full E2E blocked by environment)

### Retest 2026-07-18 21:28 IST
| Check | Result |
|-------|--------|
| Hostinger API state | still `running` |
| HTTPS `/health` | still **000** (12s timeout) |
| SSH :22 / :80 / :443 / :4000 / :4001 | all **closed/unreachable** |
| Local Docker Desktop | **not installed / not found** |
| FE `NEXT_PUBLIC_USE_MOCKS` | `false` |
| Offline suite | **21/21 PASS** (permissions, pdf validators, PDFKit, SSE diag, ops auth gate, routes) |
| Local cold/warm inject timings | see table below |

**Local inject timings (auth middleware path; unauthenticated → 401 except /health):**

| Route | Cold | Warm |
|-------|------|------|
| `GET /health` | 8.99 ms (200) | 0.14 ms (200) |
| `GET /ops/logs` | 0.39 ms (401) | 0.16 ms (401) |
| `GET /ops/process` | 0.21 ms (401) | 0.16 ms (401) |
| `POST /export/employees` | 0.36 ms (401) | 0.23 ms (401) |
| `GET /settings/roles-permissions` | 0.22 ms (401) | 0.15 ms (401) |
| `GET /notifications/stream` | 0.24 ms (401) | 0.14 ms (401) |
| PDFKit sample generate | 37.9 ms (1477 bytes) | — |
| `createApp()` cold | 243.2 ms | — |
| Process RSS during retest | 313 MB | — |

### Safety locks held
- No git commit / push
- No Render deploys, env changes, or API calls to `onrender.com`
- No rentocloud touch
- No Hostinger migrate / restart / compose (SSH unreachable; API reports VM `running`)

### Phase 0 — Hostinger discovery
| Check | Result |
|-------|--------|
| Hostinger API `GET /vps/v1/virtual-machines/1067327` | `state=running`, hostname `srv1067327.hstgr.cloud`, IP `31.97.186.223`, plan KVM 2 / 8GB |
| SSH `root@31.97.186.223` (key `hostinger_ems_ed25519` / comment `claude-ems-deploy-mohdsaeedafri`) | **FAIL** — connect timeout / no route to host |
| HTTPS `https://ems-api.saqibsaeed.cloud/health` | **FAIL** — HTTP 000 from this network (`103.211.52.16`) |
| Firewall group | none attached |
| Local `.env` `DATABASE_URL` | Still points at **Render** — not used for this work |

**Implication:** Cannot tunnel Hostinger DB, cannot Docker-inspect EMS containers, cannot live E2E against Hostinger from this agent host until network/firewall is fixed.

### Phase 1 — Code delivered (local workspace)

| Area | Evidence |
|------|----------|
| Export PDF + Cloudinary + download fix | `src/jobs/exportJob.js`, `export.controller.js`, `export.validator.js`, `export.routes.js`; `pdfkit` dependency |
| Permissions defaults + JWT resolve + seed-once | `auth.policy.js` `DEFAULT_PERMISSIONS_BY_ROLE` + `hasPermission` fallback; `auth.service.js` `resolvePermissions` in login/refresh; `ensureTenantRolePermissionDefaults`; settings GET seeds once |
| `requirePermission` on export + employee mutate | `export.routes.js`, `employees.routes.js` |
| Ops logs page | `GET /ops/logs`, `GET /ops/process` in `src/modules/ops/ops.routes.js` (registered in `app.js`); process ring buffer in `processMonitor.js` |
| SSE diagnostics + cookie auth | `sseClients.js` counters; notifications stream accepts cookie |
| FE SSE (MSW off) | Frontend pulled (already up to date); `NEXT_PUBLIC_USE_MOCKS=false`; `useNotificationStream.ts` + streaming BFF `api/notifications/stream/route.ts` |
| Docs | `docs/API_MAPPING.md`, `docs/UI_CONTRACT_server_exports_permissions_realtime_logs.md`, swagger export blurb |

### Offline verification (no DB)

```
roles SUPER_ADMIN,HR_ADMIN,MANAGER,EMPLOYEE,AUDITOR
HR has export true
EMP no export false
EMP with empty explicit denied export false
SA bypass true
pdf_bytes 1282
ops_route true
UNIT_SMOKE_OK
```

App `createApp()` + `ready()` succeeds; `/ops/logs` route present.

### Blocked — regression / E2E / cold-warm timings
| Item | Why blocked |
|------|-------------|
| `docker compose` local Postgres | Docker CLI not available in this environment |
| `npm run test:smoke` against `ems_test` | Needs local Postgres; bare run would inherit Render `.env` (blocked by data-loss-guard) |
| Hostinger SSH tunnel + live API timings | VPS unreachable from this network |
| UI E2E against live Hostinger | Same |
| Cold/warm timing table (live) | Same |

### Cold/warm timing table (live) — NOT MEASURED
| Endpoint | Cold | Warm |
|----------|------|------|
| `POST /export/employees` csv/excel/pdf | n/a | n/a |
| `GET /settings/roles-permissions` | n/a | n/a |
| `GET /ops/logs` | n/a | n/a |
| SSE leave→bell latency | n/a | n/a |

Offline PDF generate only: ~PDFKit write **1282 bytes** for smoke doc (not a full export benchmark).

### What you need to unblock full PASS
1. Restore network path to `31.97.186.223` (Hostinger firewall / provider routing) **or** run the agent on a machine that can SSH
2. Start local Docker Desktop and re-run migrate+smoke against `127.0.0.1/ems_test` with explicit `DATABASE_URL`
3. Deploy backend to Hostinger (your GitHub Action) when ready — **not done here**
4. Re-run UI+BE E2E with MSW off and fill the timing table

### No commit
Per instructions — changes remain local/uncommitted.
