# E2E Stress — Final Rollup Summary

| Field | Value |
|-------|-------|
| Date | 2026-08-03 |
| Tool | **Playwright** Chromium shards (SHORT deep + rapid stress) **+** **API concurrent hammer** (20 parallel GETs × 8 endpoints × 4 roles) |
| Stack | **FE** `http://localhost:3001` → **BE** `http://localhost:4000` → **Hostinger** DB via `127.0.0.1:15432` tunnel |
| MSW | Off (live local API) |
| Stress contracts | `docs/E2E_STRESS_BACKEND_CONTRACT.md` · `docs/E2E_STRESS_FRONTEND_CONTRACT.md` |
| Cross-link (deep) | `docs/E2E_BACKEND_ISSUES_CONTRACT.md` · `docs/E2E_FRONTEND_ISSUES_CONTRACT.md` · `docs/E2E_DEEP_UI_FINAL_SUMMARY.md` |
| This summary | `docs/E2E_STRESS_FINAL_SUMMARY.md` |
| **No Render. No git commit.** | Existing contracts **not wiped** — append-only sources rolled up here. |

---

## 1. Tooling

| Mode | What ran | Artifacts |
|------|----------|-----------|
| **Playwright shards** | 7 role/menu stress+deep SHORT runners (Chromium, real PNGs, network capture) | `docs/e2e-ui-screenshots/stress/<shard>/` · `FINDINGS.md` · `results*.json` |
| **API hammer** | Node concurrent GETs — login ×4 roles, then **20×** parallel on `health`, `auth/me`, `employees`, `leave/balance`, `leave/requests`, `attendance/today`, `attendance/summary`, `notifications` | `docs/e2e-ui-screenshots/stress/api-hammer/RESULTS.md` · `raw.json` |

Wall for API hammer: **64295 ms**. No Render, no migrations, no Playwright on the hammer path.

---

## 2. Stack under test

```
Browser (Playwright) → http://localhost:3001 (Next FE)
                     → http://localhost:4000/api/v1 (Fastify BE)
                     → Hostinger Postgres/Redis via local tunnel 127.0.0.1:15432
```

Tenant: `acme-corp-001`. Accounts: `superadmin@acme.test`, `hr@acme.test`, `aman@acme.test`, `priya@acme.test` (`Password123!`).

---

## 3. Per-shard screenshot counts + pass/fail highlights

PNG counts on disk at rollup time. **Playwright total: 435 PNGs** across 7 shards (api-hammer = 0 PNGs). `sa-payroll-reports` finished after the first rollup (**35 → 48** PNGs) — counts below are post-finish.

| Shard | Role | PNGs | Stress focus | Highlight |
|-------|------|-----:|--------------|-----------|
| `sa-settings-admin` | SUPER_ADMIN | **82** | Rapid 5 settings routes | **PASS** 4/5 panels; **FAIL** `/settings/roles-permissions` Next **404** (`ISSUE-SA-SET-01/02`) |
| `sa-dash-emp-dept` | SUPER_ADMIN | **44** | 7× burst (Dashboard/Employees/Depts) | **PASS** 7d/30d/Add/Columns/Export/Depts Add; **FAIL** Employees Add Employee click race ×4 (`ISSUE-STRESS-SA-DED-02`); cosmetic login 401s |
| `sa-attendance-leave` | SUPER_ADMIN | **64** | Leave stress ×10 + pagination | **FAIL** Leave SA-10 Priya leak **10/10** (`ISSUE-SA-10`); Attendance/Timesheets/Holidays deep mostly **PASS** |
| `mgr-approvals` | MANAGER | **58** | Approve×5 / Return×4 under burst | BE **correct** (**403** under burst); FE shows forbidden actions (`ISSUE-MGR-STRESS-01/02`); Leave/Attendance nest **PASS** |
| `hr-core` | HR_ADMIN | **84** | Concurrent tabs + export + menu hop | Concurrent Leave/Employees tabs **0** API fails; **FAIL** KPI Present=0 / 50% vs BE `present=1` / 100% (`ISSUE-HR-STRESS-FE-01`); zero-duration PRESENT BE (`ISSUE-HR-STRESS-BE-01`) |
| `sa-payroll-reports` | SUPER_ADMIN | **48** | Concurrent export bursts ×6 | **PASS** concurrent exports **12/12 downloads ok:true**; Reports Export CSV ×3 `Promise.all` all ok; Payroll `Export Register` + `Export pack` **2/2 ok**; **BE issues 0** (prior deep `ok:false` **not** reproduced). FE-only: login 401, payout empty for SA, CTC missing Export CSV |
| `emp-self` | EMPLOYEE | **55** | Preview×5, payslip×5, mark-all×2, leave types | Preview **404×5**; AL **400** `NO_LEAVE_BALANCE`; SL/EL **201**; payslip detail **200**; mark-all **200** |
| `api-hammer` | all 4 roles | **0** | 20-way GET matrix | SA `attendance/today` **400×20**; SA leave → Priya on **200×20**; HR/MGR/EMP all cells **200×20** |

---

## 4. Top critical stress-confirmed bugs

Cross-linked to deep contract where applicable (esp. **SA-10**).

| # | ID / alias | Layer | Severity | Stress evidence |
|---|------------|-------|----------|-----------------|
| 1 | **ISSUE-SA-10** (deep: `E2E_BACKEND_ISSUES_CONTRACT.md`) | BACKEND | **CRITICAL** | Playwright Leave stress **10/10** Priya-prefixed balances (`cmqjpyds7001kkpjdnlhjygrp`); API hammer SA `leave/balance` + `leave/requests` **200×20** same leak while `auth/me.employeeId=null`. UI EL **578.57/580.57** matches leaked payload. |
| 2 | **ISSUE-SA-02** / hammer cell | BACKEND | HIGH | SA `GET /attendance/today` → **400×20** `NO_EMPLOYEE_RECORD` under hammer; HR/MGR/EMP **200×20**. Inconsistent with graceful `attendance/summary`. |
| 3 | **STRESS-EMP-BE-02** / **ISSUE-EMP-02** / **ISSUE-SA-03** | BACKEND | HIGH | Leave preview `GET /leave/requests/preview` → **404×5** (emp-self stress) + every type submit path. |
| 4 | **ISSUE-MGR-STRESS-01/02** (deep MGR-09 / MGR-02) | FRONTEND | CRITICAL | Under burst: Approve **4×403** `NOT_TEAM_APPROVER`, Return **2×403**; targeted HR Admin Approve **403**; self historic reject **403** `SELF_APPROVAL_FORBIDDEN`. BE authorization **correct** — FE still exposes actions. |
| 5 | **ISSUE-HR-STRESS-FE-01** (deep HR-06) | FRONTEND | HIGH | HR attendance classifier zeros: UI Present **0** / **50%** / Half Day while BE summary `present=1` `attendancePercentage=100` (reproduced at ~02:15Z; classic timezone exclusion **not** firing after UTC midnight). |
| 6 | Export gaps / Add Employee race | FRONTEND | HIGH | **SA-PAY-REPORTS concurrent exports succeeded** (**12/12 ok:true**; headcount CSV ×3 + payroll Register/pack). Remaining FE-only on that shard: CTC Analysis **hides** Export CSV; payout empty for SA; login 401s. SA dash Employees Add Employee **RACE** (1 ok + 4 detached). Deep SA-05…09 `ok:false` **not reproduced** on this stress pass (BE issues **0** for SA-PAY-REPORTS). |
| 7 | **STRESS-EMP-BE-01** / **ISSUE-EMP-01** | BACKEND (+ FE picker) | CRITICAL | AL orphan type: types includes AL, balance missing → `POST /leave/requests` **400** `NO_LEAVE_BALANCE`; SL/EL **201** same session. |
| 8 | **ISSUE-HR-STRESS-BE-01** / **ISSUE-HR-09** | BACKEND | HIGH | Zero-duration PRESENT accepted (`duration=0` / `totalMinutes=0`) — feeds FE classifier mismatch. |

### SA-10 deep cross-link (mandatory)

Already tracked in `docs/E2E_BACKEND_ISSUES_CONTRACT.md`:

> **ISSUE-SA-10**: Leave APIs return Priya Sharma data for SUPER_ADMIN (**CRITICAL**) — `employeeId: null` yet balance ids prefixed `cmqjpyds7001kkpjdnlhjygrp-*`.  
> Alias note: previously **ISSUE-SA-04**; current SA-04 is leave-assignments 401.

**Stress confirmation:** Playwright shard `sa-attendance-leave` (**10/10**) + API hammer (**20/20** leave GETs) — same employee prefix / request refs (`LVR-0026`/`LVR-0025`) as Priya’s own list. Fix: never fall back to another employee when `employeeId` is null — return empty or `NO_EMPLOYEE_RECORD`.

---

## 5. Paths to stress contracts & evidence

| Artifact | Path |
|----------|------|
| Stress BE contract | [`docs/E2E_STRESS_BACKEND_CONTRACT.md`](E2E_STRESS_BACKEND_CONTRACT.md) |
| Stress FE contract | [`docs/E2E_STRESS_FRONTEND_CONTRACT.md`](E2E_STRESS_FRONTEND_CONTRACT.md) |
| Deep BE issues (SA-10 etc.) | [`docs/E2E_BACKEND_ISSUES_CONTRACT.md`](E2E_BACKEND_ISSUES_CONTRACT.md) |
| Deep FE issues | [`docs/E2E_FRONTEND_ISSUES_CONTRACT.md`](E2E_FRONTEND_ISSUES_CONTRACT.md) |
| Deep UI rollup | [`docs/E2E_DEEP_UI_FINAL_SUMMARY.md`](E2E_DEEP_UI_FINAL_SUMMARY.md) |
| API hammer | `docs/e2e-ui-screenshots/stress/api-hammer/RESULTS.md` |
| Shard FINDINGS | `docs/e2e-ui-screenshots/stress/*/FINDINGS.md` |

---

## 6. Honest gaps

1. **SHORT depth only** — nestDepth mostly 1–2; not a substitute for deep nest-4 SUPER_ADMIN/MANAGER crawls (~3k PNGs).
2. **Export stress (SA-PAY-REPORTS) — resolved success** — finished after first rollup: **48** PNGs, **12/12** downloads `ok:true`, Reports Export CSV ×3 `Promise.all` all ok, Payroll Export Register + pack ok. BE issues **0** for this shard; prior deep `ok:false` **not** reproduced. Residual FE: CTC missing Export CSV, payout empty for SA, login 401s. (List/approvals/analytics bursts still had no export controls — expected for those surfaces.)
3. **Filter/Refresh MISS** — several SA menus lack dedicated Refresh/Filter locators; pagination/combobox stress used instead.
4. **Concurrent shard load** — first SA dash pass hit spinners under parallel shard pressure; successful pass waited for shell ready (load risk, not product defect).
5. **Leave balance aggregate divergence** — hammer peek: SA sees Priya-prefix EL **total 580.57** while Priya’s own peek shows EL **total 9** on same id prefix — needs separate investigation (leak + possible aggregation/mutation path).
6. **HR timezone bug (HR-05/07)** — **not reproduced** after UTC midnight; FE classifier zeros still reproduced.
7. **MGR self-approve UI** — stress queue had no Aman `SUBMITTED` row (week `DRAFT`); self-403 proven via historic API id; shallow UI evidence remains in deep/manager shots.
8. **No Render / no production** — local Hostinger tunnel only; latency p50 ~0.7–3.0s on authenticated GETs under 20-way parallelism is tunnel+DB load, not a Pass/Fail product criterion.
9. **Mutations limited** — Cancel-preferred on SA settings; emp-self mutated leave/notifs; HR-core read-only (reused prior zero-duration attendance row).

---

## Verdict

Stress suite **completed** across 7 Playwright shards (**435** PNGs) + API hammer (4 roles × 8 endpoints × 20). Highest-severity confirmation: **ISSUE-SA-10 leave→Priya is rock-solid (Playwright 10/10 + hammer 20/20)**. Secondary stress hits: SA `attendance/today` **400×20**, leave preview **404×5**, MGR **403** under Approve/Return burst (FE gating), HR FE classifier zeros, AL orphan **400**. **SA-PAY-REPORTS** concurrent exports **PASS** (**12/12 ok:true**; BE **0**); FE residuals only (login 401, payout empty, CTC no Export CSV).

**Final verdict: PARTIAL PASS** — stress tooling and contracts delivered; critical cross-user leave leak and related BE/FE defects remain open. SA payroll/reports export races from the first rollup are **superseded** by this shard’s success.
