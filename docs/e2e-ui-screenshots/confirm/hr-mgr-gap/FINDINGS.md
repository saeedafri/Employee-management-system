# FINDINGS — HR + MANAGER Gap Confirm

> Generated: 2026-08-03T03:37:17.894Z
> Roles: `HR_ADMIN` (`hr@acme.test`) · `MANAGER` (`aman@acme.test`) · tenant `acme-corp-001`
> UI: `http://localhost:3001` · API: `http://localhost:4000/api/v1`
> Screenshots: `docs/e2e-ui-screenshots/confirm/hr-mgr-gap/` (**228** PNGs)
> **No Render. No git commit.**

## Summary

| Metric | Value |
|--------|------:|
| Screenshots | **228** |
| Findings log rows | 166 |
| API ≥400 captured | 15 |
| Approve/Reject mutations | 11 |
| Issues total | **4** (all RECONFIRM) |
| NEW issues | **0** |
| RECONFIRM (known) | 4 |
| HR issues | 1 (Permissions dead-end nav) |
| Manager issues | 3 |

## Coverage

### A) HR_ADMIN
- Permissions — land **Access restricted** (expected) + every main button + sidebar click (`003`–`005`)
- Settings openable (**20** slugs) — deep buttons/dialogs; all loaded (no false deny)
- Settings SA-only deny probe (**8** slugs) — all **DENY_OK** (branding, auth, integrations, billing, country-bank-schemas)
- Recruitment / Performance / Assets / Announcements — **all in sidebar** and panels load (deep tabs/buttons)

### B) MANAGER
- Dashboard Approvals + Bulk approve dialog controls
- Timesheets — nested tabs/buttons; Approvals wait → **11** Approve / **11** Return; clicks: Approve×7, Return×2 (403 sticky first row)
- Reports — sidebar visible → Access restricted (dead-end)

## HR observations (non-new)

| Area | Result | Evidence |
|------|--------|----------|
| Permissions page | Access restricted ✓ | `003-hr-permissions-land.png` |
| Permissions in sidebar | Dead-end nav (known) | `002-hr-nav-sidebar.png`, `005-hr-permissions-sidebar-click.png` |
| Settings HR-allowed | 20/20 open + deep controls | `006`–openable series |
| Settings SA-only | 8/8 Access restricted | `hr-settings-deny-*` |
| Recruitment / Performance / Assets / Announcements | Visible + load | `hr-recruitment-*` … `hr-announcements-*` |
| HR API ≥400 (post-login) | none (only login bootstrap 401 me/refresh) | `results.json` |

## Issues

### GAP-HR-01 — Sidebar → Permissions (dead-end)
| | |
|--|--|
| **Novelty** | RECONFIRM:ISSUE-HR-01 |
| **Severity** | HIGH |
| **Class** | FRONTEND |
| **Role** | HR_ADMIN |
| **Why** | Permissions appears in HR sidebar; page correctly shows Access restricted (Super Admins only). Dead-end nav — deny behavior OK, visibility not. |
| **Evidence** | `002-hr-nav-sidebar.png`, `003-hr-permissions-land.png`, `005-hr-permissions-sidebar-click.png` |
| **Network** | n/a |
| **Cross-ref** | ISSUE-HR-01 |

### GAP-MGR-01 — Timesheets → Approvals → Approve
| | |
|--|--|
| **Novelty** | RECONFIRM:ISSUE-MGR-09 |
| **Severity** | CRITICAL |
| **Class** | FRONTEND |
| **Role** | MANAGER |
| **Why** | Approve exposed for row "HA HR Admin Jun 8 – Jun 14, 2026 39.5h 34h billable Jun 8, 2026 History Approve Return" → 403 NOT_TEAM_APPROVER |
| **Evidence** | `167-mgr-approve-0.png` |
| **Network** | 403 POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/approve |
| **Code** | `NOT_TEAM_APPROVER` |
| **Cross-ref** | ISSUE-MGR-09 |

### GAP-MGR-02 — Timesheets → Approvals → Return
| | |
|--|--|
| **Novelty** | RECONFIRM:ISSUE-MGR-09 |
| **Severity** | CRITICAL |
| **Class** | FRONTEND |
| **Role** | MANAGER |
| **Why** | Return exposed for row "HA HR Admin Jun 8 – Jun 14, 2026 39.5h 34h billable Jun 8, 2026 History Approve Return" → 403 NOT_TEAM_APPROVER |
| **Evidence** | `191-mgr-return-result-0.png` |
| **Network** | 403 POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/reject |
| **Code** | `NOT_TEAM_APPROVER` |
| **Cross-ref** | ISSUE-MGR-09 |

### GAP-MGR-03 — Sidebar → Reports
| | |
|--|--|
| **Novelty** | RECONFIRM:ISSUE-MGR-03 |
| **Severity** | HIGH |
| **Class** | FRONTEND |
| **Role** | MANAGER |
| **Why** | Reports visible in MANAGER sidebar but page Access restricted (dead-end nav). Full unfiltered nav also includes Analytics/Permissions/Recruitment/Performance/Assets. |
| **Evidence** | `154-mgr-nav-sidebar.png`, `228-mgr-reports-land.png` |
| **Network** | n/a |
| **Cross-ref** | ISSUE-MGR-03 |

## API fails (sample)

```
HR 401 GET /api/auth/me | {"success":false,"error":{"code":"UNAUTHORIZED","message":"Missing access token","details":{},"requestId":"e32ba580-1ce7
HR 401 POST /api/auth/refresh | {"success":false,"error":{"code":"REFRESH_TOKEN_MISSING","message":"Refresh token not found in cookies","details":{},"re
MGR 401 GET /api/auth/me | {"success":false,"error":{"code":"UNAUTHORIZED","message":"Missing access token","details":{},"requestId":"581a1b1c-afda
MGR 401 POST /api/auth/refresh | {"success":false,"error":{"code":"REFRESH_TOKEN_MISSING","message":"Refresh token not found in cookies","details":{},"re
MGR 403 POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/approve | {"success":false,"error":{"code":"NOT_TEAM_APPROVER","message":"You can only decide requests for your direct reports","d
MGR 403 POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/approve | {"success":false,"error":{"code":"NOT_TEAM_APPROVER","message":"You can only decide requests for your direct reports","d
MGR 403 POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/approve | {"success":false,"error":{"code":"NOT_TEAM_APPROVER","message":"You can only decide requests for your direct reports","d
MGR 403 POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/approve | {"success":false,"error":{"code":"NOT_TEAM_APPROVER","message":"You can only decide requests for your direct reports","d
MGR 403 POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/approve | {"success":false,"error":{"code":"NOT_TEAM_APPROVER","message":"You can only decide requests for your direct reports","d
MGR 403 POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/approve | {"success":false,"error":{"code":"NOT_TEAM_APPROVER","message":"You can only decide requests for your direct reports","d
MGR 403 POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/approve | {"success":false,"error":{"code":"NOT_TEAM_APPROVER","message":"You can only decide requests for your direct reports","d
MGR 403 POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/reject | {"success":false,"error":{"code":"NOT_TEAM_APPROVER","message":"You can only decide requests for your direct reports","d
MGR 403 POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/reject | {"success":false,"error":{"code":"NOT_TEAM_APPROVER","message":"You can only decide requests for your direct reports","d
MGR 403 POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/approve | {"success":false,"error":{"code":"NOT_TEAM_APPROVER","message":"You can only decide requests for your direct reports","d
MGR 403 POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/approve | {"success":false,"error":{"code":"NOT_TEAM_APPROVER","message":"You can only decide requests for your direct reports","d
```
