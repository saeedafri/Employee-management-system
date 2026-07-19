# UI Team — Document index (2026-07-19 Hostinger hardening)

**Start here:** [`UI_TEAM_HANDOFF_HOSTINGER_HARDENING_2026-07-19.md`](./UI_TEAM_HANDOFF_HOSTINGER_HARDENING_2026-07-19.md)

## Contracts (implement against these)

1. [`UI_CONTRACT_role_nav_no_employee_2026-07-19.md`](./UI_CONTRACT_role_nav_no_employee_2026-07-19.md)  
   Role-filtered nav + Super Admin / `noEmployeeRecord` empty states.

2. [`UI_CONTRACT_server_exports_permissions_realtime_logs.md`](./UI_CONTRACT_server_exports_permissions_realtime_logs.md)  
   Server exports (incl. PDF), permissions SoT, SSE notifications, ops logs (no nav).

## Backend detail (for FE leads / QA)

3. [`BACKEND_CHANGELOG_hostinger_hardening_2026-07-19.md`](./BACKEND_CHANGELOG_hostinger_hardening_2026-07-19.md)  
   File-by-file what changed in BE.

4. [`API_MAPPING.md`](./API_MAPPING.md)  
   Full response shapes (updated 2026-07-19 for Hostinger + permissions matrix).

5. Swagger: `https://ems-api.saqibsaeed.cloud/docs` (live after deploy; ops routes hidden).

## Evidence / proof

6. [`LIVE_E2E_HOSTINGER_68d32f4_2026-07-19.md`](./LIVE_E2E_HOSTINGER_68d32f4_2026-07-19.md)  
   Post-deploy Hostinger Terminal proof (`68d32f4`, SA empty-read PASS).

6b. [`LIVE_UI_ROLE_MATRIX_VERCEL_2026-07-19.md`](./LIVE_UI_ROLE_MATRIX_VERCEL_2026-07-19.md)  
   Live Vercel UI 4-role matrix + export/SSE probes (post-deploy).

7. [`UI_ROLE_MATRIX_E2E_2026-07-19.md`](./UI_ROLE_MATRIX_E2E_2026-07-19.md)  
   Pre-fix UI crawl (SA was FAIL — fixed on BE).

8. [`UI_E2E_TEST_REPORT_2026-07-19.md`](./UI_E2E_TEST_REPORT_2026-07-19.md)  
   Broader smoke notes.

9. [`PROOF_hostinger_hardening_2026-07-18.md`](./PROOF_hostinger_hardening_2026-07-18.md)  
   Offline/unit proof + network blocker log.

## Related (earlier authz pass)

10. [`UI_CONTRACT_authz_and_2026-07_changes.md`](./UI_CONTRACT_authz_and_2026-07_changes.md)

---

**Live API:** `https://ems-api.saqibsaeed.cloud/api/v1`  
**Commit:** `68d32f4`  
**MSW:** `NEXT_PUBLIC_USE_MOCKS=false`
