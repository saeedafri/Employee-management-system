# EMS — Manager Review Pack (2026-10-17)

## How to read this folder
| File | Purpose | Audience |
|---|---|---|
| 00_README_EXECUTIVE_SUMMARY.md | This page: verdict, top risks, decisions needed | Manager |
| 01_FINDINGS_REGISTER.csv | 47 findings, severity, evidence, verification level, fix, effort, phase | Eng lead / PM (open in Excel) |
| 02_GAP_ANALYSIS_AND_REMEDIATION.md | Gaps (security, correctness, product, process) and how to close each | Eng + Manager |
| 03_BUILD_PLAN.md | Phased plan, gates, roles, risks | Manager |
| 04_TEST_REPORT.md | What the backend test suite did, what failed and why, what was read-only | Eng / QA |
| 05_COMPETITIVE_ANALYSIS_AND_PLAN.md | 20+ competitors, internals teardown, review mining, statutory research | Product |
| 06_REA_FRONTEND_BUILD.md | REA analysis of our own shipped frontend bundle | Eng |
| 07_DECISIONS_ACCESS_AND_LIMITS.md | Decisions needed from you, read-only vs write matrix, issues hit, unverified items | Manager |
| evidence/ | Raw audit notes, logs, screenshots, scripts (secret-scanned; only placeholder strings found) | Reviewers |

## Verdict (one paragraph)
EMS is functionally broad (≈420 routes, 77 models, multi-country payroll engine, strong RBAC catalogue) and its unit/offline test bucket is green (392/392). It is **not yet safe to sell or scale**: several tenant-isolation, authentication-hardening and payroll-integrity defects were reproduced live on a local stack, live credentials are committed to git, and rate limiting, CORS and security headers do not work at all because of one plugin-registration mistake. The good news: most critical items are small, shared-layer fixes (days, not months). Product gaps against competitors (SSO, public API/webhooks, onboarding, shifts, Arabic/RTL, verified Gulf/India statutory packs) are real but secondary to the stop-ship list.

## Top 8 risks (details in register)
1. Committed live GitHub token and Render API key; older DB/Resend/Cloudinary/JWT secrets in git history (F04) — rotate now.
2. Rate limits, CORS, helmet inert — one root cause, reproduced in isolation (F01/F02).
3. Anonymous SUPER_ADMIN self-registration, plus cross-tenant log read and role-escalation path (F03/F05/F06).
4. Body foreign keys not tenant-checked; cross-tenant department write (F10/F11).
5. Payroll integrity: non-atomic calculate, no approval status guard, editable paid payslips, bonus tax always 0 (F18–F22).
6. India statutory output differs from law (wrong seeded slabs, no 87A, stale EPF ceiling, PT unit bug) (F23).
7. Export builder can freeze the server (F07) and fabricated payroll reports/billing fixtures (F25).
8. Terminated employees keep access (F13).

## What was verified and how
- Backend test suite: offline bucket 392/392 pass; DB bucket 39/103 (64 failures = no seed data in the throwaway DB, not product bugs) — see 04. The requested Hostinger test database does not exist/was not identifiable (only the production `ems` database is known; the suite's own guard refuses it), so DB tests ran on a throwaway local Postgres. **Nothing touched Hostinger.**
- Live local E2E (two rounds, 2 tenants × 4 roles; 362-route cross-tenant sweep; concurrency and load) and a real-stack frontend walkthrough — see evidence/e2e.
- Source audits by module, REA analysis of our own frontend build and passive REA teardown of competitor public surfaces.

## Decisions needed from you
See 07. Most urgent: (1) rotate secrets; (2) authorise a dedicated `ems_test` database (new database, own credentials) so CI and the 64 blocked tests can run; (3) approve Phase 0a/0b scope and the owner for each; (4) engage statutory advisers (India payroll consultant, GCC labour-law adviser).
