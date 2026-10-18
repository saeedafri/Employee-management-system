# Gap Analysis and Remediation

Legend: Finding IDs refer to `01_FINDINGS_REGISTER.csv`. Verification: LIVE = reproduced against a running local stack; ME = re-confirmed in source by the lead reviewer; SRC = source reading by an audit agent; SEC = package-registry/secondary source.

## A. Security and tenancy gaps
| Gap | Why it exists | How to close | Done when |
|---|---|---|---|
| Rate limit / CORS / helmet inert (F01,F02) | Plugins registered without `fastify-plugin`, so hooks stay in an encapsulated child; per-route limits placed outside `config` | Wrap plugins with `fp()`; `config:{rateLimit}`; `trustProxy`; lockout counter | Inject test: 6th login 429; headers on every route |
| No central tenant-FK validation (F10,F11,F12) | Each endpoint trusts ids in bodies; updates by id only | `assertSameTenant()` helper called by validators; lint rule/test that every `update/delete where` includes tenantId; Zod allowlists | Scripted 362-route sweep returns 4xx for all foreign ids |
| Role administration escalation (F03) | `settings:manage` can mint roles with any keys | Caller can grant only keys it holds; tenant-check users; audit | Test with HR role creating `payroll:super` → 403 |
| Open registration + ops endpoints (F05,F06) | Self-serve onboarding without gating; ops log query not tenant-scoped | Invite/approval-based tenant creation; ops routes limited to platform operators with header token | Anonymous register blocked; ops shows only authorised scope |
| Secrets in git (F04) | `.mcp.json`/`.codex/config.toml` tracked before gitignore | Rotate, untrack, purge history, secret-scan hook in CI | gitleaks clean |
| Session lifecycle (F13,F15,F16) | No user/employee status check; SSE bypasses authenticate; OTP counter not atomic | Check status in authenticate; terminate revokes sessions; SSE ticket; atomic counters | Terminated token 401; parallel guess capped |
| Vulnerable dependencies (F08,F09) | Not audited in CI | Upgrade, replace expr-eval, `audit` gate in CI | 0 reachable critical/high |
| Frontend headers/proxy (F17) | No CSP/HSTS; proxy joins raw segments | Header config; normalise/allowlist proxy paths | `%2e%2e` test returns 4xx |

## B. Correctness gaps (money and time)
| Gap | Root cause | Fix | Done when |
|---|---|---|---|
| Payroll run integrity (F18–F20,F24) | No transactions, no state-machine guards, edits after approval | Transactional calculate with advisory lock and FAILED state; guard approve/pay/cancel; freeze payslips | Chaos test (kill mid-calc) leaves recoverable state; PAID slip edit → 409 |
| Tax/proration bugs (F21,F22) | TDZ in bonus tax with swallowed catch; period parsing; LOP denominator; currency table | Fix + remove empty catches + known-answer tests per currency/period type | Tests for bonus/arrears/weekly/semi-monthly/KWD/IQD |
| India statutory output (F23) | Seed slabs wrong; rebate/surcharge/EPF/PT logic missing | Versioned rule data with citations; rebuild pack; adviser sign-off | Adviser-approved golden cases pass |
| Gulf statutory (see 05 §11) | Engine lacks nationality predicates, EOS calculator, SIF/WPS | Engine features first, rules after primary-source confirmation | Golden cases per country signed by adviser |
| Leave/attendance engines (F27–F32) | Jobs never scheduled; races; hard-coded country; int-only days | Scheduler; conditional updates in transactions; numeric day model; per-employee country; bounded dates | Property tests + race tests |
| Reports not real (F25) | Placeholder aggregates | Back by real queries or hide | No fabricated figure reachable from UI |

## C. Product gaps (vs competitors)
Missing: SSO/SCIM, API keys + signed webhooks + public docs, onboarding/offboarding workflows, shift/roster/attendance-policy/overtime, biometrics/selfie attendance, approval workflow builder, custom fields, report builder, i18n/Arabic/RTL/Hijri, GCC EOS + WPS/SIF exports, accounting exports, mobile/PWA, AI assistant/MCP. Ranking by customer demand and the competitor feature matrix is in 05 (§4, §13). Delivery order in 03 (Phase 2/3).
Differentiation levers supported by evidence: transparent pricing; versioned statutory rules as data with fast update cadence; GCC depth + Arabic; offline-capable attendance and payroll pre-run variance/unlock (top complaint themes); governed AI agent identity; white-label multi-tenant.

## D. Process and engineering gaps
| Gap | Fix |
|---|---|
| No safe test database for DB tests (64 blocked) (F47) | Create dedicated `ems_test` database (separate credentials, never `ems`) on Hostinger or CI Postgres service; seed script runnable only against it |
| Deploy not gated on tests; no FE e2e/CI (F41) | CI pipeline: BE offline+db, FE unit+Playwright, `pnpm/npm audit`, secret scan, REA bundle gate (checks listed in 06) |
| Tests missing for announcements, assets, billing, logs, notifications, recruitment, reports, search | Add module + tenant-isolation negative tests |
| Network tests hard-coded to retired host | Point to env var; exclude from default run |
| Docs stale (Render/Redis, route counts) (F40) | Refresh CLAUDE.md/BACKEND_STATUS; generate API_MAPPING from route manifest |
| Backups same-host only, no restore drill (F40) | Off-site encrypted backups; quarterly restore drill |
| FE/BE contract drift (F38,F44) | Generate FE client from BE schemas; CI diff of URL+verb |
