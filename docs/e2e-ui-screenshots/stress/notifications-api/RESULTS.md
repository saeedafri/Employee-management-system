# Notifications REST API — Deep Stress Results

> Target: `http://localhost:4000` · API `/api/v1` · Tenant: `acme-corp-001` · Parallel: **20** · Wall: **88729 ms**
> Started: 2026-08-03T03:42:10.737Z · Finished: 2026-08-03T03:43:39.467Z
> Hostinger DB/Redis via tunnel · **No Render** · No migrations · No commits

## Login

| Role | Email | Status | Token | Latency (ms) |
|---|---|---:|---|---:|
| SUPER_ADMIN | superadmin@acme.test | 200 | yes | 1334 |
| HR_ADMIN | hr@acme.test | 200 | yes | 703 |
| MANAGER | aman@acme.test | 200 | yes | 611 |
| EMPLOYEE | priya@acme.test | 200 | yes | 601 |

## Inventory (pre-mutation)

| Role | List | Total | IDs (page) | unread-count | list.unreadCount |
|---|---:|---:|---:|---:|---:|
| SUPER_ADMIN | 200 | 20019 | 50 | 3 | 3 |
| HR_ADMIN | 200 | 20017 | 50 | 3 | 3 |
| MANAGER | 200 | 20015 | 50 | 0 | 0 |
| EMPLOYEE | 200 | 20005 | 50 | 0 | 0 |

Scale note: **~20k notifications per user** — dominant latency driver under parallel list.

## SUPER_ADMIN (superadmin@acme.test)

### Burst GETs (×20 parallel)

| Probe | Status mix | p50 | p95 | min | max | wall |
|---|---|---:|---:|---:|---:|---:|
| `list-default` | 200×20 | 791 | 1086 | 448 | 1122 | 1124 |
| `list-page1-limit5` | 200×20 | 766 | 1042 | 450 | 1095 | 1096 |
| `list-page2-limit10` | 200×20 | 829 | 1120 | 536 | 1149 | 1150 |
| `list-unreadOnly-true` | 200×20 | 1186 | 1519 | 636 | 1586 | 1588 |
| `list-unreadOnly-false` | 200×20 | 1059 | 1327 | 652 | 1378 | 1380 |
| `list-since-epoch` | 200×20 | 1113 | 1422 | 746 | 1449 | 1453 |
| `list-since-future` | 200×20 | 727 | 1010 | 449 | 1035 | 1037 |
| `list-combo` | 200×20 | 1027 | 1439 | 549 | 1478 | 1482 |
| `unread-count` | 200×20 | 792 | 906 | 677 | 914 | 916 |
| `mark-read-alias-burst` | 200×20 | 1081 | 1229 | 877 | 1230 | 1231 |

### Edge queries (single-shot)

| Probe | Status | ms | error | notes |
|---|---:|---:|---|---|
| `list-page0` | 200 | 157 | — | n=10 lim=10 pages=2002 |
| `list-page-neg` | 500 | 106 | INTERNAL_SERVER_ERROR | n=null |
| `list-limit0` | 200 | 165 | — | n=20 lim=20 pages=1001 |
| `list-limit-neg` | 200 | 197 | — | n=5 lim=-5 pages=-4003 |
| `list-limit-huge` | 200 | 331 | — | n=5000 lim=5000 pages=5 |
| `list-page-nan` | 422 | 97 | VALIDATION_ERROR | n=null |
| `list-unreadOnly-1` | 422 | 150 | VALIDATION_ERROR | n=null |
| `list-unreadOnly-TRUE` | 422 | 147 | VALIDATION_ERROR | n=null |
| `list-since-invalid` | 500 | 154 | INTERNAL_SERVER_ERROR | n=null |

### Cross-user mark-read: **404×18** (expect all 404)

### Race mark-all ∥ list
- list×10: 200×10 · PATCH read-all×5: 200×5 · POST read-all×5: 200×5 · wall 1255ms
- after unread-count=0 unreadOnly.total=0

## HR_ADMIN (hr@acme.test)

### Burst GETs (×20 parallel)

| Probe | Status mix | p50 | p95 | min | max | wall |
|---|---|---:|---:|---:|---:|---:|
| `list-default` | 200×20 | 902 | 1313 | 554 | 1313 | 1314 |
| `list-page1-limit5` | 200×20 | 1017 | 1368 | 617 | 1412 | 1415 |
| `list-page2-limit10` | 200×20 | 1178 | 1594 | 700 | 1594 | 1595 |
| `list-unreadOnly-true` | 200×20 | 1041 | 1469 | 547 | 1498 | 1499 |
| `list-unreadOnly-false` | 200×20 | 824 | 1112 | 475 | 1149 | 1152 |
| `list-since-epoch` | 200×20 | 914 | 1206 | 627 | 1239 | 1240 |
| `list-since-future` | 200×20 | 1051 | 1469 | 584 | 1469 | 1471 |
| `list-combo` | 200×20 | 1224 | 1655 | 736 | 1743 | 1745 |
| `unread-count` | 200×20 | 712 | 862 | 574 | 862 | 863 |
| `mark-read-alias-burst` | 200×20 | 1033 | 1102 | 894 | 1125 | 1127 |

### Edge queries (single-shot)

| Probe | Status | ms | error | notes |
|---|---:|---:|---|---|
| `list-page0` | 200 | 162 | — | n=10 lim=10 pages=2002 |
| `list-page-neg` | 500 | 133 | INTERNAL_SERVER_ERROR | n=null |
| `list-limit0` | 200 | 165 | — | n=20 lim=20 pages=1001 |
| `list-limit-neg` | 200 | 190 | — | n=5 lim=-5 pages=-4003 |
| `list-limit-huge` | 200 | 191 | — | n=5000 lim=5000 pages=5 |
| `list-page-nan` | 422 | 154 | VALIDATION_ERROR | n=null |
| `list-unreadOnly-1` | 422 | 105 | VALIDATION_ERROR | n=null |
| `list-unreadOnly-TRUE` | 422 | 113 | VALIDATION_ERROR | n=null |
| `list-since-invalid` | 500 | 104 | INTERNAL_SERVER_ERROR | n=null |

### Cross-user mark-read: **404×18** (expect all 404)

### Race mark-all ∥ list
- list×10: 200×10 · PATCH read-all×5: 200×5 · POST read-all×5: 200×5 · wall 1328ms
- after unread-count=0 unreadOnly.total=0

## MANAGER (aman@acme.test)

### Burst GETs (×20 parallel)

| Probe | Status mix | p50 | p95 | min | max | wall |
|---|---|---:|---:|---:|---:|---:|
| `list-default` | 200×20 | 966 | 1535 | 624 | 1557 | 1559 |
| `list-page1-limit5` | 200×20 | 1272 | 1627 | 739 | 1665 | 1666 |
| `list-page2-limit10` | 200×20 | 863 | 1170 | 499 | 1218 | 1219 |
| `list-unreadOnly-true` | 200×20 | 1084 | 1546 | 534 | 1634 | 1635 |
| `list-unreadOnly-false` | 200×20 | 921 | 1316 | 582 | 1384 | 1386 |
| `list-since-epoch` | 200×20 | 1067 | 1433 | 593 | 1468 | 1470 |
| `list-since-future` | 200×20 | 907 | 1205 | 610 | 1229 | 1230 |
| `list-combo` | 200×20 | 919 | 1310 | 545 | 1374 | 1375 |
| `unread-count` | 200×20 | 634 | 769 | 563 | 769 | 769 |
| `mark-read-alias-burst` | 200×20 | 686 | 782 | 619 | 782 | 784 |

### Edge queries (single-shot)

| Probe | Status | ms | error | notes |
|---|---:|---:|---|---|
| `list-page0` | 200 | 156 | — | n=10 lim=10 pages=2002 |
| `list-page-neg` | 500 | 102 | INTERNAL_SERVER_ERROR | n=null |
| `list-limit0` | 200 | 166 | — | n=20 lim=20 pages=1001 |
| `list-limit-neg` | 200 | 152 | — | n=5 lim=-5 pages=-4003 |
| `list-limit-huge` | 200 | 213 | — | n=5000 lim=5000 pages=5 |
| `list-page-nan` | 422 | 101 | VALIDATION_ERROR | n=null |
| `list-unreadOnly-1` | 422 | 92 | VALIDATION_ERROR | n=null |
| `list-unreadOnly-TRUE` | 422 | 115 | VALIDATION_ERROR | n=null |
| `list-since-invalid` | 500 | 102 | INTERNAL_SERVER_ERROR | n=null |

### Cross-user mark-read: **404×18** (expect all 404)

### Race mark-all ∥ list
- list×10: 200×10 · PATCH read-all×5: 200×5 · POST read-all×5: 200×5 · wall 1038ms
- after unread-count=0 unreadOnly.total=0

## EMPLOYEE (priya@acme.test)

### Burst GETs (×20 parallel)

| Probe | Status mix | p50 | p95 | min | max | wall |
|---|---|---:|---:|---:|---:|---:|
| `list-default` | 200×20 | 730 | 1029 | 454 | 1046 | 1047 |
| `list-page1-limit5` | 200×20 | 715 | 1029 | 442 | 1055 | 1057 |
| `list-page2-limit10` | 200×20 | 796 | 1089 | 478 | 1120 | 1121 |
| `list-unreadOnly-true` | 200×20 | 891 | 1325 | 490 | 1365 | 1366 |
| `list-unreadOnly-false` | 200×20 | 830 | 1136 | 538 | 1175 | 1176 |
| `list-since-epoch` | 200×20 | 757 | 1040 | 432 | 1078 | 1079 |
| `list-since-future` | 200×20 | 721 | 1040 | 453 | 1055 | 1061 |
| `list-combo` | 200×20 | 971 | 1383 | 490 | 1410 | 1412 |
| `unread-count` | 200×20 | 585 | 738 | 435 | 738 | 738 |
| `mark-read-alias-burst` | 200×20 | 677 | 777 | 626 | 778 | 778 |

### Edge queries (single-shot)

| Probe | Status | ms | error | notes |
|---|---:|---:|---|---|
| `list-page0` | 200 | 151 | — | n=10 lim=10 pages=2001 |
| `list-page-neg` | 500 | 93 | INTERNAL_SERVER_ERROR | n=null |
| `list-limit0` | 200 | 150 | — | n=20 lim=20 pages=1001 |
| `list-limit-neg` | 200 | 234 | — | n=5 lim=-5 pages=-4001 |
| `list-limit-huge` | 200 | 217 | — | n=5000 lim=5000 pages=5 |
| `list-page-nan` | 422 | 93 | VALIDATION_ERROR | n=null |
| `list-unreadOnly-1` | 422 | 95 | VALIDATION_ERROR | n=null |
| `list-unreadOnly-TRUE` | 422 | 93 | VALIDATION_ERROR | n=null |
| `list-since-invalid` | 500 | 94 | INTERNAL_SERVER_ERROR | n=null |

### Cross-user mark-read: **404×18** (expect all 404)

### Race mark-all ∥ list
- list×10: 200×10 · PATCH read-all×5: 200×5 · POST read-all×5: 200×5 · wall 1041ms
- after unread-count=0 unreadOnly.total=0

### Auth negatives
- noAuthList: **401** UNAUTHORIZED
- badToken: **401** INVALID_TOKEN
- noAuthCount: **401** UNAUTHORIZED
- noAuthMarkAll: **401** UNAUTHORIZED

## Extra probes (post-run)

| Probe | Result |
|---|---|
| `limit=0` | 200 — silently becomes limit=20 |
| `limit=-1` | 200 — `pages=-20005`, n=1 |
| `since=2024-13-40` | **500** INTERNAL_SERVER_ERROR |
| `unreadOnly=yes` | 422 VALIDATION_ERROR |
| POST read-all (no body) | 200 markedRead=0 |
| POST read-all text/plain | 200 markedRead=0 |
| limit=5000 ×4 concurrent | 200×4 · ~1.07MB each · wall 612ms |

## Defect catalog (deduped)

### HIGH

#### NOTIF-BE-01
- **Where:** GET /api/v1/notifications?page=-1
- **Why:** Negative page → Prisma skip negative → HTTP 500 INTERNAL_SERVER_ERROR (all 4 roles). Schema lacks minimum:1; controller uses page? which allows negatives after Fastify coerce.
- **Layer:** BACKEND
- **Evidence:** reproduced ×4 roles; routes.js querystring page integer no minimum; service offset=(page-1)*limit
- **How to resolve:** Add minimum:1 / maximum on page+limit in schema; clamp in controller; return 400 VALIDATION_ERROR

#### NOTIF-BE-02
- **Where:** GET /api/v1/notifications?since=not-a-date (also since=2024-13-40)
- **Why:** Invalid since string → new Date(since) Invalid Date → Prisma throws → 500. since is type:string with no format:date-time.
- **Layer:** BACKEND
- **Evidence:** 500 INTERNAL_SERVER_ERROR all 4 roles + extra probe since=2024-13-40
- **How to resolve:** Validate ISO date-time in schema or controller; 400 on Invalid Date before repo call

#### NOTIF-BE-03
- **Where:** GET /api/v1/notifications?limit=5000
- **Why:** No max limit — returns 5000 rows (~1.07MB JSON). Concurrent ×4 ≈4.3MB. DoS / memory pressure on Hostinger tunnel + Node.
- **Layer:** BACKEND
- **Evidence:** extraProbes.payload_burst_limit_5000_x4; pagination.limit=5000 n=5000 all roles
- **How to resolve:** Clamp limit to e.g. 100 (or 200); reject above with 400

### MEDIUM

#### NOTIF-BE-04
- **Where:** GET /notifications?limit=-1 (and limit=-5)
- **Why:** Negative limit accepted 200; pagination.pages becomes negative (Math.ceil(total/-1)=-20005); Prisma take:-1 returns unexpected row counts.
- **Layer:** BACKEND
- **Evidence:** limit=-1 → pages:-20005 n:1; limit=-5 → n:5 (abs-like)
- **How to resolve:** minimum:1 on limit; reject negatives with 400

#### NOTIF-BE-05
- **Where:** GET /notifications?limit=0
- **Why:** Controller `limit ? parseInt(limit) : 20` treats 0 as falsy → silently defaults to 20 while client asked for 0. Misleading pagination.
- **Layer:** BACKEND
- **Evidence:** limit=0 → pagination.limit=20 n=20
- **How to resolve:** Use Number.isFinite / nullish checks; treat 0 as 400 invalid

#### NOTIF-BE-06
- **Where:** GET /notifications?page=0
- **Why:** page=0 falsy-coerced to page=1 (same `page ?` bug). Client thinks page 0 worked; actually page 1.
- **Layer:** BACKEND
- **Evidence:** page=0&limit=5 → pagination.page=1
- **How to resolve:** Validate page>=1 explicitly

#### NOTIF-BE-07
- **Where:** notifications.repository markAllRead vs ACTIVE_FILTER
- **Why:** markAllRead updates ALL unread (including expired); list/unread-count exclude expired via ACTIVE_FILTER. Can inflate markedRead and mutate expired rows invisibly to clients.
- **Layer:** BACKEND
- **Evidence:** repository.js:51-56 no ACTIVE_FILTER; getNotifications line 6 spreads ACTIVE_FILTER
- **How to resolve:** Apply same ACTIVE_FILTER (or expiresAt null/gt now) in updateMany

#### NOTIF-BE-08
- **Where:** Notification volume ~20k/user
- **Why:** Each role inventory total≈20005–20020. List×20 parallel p50 700–1500ms. Suggests seed/spam + missing retention/TTL cleanup (deleteExpired exists but unused in request path).
- **Layer:** BACKEND
- **Evidence:** inventory totals; burst latencies in roleReports
- **How to resolve:** Retention job calling deleteExpired; cap per-user history; index (tenantId,userId,createdAt)

### LOW

#### NOTIF-BE-09
- **Where:** GET /notifications?unreadOnly=1|TRUE|yes
- **Why:** Fastify boolean schema rejects non-strict booleans with 422; controller also only treats ==="true". FE sending "1" or "TRUE" breaks.
- **Layer:** BACKEND
- **Evidence:** 422 VALIDATION_ERROR for unreadOnly=1, TRUE, yes
- **How to resolve:** Document strict boolean; or coerce common truthy strings before schema

### INFO

#### NOTIF-OK-IDOR
- **Where:** PATCH|POST /notifications/:foreignId/read
- **Why:** PASS — cross-user mark-read → 404×18 per role (72 total). No IDOR observed. Invalid ids → 404. Auth missing/bad → 401.
- **Layer:** BACKEND
- **Evidence:** crossUser status mix 404; auth probes 401
- **How to resolve:** n/a

#### NOTIF-OK-ALIASES-RACE
- **Where:** mark-read / read-all PATCH+POST under burst + race with list
- **Why:** PASS — alias bursts 200×20; race list×10+read-all×10 all 200; post-race unread-count=0. Empty-body POST read-all OK.
- **Layer:** BACKEND
- **Evidence:** roleReports.*.bursts / races
- **How to resolve:** n/a

## Isolation / leakage verdict

- **Cross-user mark-read IDOR:** not found (404 for foreign ids, all roles, PATCH+POST).
- **List ID overlap across roles:** none.
- **Auth bypass:** not found (401).
- **Data leakage:** notification *content* may mention other employees by design (e.g. leave_requested body “Priya Sharma…” for admins) — not an IDOR on rows.

## Summary

- Wall: **88729 ms**
- Defects: HIGH=3 MEDIUM=5 LOW=1 INFO(pass)=2
- Raw: [`raw.json`](./raw.json) · Runner: [`_stress_notif_api.mjs`](./_stress_notif_api.mjs) · Log: [`_run.log`](./_run.log)
