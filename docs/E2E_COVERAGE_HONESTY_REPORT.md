# E2E Coverage Honesty Report

| Field | Value |
|-------|-------|
| Date | 2026-08-03 |
| Purpose | Brutally honest answer: was *everything* tested? |
| Method | **Read-only** audit of existing summaries, contracts, and FINDINGS (no new Playwright clicks) |
| Sources | `E2E_DEEP_UI_FINAL_SUMMARY.md`, `E2E_STRESS_FINAL_SUMMARY.md`, deep + stress contracts, role/stress FINDINGS |
| Stack under test | Local FE `:3001` → BE `:4000` → Hostinger tunnel — **not Render / not production** |

---

## Bottom line

**No — every button / menu / submenu / component was not tested E2E.**

What *was* done is a large, role-scoped Playwright crawl (~**3,095** shallow+deep PNGs + **435** stress PNGs) that nested many primary surfaces, filed living contracts, and stress-confirmed several critical bugs. That is **broad coverage**, not **exhaustive every-control coverage**. Overall prior verdicts of **PARTIAL PASS** are correct.

---

## 1. Was EVERY button / menu / submenu / component tested E2E?

### Verdict: **NO**

### What the artifacts actually claim

| Pass | Evidence | Max nest | Honest ceiling |
|------|----------|---------:|----------------|
| Deep SUPER_ADMIN | `superadmin-deep/` **831** PNGs; menus **17**; controls **304**; depth **4** | 4 | Deep Settings/Reports/Payroll; **land-only** for Recruitment / Performance / Assets / Announcements |
| Deep MANAGER | `manager-deep/` **491** PNGs; n1–n4 nested shots **258**; tabs **98**; modals **78** | 4 | Pass-1 **crashed mid-Leave**; resume/phase3/spot filled gaps — not one clean full nest |
| Deep HR_ADMIN | `hr-admin-deep/` **511** PNGs; menus **17**; clicks **391**; nestDepth **2** | **2** | Shallower than SA/MGR; wizards only **4** steps; mutations **2** |
| Deep EMPLOYEE | `employee-deep/` **201** PNGs; menus **24**; buttons **72**; leave types **5** | nested layers **97** | Strong self-service; check-in/out **not re-mutated**; timesheet Log time **no POST** |
| Stress (7 shards) | **435** PNGs; nest mostly **1–2** | ≤2 | Explicitly **SHORT** — not a substitute for nest-4 deep |

Disk PNG totals (verified on disk at audit time): shallow+deep **3,095**; stress **435**.

### Concrete gaps (not “everything”)

1. **Land-only menus (SUPER_ADMIN deep)**  
   Recruitment / Performance / Assets / Announcements are land shots after a long Settings crawl (`superadmin-deep/FINDINGS.md` Coverage notes; deep summary Honest gaps #1). Not fully nested tabs/buttons/modals.

2. **Uneven nest depth**  
   - SA / MANAGER: max **4**  
   - HR: max **2**  
   - Stress: mostly **1–2**  
   Same product surface was **not** exercised to the same depth across roles.

3. **Destructive / committing mutations mostly skipped**  
   Documented Cancel-preferred / open-then-cancel patterns:
   - SA: Add Employee opened → **Cancel** (no create)  
   - SA settings stress: **Cancel-preferred**, no mutations  
   - HR stress: **read-only** (reused prior attendance row)  
   - Dashboard Approve/Deny often **MISS** (empty queues)  
   - Employee/Manager deep: check-in/out often **already done same day** — buttons absent, not re-proven  
   - Regularization create: dialogs nested; **no confirmed new reg create** (manager-deep)  
   - Timesheet Log time / Submit week: UI opened; **no POST** (Project required)

4. **Controls that stress explicitly marked MISS**  
   `sa-dash-emp-dept`: Dashboard Refresh; Employees Filter/Refresh; Departments Filter/Refresh — locators absent → stress skipped.

5. **Export controls missing on several surfaces** (cannot click what is not there)  
   - CTC Analysis: **no Export CSV**  
   - Analytics: **no export/download control**  
   - Payroll **list** and Payout **approvals**: no PDF/Excel/CSV toolbar (exports live on run detail)  
   See §3.

6. **Crash / resume / parallel-write noise**  
   - MANAGER deep pass-1 crash mid-Leave → multi-script resume  
   - SA disk **831** vs runner counter **372** (parallel Settings/Reports frames)  
   Coverage is real but **not a single deterministic full matrix**.

7. **No production verification**  
   Local Hostinger tunnel only. Contracts and summaries both state: **No Render. No git commit.**

### Fair positive (so this is not “almost nothing”)

- Four roles each had shallow + deep FINDINGS.  
- Employee nested **all 5 leave types** + withdraw.  
- HR deep claimed **all 15 REPORT_NAV types** + **28** settings sub-routes.  
- Manager nested Approvals mutations (direct-report approve OK; non-team 403).  
- SA nested Settings heavily + Reports/Payroll detail.  
- Stress + API hammer reconfirmed **SA-10**, attendance/today **400×20**, leave preview **404×5**, etc.

**Answer to “did you test every button?” → NO.** Broad nested crawl ≠ exhaustive component inventory.

---

## 2. Were issues reported properly?

### Verdict: **YES (with caveats)** — living contracts exist; counts are usable; some ID alias debt remains

### Deep contracts (primary issue ledger)

| Contract | Path | Role counts | Total |
|----------|------|-------------|------:|
| Backend | [`docs/E2E_BACKEND_ISSUES_CONTRACT.md`](./E2E_BACKEND_ISSUES_CONTRACT.md) | HR **3** · MGR **2** · EMP **2** · SA **4** | **11** |
| Frontend | [`docs/E2E_FRONTEND_ISSUES_CONTRACT.md`](./E2E_FRONTEND_ISSUES_CONTRACT.md) | HR **8** · MGR **13** · EMP **9** · SA **7** | **37** |

Deep rollup: [`docs/E2E_DEEP_UI_FINAL_SUMMARY.md`](./E2E_DEEP_UI_FINAL_SUMMARY.md) — matches these totals; ship blockers called out (SA-10, AL orphan, MGR Approvals gating, unfiltered sidebar). HR export confirm adds BOTH **ISSUE-HR-10**.

**Notable deep IDs:**  
- BE: `ISSUE-HR-07`, `HR-09`, `HR-10`, `MGR-01`, `MGR-03`, `EMP-01`, `EMP-02`, `SA-10`, `SA-02`, `SA-03`, `SA-04`  
- FE: `ISSUE-HR-01`…`06`/`08`/`10`, `MGR-02`/`03`/`04`/`05`/`06`/`07`/`08`/`09`/`10`/`11`/`12`/`13`/`14`, `EMP-02`…`10`, `SA-01`/`03`/`05`…`09`

### Stress contracts (append-only confirmations)

| Contract | Path | Role of artifact |
|----------|------|------------------|
| Stress BE | [`docs/E2E_STRESS_BACKEND_CONTRACT.md`](./E2E_STRESS_BACKEND_CONTRACT.md) | Hammer matrix + per-shard BE (SA-10 10/10, emp preview 404×5, HR zero-duration, SA-PAY BE **0**) |
| Stress FE | [`docs/E2E_STRESS_FRONTEND_CONTRACT.md`](./E2E_STRESS_FRONTEND_CONTRACT.md) | SET-01/02, DED race, MGR-STRESS-01/02/03, HR-STRESS-FE-01, SA-PAY-FE-01/02/03, EMP FE |
| Stress rollup | [`docs/E2E_STRESS_FINAL_SUMMARY.md`](./E2E_STRESS_FINAL_SUMMARY.md) | 7 shards + API hammer |

Per-shard FINDINGS (evidence roots):

| Shard | FINDINGS |
|-------|----------|
| `sa-settings-admin` | `docs/e2e-ui-screenshots/stress/sa-settings-admin/FINDINGS.md` |
| `sa-dash-emp-dept` | `…/sa-dash-emp-dept/FINDINGS.md` |
| `sa-attendance-leave` | `…/sa-attendance-leave/FINDINGS.md` |
| `sa-payroll-reports` | `…/sa-payroll-reports/FINDINGS.md` |
| `mgr-approvals` | `…/mgr-approvals/FINDINGS.md` |
| `hr-core` | `…/hr-core/FINDINGS.md` |
| `emp-self` | `…/emp-self/FINDINGS.md` |
| Role deep | `…/{superadmin,hr-admin,manager,employee}-deep/FINDINGS.md` |

### Reporting quality caveats (honest)

| Caveat | Evidence |
|--------|----------|
| **ID renumber / alias** | Leave→Priya was **SA-04**, now **SA-10**; current SA-04 = leave-assignments 401. Summaries document this; readers must not mix shallow vs deep IDs. |
| **FINDINGS vs live contract IDs** | Manager deep FINDINGS map differed for dept 403 (`ISSUE-MGR-09` in map vs BE `ISSUE-MGR-03` in contract). **Live contract IDs win** (deep summary Honest gaps #4). |
| **Duplicate / dual-listed items** | Leave preview listed BOTH (`SA-03` / `EMP-02`); correct for FE+BE but inflates “issue count” if summed naively. |
| **Deep export `ok:false` vs confirm `ok:true`** | Deep SA-05…09 still on FE contract (historical); stress SA-PAY-REPORTS **12/12** then **confirm/sa-exports 16/16 ok:true** — prior ok:false **not reproduced** for Employees/Payroll/Reports. **Assets CSV CONFLICT resolved 2026-08-03T03:42Z:** sa-exports ok:true vs GAP-03 ok:false → re-probe **0/3 ok:true** → **flaky** (Blob + immediate `revokeObjectURL`). Employees CSV still solid. Deep FE entries **not wiped** — marked SUPERSEDED except Assets. Invoices CSV still thin (nav false-positive on confirm). |
| **HR timezone BE** | Deep `ISSUE-HR-07` filed; stress said classic timezone exclusion **not reproduced** after UTC midnight; FE classifier zeros still reproduced. |

**Answer:** Issues were reported into the right contract paths with screenshot/network pointers. Reporting is **proper enough to drive fixes**, not a perfect deduped single source of truth.

---

## 3. CSV / PDF / Excel — what was proven?

### Confirm SA-EXPORTS (strongest positive — 2026-08-03)

Source: `docs/e2e-ui-screenshots/confirm/sa-exports/FINDINGS.md` + [`E2E_EXPORT_CONFIRM_MATRIX.md`](./E2E_EXPORT_CONFIRM_MATRIX.md) (`## SUPER_ADMIN`).

| Metric | Result |
|--------|--------|
| Download events | **16** (**ok:16 / false:0**) historical sa-exports |
| Working (solid) | Employees CSV, Payroll Register/pack, Reports CSV (+ concurrent ×3) |
| Assets CSV | **flaky** — sa-exports ok:true once; GAP-03 + re-probe ×3 ok:false; FE Blob race (`ISSUE-SA-GAP-03`) |
| Prior deep `ISSUE-SA-05…09` `ok:false` | **Not reproduced** for non-Assets surfaces |
| Absent toolbars | Attendance / Leave / Analytics / Payout / Audit (OpsLogs) |
| FE stub | Performance Export (`NO_EVENT`) |

### Stress SA-PAY-REPORTS (prior positive — still valid)

Source: `docs/e2e-ui-screenshots/stress/sa-payroll-reports/FINDINGS.md` + stress FE/BE contracts + `E2E_STRESS_FINAL_SUMMARY.md`.

| Metric | Result |
|--------|--------|
| Download events | **12** (**ok:12 / false:0**) |
| Concurrent Reports Export CSV ×3 (`Promise.all`) | **3/3 ok:true** — `202 POST /api/reports/export` → download **200** |
| Payroll run detail `Export Register` + `Export pack` | **2/2 ok:true** — `payroll-*.csv` + `audit-pack-*.json` |
| BE issues this shard | **0** |

Also sequential report CSVs recorded ok:true for headcount, turnover, attendance-summary, leave-utilization (plus repeated headcount concurrent).

### Proven formats vs marketing language

| Format | Proven ok:true? | Evidence |
|--------|-----------------|----------|
| **CSV** | **MOSTLY YES** — SA confirm **16/16** historical; Assets reclassified **flaky** after ×3 re-probe | Employees, Payroll Register, Reports CSVs solid; Assets inventory CSV **flaky** (GAP-03); concurrent ×3 reports solid |
| **JSON audit pack** | **YES** | `audit-pack-*.json` ok:true (confirm + stress) |
| **Excel (.xlsx)** | **NOT proven** | Confirm/stress download lists have **no `.xlsx`** |
| **PDF** | **BE yes / FE stub** | mgr-emp confirm: BE payslip PDF **200**; FE PayslipDrawer uses `window.print()` (no server PDF download from UI) |

### Remaining export / download gaps

| Gap | Status | Cite |
|-----|--------|------|
| **CTC Analysis — no Export CSV control** | Open FE | `ISSUE-SA-PAY-FE-03` / FINDINGS `SA-REPORTS-CTC-NO-EXPORT` · shot `038-reports-stress-ctc-formats.png` |
| **Analytics / Attendance / Leave / Payout / Audit — no export toolbar** | Absent on confirm | `E2E_EXPORT_CONFIRM_MATRIX.md` Absent table |
| **Performance Export** | FE stub `NO_EVENT` | confirm `020-performance-x-export.png` |
| **Assets inventory CSV** | **flaky** (final) | GAP-03 + `assets-export-reprobe/` ×3 ok:false vs sa-exports ok:true |
| **Deep SA-05…09 `ok:false`** | **SUPERSEDED** by confirm **16/16** for Employees/Payroll/Reports — Assets **not** solid | Deep FE contract + confirm matrix + re-probe |
| **Excel (.xlsx)** | Still **not proven** | No xlsx in confirm/stress ledgers |
| **Payslip PDF UX** | BE PDF **200**; FE uses `window.print()` | mgr-emp confirm |

### Honest export verdict

- **SA confirm CSV (+ audit JSON): historically 16/16 ok:true** — Employees/Payroll/Reports still solid. **Assets inventory CSV FINAL = flaky** (re-probe 0/3; GAP-03 retained).  
- **Excel: still not proven.**  
- **PDF: BE payslip PDF endpoint returns 200; FE print stub (`window.print`) — not a proven UI PDF download.**  
- **CTC / Performance / Assets race / absent toolbars remain FE gaps.**  
- Do **not** tell stakeholders “all CSV/PDF/Excel exports are green.”

---

## 4. Checklist — remaining untested or thin areas (for a new deep pass)

Use this as the next-pass backlog. Priority roughly severity × thinness.

### A. Explicit land-only / under-nested (must re-nest)

- [ ] SUPER_ADMIN **Recruitment** — full tabs, create/edit modals, row actions (beyond `*-land.png`)
- [ ] SUPER_ADMIN **Performance** — reviews/goals nested + console key fix verification
- [ ] SUPER_ADMIN **Assets** — inventory CRUD + fix Export CSV race (**flaky** / GAP-03; re-probe 0/3)
- [ ] SUPER_ADMIN **Announcements** — create/edit/publish (beyond land)
- [ ] HR_ADMIN raise nest depth **2 → 4** on Payroll run detail, Settings leave-policies, Reports export formats
- [ ] MANAGER single clean pass without crash/resume (especially Leave → Approvals → Comp-off)

### B. Destructive / committing flows never completed

- [ ] **Create Employee** end-to-end (not Cancel at wizard)
- [ ] **Delete / soft-delete** employee (or explicit refuse with RoleGate evidence)
- [ ] Attendance **check-in then check-out** fresh day for EMP/MGR/HR (not reuse zero-duration row)
- [ ] Attendance **regularization create + approve/deny** confirmed POSTs
- [ ] Timesheet **Log time POST** + Submit week (Project selected)
- [ ] Leave **EL/CL on chargeable weekdays** (prior weekend dates hid real balance paths)
- [ ] Payroll **Run Payroll** confirm (modal opened; commit not proven)
- [ ] Settings **save** mutations (Cancel-preferred today)
- [ ] Payout **Add account** submit (dialogs filled; commit thin)

### C. Export / file formats (close the honesty gap)

- [x] Re-probe **Employees Export CSV** → confirm **ok:true** (sa-exports 16/16, 2026-08-03)
- [x] **Assets inventory CSV** → conflict re-probe ×3 → **flaky** (not solid ok:true); GAP-03 kept
- [ ] Re-probe **Settings → billing-invoices CSV** (deep SA-09; confirm treated Register/Invoice nav as false-positive)
- [ ] Wire FE payslip **Download PDF** to BE PDF (today: `window.print()`; BE already **200**)
- [ ] Prove **Excel/XLSX** if UI offers Export Excel (else document “CSV-only product”) — **still not proven**
- [ ] **CTC Analysis**: add Export CSV or document intentional hide + API still works via direct POST
- [ ] Analytics / Attendance / Leave / Payout / Audit: confirm intentional no-export vs missing control
- [ ] Performance Export stub (`NO_EVENT`)
- [ ] Concurrent export under nest-4 Settings crawl (token-exp SA-04 interaction)

### D. Role / auth thin spots

- [ ] MANAGER Approvals queue with **own SUBMITTED** week visible (self-approve UI) — stress had only historic API id
- [ ] MANAGER `/payroll/runs` OPEN leak — regression gate after RoleGate fix
- [ ] Unfiltered sidebar matrix screenshot for all 4 roles after nav filter fix
- [ ] SA leave identity: empty/`NO_EMPLOYEE_RECORD` after SA-10 fix (not Priya) — Playwright + hammer
- [ ] HR Permissions dead-end + settings redirect-to-first-allowed
- [ ] Bare Next **404** routes: `/settings/roles-permissions`, report hard hrefs

### E. Stress / concurrency still thin

- [ ] Filter/Refresh locators (or product gaps) on Dashboard/Employees/Departments
- [ ] Leave balance aggregate divergence (SA hammer EL total **580.57** vs Priya peek **9** on same id prefix) — separate investigation
- [ ] Multi-shard load spinners (infra vs product)
- [ ] API hammer beyond 8 GET endpoints (mutations under concurrency)
- [ ] **Render/production smoke** (explicitly out of scope so far)

### F. Contract hygiene (reporting debt)

- [x] Mark deep SA-05…09 as **SUPERSEDED** by confirm sa-exports **16/16** (2026-08-03) — historical rows kept
- [ ] Single ID dictionary (kill SA-04/SA-10 confusion in FINDINGS)
- [ ] Align manager FINDINGS ID map with live BE/FE contracts

---

## Evidence index (no new clicks)

| Artifact | Path |
|----------|------|
| Deep rollup | `docs/E2E_DEEP_UI_FINAL_SUMMARY.md` |
| Stress rollup | `docs/E2E_STRESS_FINAL_SUMMARY.md` |
| Deep BE | `docs/E2E_BACKEND_ISSUES_CONTRACT.md` (**10**) |
| Deep FE | `docs/E2E_FRONTEND_ISSUES_CONTRACT.md` (**36**) |
| Stress BE | `docs/E2E_STRESS_BACKEND_CONTRACT.md` |
| Stress FE | `docs/E2E_STRESS_FRONTEND_CONTRACT.md` |
| SA deep FINDINGS | `docs/e2e-ui-screenshots/superadmin-deep/FINDINGS.md` |
| SA-PAY export FINDINGS | `docs/e2e-ui-screenshots/stress/sa-payroll-reports/FINDINGS.md` (**12/12 ok:true**) |
| SA export confirm | `docs/e2e-ui-screenshots/confirm/sa-exports/FINDINGS.md` + `E2E_EXPORT_CONFIRM_MATRIX.md` (historical **16/16**; Assets → **flaky** after re-probe) |
| Assets export re-probe | `docs/e2e-ui-screenshots/confirm/assets-export-reprobe/FINDINGS.md` (**0/3 ok:true** → flaky) |
| Other role/stress FINDINGS | `docs/e2e-ui-screenshots/{*-deep,stress/*}/FINDINGS.md` |

---

## Final honesty answers (copy-paste)

1. **Every button/menu/submenu/component tested?** → **NO.** Land-only SA menus, HR nest≤2, Cancel-preferred mutations, Filter/Refresh MISS, missing export controls, crash/resume coverage, no Render.  
2. **Issues reported properly?** → **YES, mostly.** Deep BE **11** + FE **37** (incl. confirm BOTH **ISSUE-HR-10**); stress contracts append confirmations; alias/supersession debt remains.  
3. **CSV/PDF/Excel?** → **CSV (+ audit JSON) mostly proven** (SA confirm historical 16/16; Employees/Payroll/Reports solid). **Assets inventory CSV = flaky** (GAP-03; re-probe 0/3). HR confirm **14/14 dl ok** with **1** broken Export CSV (`timesheets/utilization` → **ISSUE-HR-10**). Excel **still not proven**. PDF: **BE payslip 200 / FE `window.print` stub**. CTC / Performance / absent toolbars remain. Deep SA-05…09 ok:false **SUPERSEDED** for non-Assets (not wiped).  
4. **Next deep pass** → Use §4 checklist; do not claim full UI coverage until land-only menus, committing mutations, and Excel/invoices/FE-PDF wiring are closed.

**Audit verdict: PARTIAL COVERAGE — not “everything tested.”**
