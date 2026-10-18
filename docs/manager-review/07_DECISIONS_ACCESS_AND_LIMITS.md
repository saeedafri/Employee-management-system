# Decisions, Access Matrix, Issues and Limits

## 1. Decisions needed
| # | Decision | Recommendation | Owner |
|---|---|---|---|
| D1 | Rotate GitHub PAT, Render key, Resend, Cloudinary, historical JWT secrets, OPS_LOGS_TOKEN; purge git history | Do today (only the account owner can) | Account owner |
| D2 | Provide a dedicated Hostinger test database (e.g. `ems_test`, separate DB user, separate from `ems`) and its connection details; allow the seed script against it | Create it; never point tests at `ems` | Platform owner |
| D3 | Lift/adjust the safety hook for the seed script ONLY when `DATABASE_URL` name contains `test` | Add an allow-condition rather than disabling the hook | Eng lead |
| D4 | Self-serve tenant registration vs sales-led | Gate immediately; decide long-term model | Product |
| D5 | Redis/BullMQ: docs say removed, code/env still reference it | Decide and align code + docs | Eng lead |
| D6 | Statutory advisers (India payroll, GCC labour law) | Engage before Phase 3 rules ship | Product/Finance |
| D7 | Approve Phase 0a/0b scope and owners | See 03 | Manager |

## 2. What is read-only vs what writes
| Area | Mode | Notes |
|---|---|---|
| Source code of EMS and ems-frontend | Read-only | No repo file was edited by any test/audit agent. Only new files are under `docs/` (this pack and the analysis doc), uncommitted |
| Hostinger server and database | **Not accessed** | No SSH, no tunnel (nothing listening on the tunnel port), no queries |
| Render / Vercel / any deployed API | **Not accessed** | |
| Production `ems` database | **Never touched** | The suite's guard refuses the `ems` name; the `.env` URL (127.0.0.1:15432, a tunnel to prod) was never used — runs used an explicit unreachable or throwaway-local URL |
| Offline test bucket | Read-only | Run with an unreachable DATABASE_URL; no DB/network |
| DB test bucket | Writes to a throwaway local Postgres (`ems_test_local`, scratchpad data dir) | Destroyed/stopped after; migrations applied there only |
| Earlier E2E and frontend walkthroughs | Writes to throwaway local databases only | Separate ports/dirs |
| Competitor research | Read-only | Public pages/docs/specs only; no logins; REA used passively on public pages |
| REA on own frontend build | Read-only | `.next/static` analysed in place |
| Local files written | scratchpad evidence, this folder, `docs/COMPETITIVE_ANALYSIS_AND_PLAN.md` | |
| Hostinger-side code paths that are read-only by design | Payout/bank data is encrypted (AES-256-GCM); audit log is append-only by convention (not tamper-evident) | See F33 |

## 3. Issues encountered
1. **No Hostinger test database could be identified.** The only Hostinger DB on record is the live `ems`; `.env.test` points at a local `ems_test`. Running the suite against `ems` would run destructive cleanup on production data, so it was not done.
2. **Safety hook blocks the seed script**, so the throwaway DB had no tenant `acme-corp-001`/users → 64 DB tests failed for environment reasons. Seeding via an alternative script that imports the seed was deliberately not used.
3. Hook also matched keywords inside report-writing commands (heredocs containing blocked words) — worked around by writing files with the file tool, not by evading the guard.
4. Local Postgres socket path too long on first start (fixed with a short socket dir).
5. Parallel local stacks collided on a scratch directory/ports; one stray request hit a foreign local server (health + one failed login). No data impact.
6. `tests/auth-register.test.js` and `tests/http-status-contract.test.js` default to the retired Render host; one e2e spec targets a Vercel host; the runner does not collect it.
7. Chrome extension was not connected; headless Chrome via playwright-core was used for the frontend walkthrough. REA could not recover modules from Turbopack output (partial coverage; grep used for the rest).
8. Several primary sources were unreachable (Kuwait/UAE/KSA/India government portals, G2/Capterra/Reddit) — statutory facts and review sentiment rely on secondary sources and are marked as such.
9. Agent-reported items not personally re-run by the lead reviewer are labelled SRC in the register.

## 4. Unverified / not done
- Backend DB test bucket against a seeded safe database; network bucket.
- Hostinger runtime behaviour (deployed config may differ from code).
- SSE, email invite/OTP delivery, real file upload storage, candidate pipeline, payout approvals in the real-stack UI walk.
- Authenticated and mobile apps of competitors (no authorised access).
- Primary-source confirmation of Kuwait/UAE/KSA/India law texts.
