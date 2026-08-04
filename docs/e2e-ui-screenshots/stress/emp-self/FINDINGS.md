# FINDINGS — EMP-SELF (EMPLOYEE stress + deep SHORT)

| Field | Value |
|-------|-------|
| Date | 2026-08-03 |
| Role | `EMPLOYEE` — `priya@acme.test` / tenant `acme-corp-001` |
| UI | `http://localhost:3001` |
| BE | `http://localhost:4000` |
| Mode | STRESS + DEEP SHORT |
| Screenshots | **55** PNGs in `docs/e2e-ui-screenshots/stress/emp-self/` |
| Duration | ~289 s |
| Findings (product) | **4** (BE=2 FE=3 with AL FE overlap) |
| Mutations | **10** |
| Runner | `_stress_emp_self.mjs` · `results.json` · `_run.log` |

## Focus coverage

| Area | Actions | Evidence |
|------|---------|----------|
| Login | networkidle hydrate → Sign in | `001`–`003` |
| Attendance CI/CO | Calendar/Table/Reg; CI/CO button state (already done today) | `004`–`010` |
| Leave all types | AL/SL/CO/EL/CL fill+submit; withdraw | `011`–`032` |
| Leave preview stress ×5 | open dialog + AL dates → observe preview GET | `017`–`021` (**5/5 404**) |
| Timesheets | tabs + Log time fill/submit | `033`–`039` |
| Payslip drawer stress ×5 | My Pay tabs + open drawer repeatedly | `040`–`051` |
| Notifications | bell → mark-all-read ×2 | `052`–`054` |

## Stress summary

| Stress | Result |
|--------|--------|
| Leave preview ×5 | **5/5** `404 GET /api/leave/requests/preview` |
| Payslip open ×5 | Drawer opened; first detail **200** `GET .../payslips/{id}`; skeleton stuck **0** |
| Mark-all-read ×2 | #1 **200** `PATCH /api/notifications/read-all` `markedRead:1`; #2 control absent (inbox cleared — OK) |

## Mutations

| Action | Result | Shot |
|--------|--------|------|
| Login | **200** | `003` |
| Leave AL | **400** `NO_LEAVE_BALANCE` | `023` |
| Leave SL | **201** PENDING | `025` |
| Leave CO | **400** `INSUFFICIENT_BALANCE` (available 0) | `027` |
| Leave EL | **201** PENDING | `029` |
| Leave CL | **400** `NO_CHARGEABLE_DAYS` (Sat 2026-11-21) | `031` |
| Leave withdraw | **200** | `032` |
| Timesheet Log time | UI only — **no POST** | `039` |
| Notifications mark-all #1 | **200** | `053` |

## Working (OK)

- Login EMPLOYEE → dashboard
- Attendance Calendar / Table / Regularization shells
- Sick Leave + Earned Leave create; withdraw PENDING
- Comp Off / Casual Leave correctly rejected by BE guards
- Payroll My Pay tabs; payslip drawer stress (detail 200)
- Notifications mark-all-read

## Product defects

### STRESS-EMP-BE-01 / STRESS-EMP-FE-01 — Annual Leave orphan (`NO_LEAVE_BALANCE`) — CRITICAL
- BE: types include AL; balance missing AL → submit 400
- FE: picker offers AL
- Shots: `022`–`023`
- Reconfirms deep `ISSUE-EMP-01` / `ISSUE-EMP-02` (FE)

### STRESS-EMP-BE-02 — Leave preview route missing — HIGH
- `GET /leave/requests/preview` **404** on all 5 stress opens + every type submit path
- Shots: `017`–`021`, submit shots `023`–`031`
- Reconfirms deep `ISSUE-EMP-02` (BE)

### STRESS-EMP-FE-02 — Team Calendar visible to EMPLOYEE — HIGH
- Tab shown; Access restricted
- Shot: `013`

### STRESS-EMP-FE-03 — Timesheet Log time no POST — MEDIUM
- Save/Submit without network mutation (validation / project)
- Shot: `039`

## Correct BE (not defects)

- CO `INSUFFICIENT_BALANCE` available=0
- CL `NO_CHARGEABLE_DAYS` on Saturday test date
- CI/CO buttons absent after same-day completion
- Mark-all-read #2 control gone after empty inbox

## Contracts

- `docs/E2E_STRESS_BACKEND_CONTRACT.md` → `## EMP-SELF`
- `docs/E2E_STRESS_FRONTEND_CONTRACT.md` → `## EMP-SELF`
