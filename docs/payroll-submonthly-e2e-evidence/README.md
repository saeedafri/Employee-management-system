# Sub-Monthly Payroll — E2E Evidence

Evidence pack for the **bi-weekly / semi-monthly / weekly** payroll backend contract on EMS.

## ⚠️ Evidence status

The request/response files describe the **authoritative API contract** and carry
**engine-computed expected values**. The pure payroll math (frequency-aware gross/tax,
`MONTHLY_TOTAL` apportionment, biweekly 3-cycle months, working-day patterns,
sub-monthly date resolution) was **verified directly** with a no-DB harness
(`/tmp/payroll_verify.mjs`, output in `E2E_SUMMARY.md`).

Full HTTP E2E against a database was **NOT executed**: the active `DATABASE_URL`
in `.env` points to **Render production**, and project safety policy forbids running
migrations/seeds/tests/E2E against it. Response files are marked
`"_evidenceStatus": "EXPECTED — pending local/test DB E2E"`. To finalise, switch
`DATABASE_URL` to a local/test DB and run `curl_sequence.sh` (see below).

## Files

| File | Purpose |
|------|---------|
| `UI_CONTRACT.md` | Frontend-facing contract: enums, period formats, payslip/cycle shapes |
| `E2E_SUMMARY.md` | Scenarios A–F + harness output (real computed numbers) |
| `curl_sequence.sh` | Ordered local-only curl sequence (never hits onrender.com) |
| `requests/01..11` | Sanitised request bodies (placeholders for ids/tokens) |
| `responses/08..17` | Expected responses with engine-computed values |

## How to run locally (safe)

```bash
# 1. Point DATABASE_URL at a LOCAL/TEST DB (NOT Render). Example .env line:
#    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ems_local"
# 2. Apply schema (LOCAL ONLY):
npx prisma migrate deploy            # applies 20260613200000_payroll_submonthly_biweekly
# 3. Seed a throwaway QA tenant "Submonthly Payroll QA Inc" (local seed).
# 4. Start the API locally:
npm run dev
# 5. Execute the sequence (edit BASE_URL/placeholders first):
cd docs/payroll-submonthly-e2e-evidence && bash curl_sequence.sh
# 6. Paste actual responses over the EXPECTED files and clear _evidenceStatus.
```

## Never commit
Access tokens, cookies, real bank data, or any Render/production connection string.
Use the placeholders: `<ACCESS_TOKEN>`, `<TENANT_ID>`, `<EMPLOYEE_ID>`,
`<PAY_GROUP_ID>`, `<PAYROLL_RUN_ID>`, `<PH_LEGAL_ENTITY_ID>`, `<PH_STATUTORY_PACK_ID>`.
