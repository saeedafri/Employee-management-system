# EMS Build Plan (for manager review)

Basis: evidence in `evidence/` and `01_FINDINGS_REGISTER.csv` (IDs F01–F43). Estimates are rough person-week (pw) ranges for 1–2 engineers who know the codebase; re-estimate after Phase 0 sprint planning. "Done" = acceptance test exists and passes in CI.

## Guiding principles
1. Stop-ship before features: nothing in Phase 2+ ships to customers until P0a/P0b are closed and verified by tests that fail first.
2. Fix classes of bugs at the shared layer (plugin wrapper, central tenant-FK assertion, scope resolver), not per endpoint.
3. Every money path is transactional, status-guarded, audited, and covered by known-answer tests.
4. Statutory rules are versioned data with source citations and an owner; no rule ships unless confirmed from a primary source or a qualified adviser.
5. Evidence-first reporting: no "PASS" without command output (see final-report-enforcer).

## Phase 0a — Security stop-ship (week 1; ~2–3 pw)
| Item | Findings | Acceptance test |
|---|---|---|
| Rotate + purge committed secrets; pre-commit secret scan | F04 | gitleaks clean on HEAD; rotation checklist signed |
| Plugin encapsulation fix (rate-limit, CORS, helmet), config.rateLimit, trustProxy, lockout | F01,F02 | inject test: 6th login → 429; headers present on /health |
| Gate /auth/register; /ops tenant scope | F05,F06 | anon register → 403/202-pending; ops test shows own tenant only |
| Roles escalation fix | F03 | role with permission above caller → 403; userIds from other tenant → 404 |
| Central tenant-FK assertion + tenantId in all update/delete where; dept/recruitment/performance/settings allowlists | F10,F11,F12 | cross-tenant body-FK matrix test (the 362-route sweep, scripted) all 4xx |
| Terminate → disable user + revoke sessions; authenticate status check | F13 | terminated token → 401; refresh fails |
| IDOR payout; SSE auth/cap; OTP atomic attempts; uniform auth errors | F14,F15,F16 | parallel-guess test capped at 5 |
| Leave scope + range cap; export builder fix + caps | F26,F28,F07 | export 300 rows → ≤ expected columns; 8000y range → 422 |
| Dependency upgrades (BE+FE); protect /docs; FE headers + proxy path sanitisation | F08,F09,F17 | npm/pnpm audit: 0 critical/high reachable; proxy `..` test |

## Phase 0b — Money correctness (weeks 1–3; ~4–6 pw)
- Payroll calculate/approve/pay in transactions with per-run advisory lock, FAILED state and retry (F18).
- Status guards + actor-from-JWT + distinct approvers + self-approval ban (F19,F29); freeze payslips after APPROVED; publish gate (F20).
- Fix bonus TDS TDZ, weekly periods, semi-monthly LOP, loan ledger, ISO-4217 table, per-currency rounding (F21,F22); GL mapping, mixed currency, HELD handling (F24).
- India pack rebuild with versioned slabs/EPF 25k/87A/surcharge+marginal relief/PT units + known-answer tests (F23). Gratuity, ECR/ESI/24Q, Form 16 are Phase 3.
- Remove or label fabricated reports/billing until backed by data (F25).

## Phase 1 — Reliability and test net (weeks 3–8; ~8–12 pw)
- CI: BE tests on Postgres service + deploy gate; FE Playwright on ephemeral stack; security regression suite; audit in CI (F41).
- Scheduler (accrual, year-end close, comp-off expiry, scheduled reports, cleanup) (F25,F30).
- Leave engine: conditional-status transactions, cancel-after-approval, half-day model, country resolution, holiday exact match (F27,F30).
- Attendance: bounded dates, per-tenant geofence, tz-aware calendar, overnight shifts (F31); overtime model feeding payroll (F32).
- Uploads/exports hardening; authz fixes for performance/search/announcements (F34,F37).
- FE: contract alignment via generated types; UI bug list; mobile payroll; confirmations (F38,F39).
- Ops: off-site encrypted backups + restore drill; Redis fail-fast; docs refresh (F40). Performance fixes (F36).

## Phase 2 — Table stakes (weeks 8–20; ~20–30 pw)
Scope resolver + field policy (fixes whole IDOR class); SSO OIDC→SAML + SCIM + passkeys/TOTP; developer platform (API keys, OAuth client-credentials with scopes mapped to the permission catalogue, cursor pagination, updated_since, versioned headers, structured errors, signed/retried/replayable webhooks + delivery log, sandbox); onboarding/offboarding + real FnF; shifts/roster/attendance policy/overtime; i18n + Arabic/RTL + Hijri; custom fields; DSAR + retention; audit middleware everywhere (F33,F35,F43).

## Phase 3 — Differentiate (months 5–9; 30+ pw)
Verified statutory packs with update feed and nationality-cohort predicates (India filings first; GCC after primary-source confirmation: Kuwait PIFSS/EOS, UAE WPS/gratuity, Saudi GOSI/Mudad/Qiwa); EOS calculator; SIF/WPS exporters; arrears/correction engine and projected-annual-tax; workflow engine; report builder; MCP server + governed AI agent identity with confirm-before-act; offline-capable mobile attendance/PWA; partner white-label console.

## Milestones and gates
| Gate | Criteria | Target |
|---|---|---|
| G0 Security | F01–F17 closed, regression suite green, secrets rotated | end week 2 |
| G1 Payroll trust | F18–F25 closed, known-answer tests (India) green, run-level chaos test (kill mid-calc) passes | end week 4 |
| G2 Engineering | CI gates deploys; ≥80% of routes covered by authz+tenant tests; backups restored in a drill | end week 8 |
| G3 Enterprise-ready | SSO/SCIM, API keys/webhooks, DSAR, audit coverage, third-party pen test | week 20 |
| G4 Market fit | Verified packs for target countries, workflow/report builders, AI governance | month 9 |

## Team and roles (suggested)
Backend lead (payroll/security), backend engineer (leave/attendance/platform), frontend engineer, QA/SDET (CI, e2e, security regression), part-time statutory SME per country (India CA/payroll consultant; GCC labour-law adviser), product owner. DevOps shared: backups, CI, secrets.

## Risks
1. Fix-while-live: production tenants exist; ship fixes behind tests, deploy with pre-deploy dumps (already in place), staged rollout.
2. Statutory uncertainty (GCC, India filings): block features on SME sign-off.
3. Test DB: no safe Hostinger test database exists today; create a dedicated `ems_test` DB (separate container/database, separate credentials, never the `ems` database) before CI is pointed at Hostinger.
4. Scope creep from competitor parity: keep Phase 2/3 scopes tied to customer-demand ranking.
