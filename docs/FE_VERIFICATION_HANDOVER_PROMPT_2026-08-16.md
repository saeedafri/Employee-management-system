# Handover prompt — for the backend AI agent

> Copy everything below the line into the agent's first message, alongside
> `docs/FE_VERIFICATION_BE_HANDOFF_2026-08-16.md`.

---

You are working on the EMS backend (Fastify + Prisma + Zod + Vitest), deployed at
`https://ems-api.saqibsaeed.cloud/api/v1`. The frontend team has returned a verification report on
your last delivery: **`docs/FE_VERIFICATION_BE_HANDOFF_2026-08-16.md`**. Your job is to work it.

## Rule zero — verify before you conclude. This overrides everything else.

**Do not trust any document, including this one and the report you are being handed. Do not trust
your memory, your prior session's summary, comments in the code, commit messages, or a status table
that says "Done ✓". Reproduce the behaviour yourself before you form a conclusion, and again before
you report one.**

This is not ceremony. On this exact workstream, confident-but-wrong claims have already been made by
**both** sides:

- The frontend asserted a "SUPER_ADMIN `authorize()` bypass" (their Findings D and F). Wrong —
  you pushed back with the code, and they withdrew both.
- The frontend diagnosed BE-10 as a header bug. Wrong — the real cause was the `302` to Cloudinary
  overwriting the headers.
- The frontend's first probe failed `POST /reports/export` on both casings and nearly reported your
  fix as broken. Wrong — they were sending `reportType: 'headcount'` instead of `workforce/headcount`.
  They caught it themselves before filing.
- Your own last handoff claimed BE-3 was fixed and proven on production. It is not fixed. Your
  35/35 and 55/55 runs both passed while the endpoint was still leaking.

That last one is the important lesson: **a green test run is not proof that the behaviour is
correct — it is proof that your assertion matched your implementation.** Both can be wrong together.
BE-3's checks passed because they never tested the one thing that mattered: whether a caller who
provably _could not have created_ a job could still see it.

### What "verify" means here, concretely

1. **Reproduce the reported behaviour first, before reading the explanation.** If you cannot
   reproduce it, say so and stop — do not fix a bug you have not seen.
2. **Drive it over real HTTP** against production or a real local stack with a real database, using
   the seeded logins. Unit tests with mocks prove nothing about integration on this workstream.
3. **Design the assertion to fail if the bug is present.** For scoping bugs, the test is not "does
   role X get a 200" — it is "can role X see a row that provably is not theirs". Construct the row,
   then look for it.
4. **Verify the fix the same way you verified the bug**, and re-run the original reproduction
   afterward. Confirm the output; do not infer it from the code you just wrote.
5. **Check the write path, not just the read path.** BE-3 is broken on both.

### Push back when the report is wrong

The frontend expects to be corrected and has been corrected twice. If a finding does not reproduce,
or their diagnosis is wrong, **say so with the evidence** rather than implementing a change that
makes a false claim look true. A wrong fix is worse than a rejected finding.

## What the report separates, and you must preserve

The report deliberately distinguishes three confidence levels. Do not flatten them:

- **Proven end-to-end** — BE-3's four export sites, NEW-1, NEW-2, NEW-3. Reproduced live, with the
  request/response transcripts included. Treat as real, but still reproduce them yourself.
- **Inspection only, explicitly not verified** — the other 20 `request.user.id` call sites (leave
  approver, timesheets config). The frontend states plainly that they could not confirm these,
  because `GET /leave/requests` does not serialize an approver field. **These are leads, not
  findings.** Investigate each; some may be harmless. Do not report them as fixed without evidence,
  and do not assume they are all broken.
- **Not testable from outside** — BE-7's rupee glyph, because no payslip exists on `acme-corp-001`.
  Unconfirmed, not disputed.

## The work

Priority order is in the report's final table. The single most important thing to understand:

**`request.user.id` does not exist anywhere in the codebase.** The JWT is minted with `sub`
(`auth.service.js:129`) and `middleware/authenticate.js:44` assigns the payload verbatim. There are
24 reads of `request.user.id` in `src/`, all `undefined`. `request.user.email` likewise.

For BE-3 specifically, note the trap the report calls out: **fixing only the read site at
`export.controller.js:184` will make things look fixed while being differently broken.** Because the
three write sites (`:14, :39, :64`) also passed `undefined` into a nullable column, every existing
`ExportJob.createdById` is `NULL`. Change only the read and non-privileged callers see _zero_ jobs.
Verify the column's actual contents in the database before choosing your fix, and decide explicitly
what happens to historical rows.

For NEW-1 and NEW-2, the report's claim is that `GET /settings/roles-permissions` and the minted
token disagree for the same role on the same tenant. Confirm that against both sources yourself
before changing a grant — if they genuinely disagree, the grant is the smaller half of the problem.

## Definition of done, per item

- The original reproduction no longer reproduces, demonstrated with the actual request and response.
- A test exists that **fails against the pre-fix code** — if it passes both before and after, it is
  not testing the bug.
- You state which of the three confidence levels above your evidence reaches.
- Anything you could not verify is listed as unverified, not quietly omitted or marked done.

Update `docs/FE_VERIFICATION_BE_HANDOFF_2026-08-16.md` in place with status per item, and reply with
what you fixed, what you rejected and why, and what you could not verify.
