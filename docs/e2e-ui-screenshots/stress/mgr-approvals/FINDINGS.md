# FINDINGS — MANAGER Approvals Stress (SHORT)

> Generated: 2026-08-03 · Role: `MANAGER` (`aman@acme.test` / tenant `acme-corp-001`)  
> UI: `http://localhost:3001` · API: `http://localhost:4000/api/v1`  
> Tool: Playwright Chromium · nested deep + rapid Approve/Return stress  
> Screenshots: `docs/e2e-ui-screenshots/stress/mgr-approvals/` (**58** PNGs)  
> **No Render. No git commit.**

## Summary

| Metric | Value |
|--------|------:|
| Screenshots | **58** |
| Menus nested | Dashboard approvals · Timesheets Approvals · Leave · Attendance |
| Stress Approve clicks (loaded) | **5** → **4× 403** `NOT_TEAM_APPROVER` |
| Stress Return submits | **4** → **2× 403** `NOT_TEAM_APPROVER` |
| Targeted HR Admin Approve | **403** `NOT_TEAM_APPROVER` |
| `SELF_APPROVAL_FORBIDDEN` | **API captured** (own id); **no Aman SUBMITTED row** in current Approvals queue |
| Unique FE issues (deduped) | **3** (C1 NOT_TEAM, C2 SELF cross-ref, H1 bulk leave-only) |

## Coverage

1. **Dashboard** — land, approvals section, Bulk approve modal, links (team/approvals/pending), Approve/Deny probes (`001`–`009`)
2. **Timesheets** — My / Approvals / Delegations tabs; Approvals table (13 pending); rapid Approve/Return; HR Admin targeted (`010`–`022`, `046`–`056`)
3. **Leave** — My Requests / Team Calendar / Comp-off / Approvals + nested New Request (`023`–`039`, `057`)
4. **Team attendance** — Calendar / Table / Regularization / month filters (`040`–`044`, `058`)

## Stress results

| Burst | Clicks | Outcome |
|-------|-------:|---------|
| Rapid Approve (after wait for table) | 5 | **4×** `POST …/approve` → **403** `NOT_TEAM_APPROVER` (`047`) |
| Rapid Return + modal submit | 4 | **2×** `POST …/reject` → **403** `NOT_TEAM_APPROVER` (`048`–`054`) |
| HR Admin Approve (targeted) | 1 | **403** `NOT_TEAM_APPROVER` id `cmqjpyhsz009j12oncxrxe5gz` (`055`–`056`) |
| API self reject (historic id) | 1 | **403** `SELF_APPROVAL_FORBIDDEN` id `cmr4fpp2m006ggrlntoghkxu0` |
| First-pass (skeleton race) | Approve=0 | Table still skeleton at `014` — gap-fill waited for buttons |

Approvals queue (API `GET /timesheets/approvals?status=SUBMITTED`): **13** rows including **HR Admin**, Rajesh Sharma, … — **no Aman Kumar**. Aman’s current week is `DRAFT` (`2026-08-03`).

## Issues

### C1. Approvals exposes Approve/Return for non-direct reports → 403 `NOT_TEAM_APPROVER`
| | |
|--|--|
| **Severity** | CRITICAL |
| **Class** | FRONTEND (primary) — BE correct |
| **Where** | Timesheets → Approvals |
| **Why** | Pending list shows Approve + Return for HR Admin and other non-reports; stress bursts fire many 403s with toast-level failure only. |
| **Evidence** | `046`–`056`; `results-gapfill.json` |
| **Network** | `POST /api/timesheets/{id}/approve\|reject` → **403** `NOT_TEAM_APPROVER` — “You can only decide requests for your direct reports” |
| **IDs** | e.g. `cmqjpyhsz009j12oncxrxe5gz` (HR Admin), `cmqjpyi4800mv12onxd63wav0`, `cmqjpyi1600if12onc8cpavvh`, `cmqjpyiaq00vr12onlie5r8xa` |
| **Fix** | Filter Approvals queue / disable actions to direct reports (and delegates) only. |
| **Cross-ref** | `ISSUE-MGR-09` · deep FINDINGS `C2` |

### C2. Self-approval still forbidden by BE; UI historically shows own-row actions
| | |
|--|--|
| **Severity** | CRITICAL |
| **Class** | FRONTEND (primary) — BE correct |
| **Where** | Timesheets → Approvals (own rows) |
| **Why** | This stress queue has **no** Aman SUBMITTED row. API still returns **403** `SELF_APPROVAL_FORBIDDEN` for historic own id. Shallow same-day UI proved Approve/Return visible on own rows. |
| **Evidence** | API gap-fill; shallow `docs/e2e-ui-screenshots/manager/30`, `69`, `70` |
| **Network** | `POST /api/timesheets/cmr4fpp2m006ggrlntoghkxu0/reject` → **403** `SELF_APPROVAL_FORBIDDEN` |
| **Fix** | Hide Approve/Return when `employeeId === current user`; exclude own submissions from Approvals. |
| **Cross-ref** | `ISSUE-MGR-02` · deep FINDINGS `C1` |

### H1. Dashboard Bulk approve is leave-only
| | |
|--|--|
| **Severity** | HIGH |
| **Class** | FRONTEND |
| **Where** | Dashboard → Bulk approve |
| **Why** | Opens “Bulk Approve Leave Requests” while Pending Approvals can be regularizations. |
| **Evidence** | `006-dashboard-bulk-approve-open.png` |
| **Fix** | Bulk-approve regs too, or rename/split; disable when empty. |
| **Cross-ref** | `ISSUE-MGR-04` |

## Observations (non-issues)

- BE correctly enforces maker≠checker / team scope under rapid multi-click (no 500s, no silent 200 on forbidden).
- Leave Approvals tab nested OK (`057`); Team attendance filters nested OK (`058`).
- Sidebar still lists admin menus for MANAGER (known `ISSUE-MGR-03`) — out of shard fix scope.

## Artifacts

| File | Role |
|------|------|
| `_stress_mgr_approvals.mjs` | Main SHORT deep + stress |
| `_gapfill_403.mjs` | Wait-for-table + 403 capture |
| `results.json` | First pass |
| `results-gapfill.json` | 403 network evidence |
| `_run.log` / `_run_gapfill.log` | Console traces |

## Contract pointers

- `docs/E2E_STRESS_FRONTEND_CONTRACT.md` → `## MGR-APPROVALS`
- `docs/E2E_STRESS_BACKEND_CONTRACT.md` → `## MGR-APPROVALS`
