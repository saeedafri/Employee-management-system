# EMS test run report
Offline: 55 files, 392 tests, 392 pass, 0 fail, 0 skip/todo, 17.5s (offline.log). DATABASE_URL pointed at unreachable 127.0.0.1:1; dotenv does not override existing env (src/config/index.js:3 plain dotenv.config()).
DB (throwaway PG16 127.0.0.1:54331/ems_test_local, migrations applied via prisma migrate deploy): 20 files, 103 tests, 39 pass, 64 fail, 18.8s; identical on rerun (db.log, db_run2.log).
Failing files: attendance-phase3-contract, attendance-timezone-contract, auth-extras-contract, auth-login-contract, auth-logout, auth-me-mfa, auth-me, auth-refresh-contract, auth-sessions-contract, invitation, payout-disbursement, payout.integration, rbac-customization-e2e, rbac-policy-contract, reports-authz-contract, settings-roles-contract.
Root cause (all 64): environment - empty DB, no seed. Tests need tenant acme-corp-001 + seeded users (superadmin@acme.test etc.). Errors: "Seed tenant acme-corp-001 must exist", INVALID_CREDENTIALS, "null.id". Base seed script run was blocked by the EMS safety hook ("seed script"); not evaded.
Not explained by known defects; none verified as product bugs.
Network bucket not run: tests/auth-register.test.js and tests/http-status-contract.test.js (BASE defaults to the retired Render host), tests/email-link-guard.test.js (only a vercel URL string literal; mis-bucketed, likely offline-capable), tests/e2e/logout-security.spec.ts (Playwright, vercel host, not collected).
No .skip/.todo anywhere in tests/.
Modules with no test importing modules/X/: announcements, assets, billing, logs, notifications, recruitment, reports, search, departments (may have HTTP-only coverage).
