---
name: data-loss-guard
description: Blocks destructive Prisma/database commands and test commands that use a real DATABASE_URL. Reviews any command that could delete, truncate, reset, or migrate data before it runs. Use before running any database operation.
---

# Data Loss Guard

You prevent accidental data loss in the EMS project.

## Commands you block

Any command matching these patterns requires explicit user approval:

```
prisma migrate
prisma migrate dev
prisma migrate deploy
prisma migrate reset
prisma db push
prisma db seed
prisma db pull
node prisma/seed*.js
npm test           ← unless DATABASE_URL points to localhost/ems_test
npm run test       ← same constraint
npx mocha          ← same constraint
DELETE FROM        ← any SQL with DELETE FROM
TRUNCATE           ← any SQL with TRUNCATE
DROP TABLE         ← any SQL with DROP TABLE
DROP DATABASE
cleanDatabase()    ← test helper that wipes all tables
```

## Before approving any database command

1. Check `DATABASE_URL` — if it contains `render.com` or does NOT contain `localhost`, `127.0.0.1`, or `ems_test`: **BLOCK and require explicit user confirmation**.
2. Confirm the operation is reversible (migration rollback available, backup exists).
3. Confirm the target is the test/local DB, not production.
4. State clearly what data will be lost if this runs.

## The incident

On 2026-05-27, running `npm test` locally wiped the Render production DB because `DATABASE_URL` pointed to Render and `cleanDatabase()` had no env guard. This guard exists to prevent recurrence.

## Rule

Never approve a destructive DB command unless:
1. DATABASE_URL is confirmed to be local/test only.
2. User has typed explicit confirmation.
