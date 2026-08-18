# Backend verification of the frontend access-control audit

Target: **Hostinger production** — `https://ems-api.saqibsaeed.cloud/api/v1`
Deployed commit `0be46a7`, confirmed identical to local `HEAD` and confirmed
present inside the running container. Database read directly over an SSH tunnel.

Method: every frontend claim was re-derived independently — routes re-parsed from
source with my own extractor, grants read from the production `Role`/`Permission`
tables, and each status code re-probed live as each seeded role. Nothing below is
taken from their document.

---

## 1. Their audit is accurate

| Claim | Verified | Evidence |
|---|---|---|
| 420 routes parsed | ✅ | my extractor: **420** |
| 318 permission-keyed | ✅ | **318** keyed |
| 102 "authenticate alone" | ✅ (relabel) | 84 authenticate-only + 18 genuinely public (`/auth/*`) = 102 |
| Key counts 56 / 53 / 21 / 12 / 12 | ✅ exact | live tokens: SA 56, HR 53, MANAGER 21, EMPLOYEE 12, AUDITOR 12 |
| HR_ADMIN lacks `payroll:super`, `permissions:manage`, `settings:security` | ✅ | 403 on all three live |
| 6 settings panels wrongly SUPER_ADMIN-only | ✅ | HR_ADMIN gets **200** on integrations email/storage/webhooks, billing subscription/plans/invoices, and **200 on `PATCH /settings/branding`** |
| 2 panels correctly stay shut | ✅ | HR_ADMIN **403** on `/settings/security/auth` and `/payroll/country-bank-schemas` |
| MANAGER can't `POST /recruitment/openings` | ✅ | **403**; HR_ADMIN control **422** |
| MANAGER can't `GET /performance/calibration` | ✅ | **403** |
| `GET /timesheets/projects` is `timesheets:read`, not `timesheets:admin` | ✅ | source says `timesheets:read`; EMPLOYEE **200**. Their self-correction was right |
| `payroll:initiate` / `:adjust` / `:disburse` do not exist | ✅ | catalogue has exactly `payroll:admin, approve, export, self-read, super` |
| `payroll:approve` exists but no route enforces it | ✅ | **0 of 420** routes reference it |
| Every mutating payroll run route is `payroll:admin` only | ✅ | create, calculate, approve, mark-paid, cancel, publish, payment-batch, payslip edits — all `payroll:admin` |
| No `POST /performance/cycles` | ✅ | **404 for every role.** Their "fabricated success" finding stands |
| Custom role `FINANCE_MANAGER` exists | ✅ | `isSystem=false`, 13 keys |
| AUDITOR is served timesheets | ✅ | **200** on `GET /timesheets/projects` |

Also closed on production: the settings matrix and the minted token now agree
exactly for all four roles — `matrix-only [—] token-only [—]`. That was the
cross-tenant bleed I fixed in `32ef95d`.

---

## 2. One methodology correction for them

Their control line reads *"422 means authorisation passed and only the body was
rejected."* That is true **only when the guard sits in `onRequest`**. Fastify runs
schema validation *before* `preHandler`, so a route gated in `preHandler` returns
422 to an unauthorised caller with a bad body — the gate never runs.

`PATCH /settings/roles-permissions` is exactly that shape. With `{}` it returns
**422 to EMPLOYEE, MANAGER and AUDITOR**, which by their rule reads as "the
permission matrix write is ungated" — the worst possible false positive.

I re-probed with a schema-valid body naming a non-existent role (so nothing could
be written even if the gate were missing):

```
EMPLOYEE     403 FORBIDDEN
MANAGER      403 FORBIDDEN
AUDITOR      403 FORBIDDEN
HR_ADMIN     403 FORBIDDEN
SUPER_ADMIN  422 (reached the controller's own validator)
```

The gate holds. I raise it because I nearly reported it as a critical hole myself.

---

## 3. Four live bugs their audit could not see

Their method compares **UI gates to route guards**. All four of these have a
*correct* route guard and fail *below* it, in the service. Every one is reproduced
on production, with no data written.

### 3.1 🔴 Any employee can read any other employee's payroll data

`payroll:self-read` is held by **every role**. It guards 18 routes, but only 5
service functions apply the ownership helper `canAccessEmployeeRecord`.

Probed as `priya@acme.test` (plain EMPLOYEE) against HR Admin's employee record:

```
/salary            own 200   other 403   scoped
/payslips          own 200   other 403   scoped
/loans             own 200   other 403   scoped
/tax-form          own 200   other 403   scoped
/ytd               own 200   other 200   *** LEAKS ***
/tax-declaration   own 200   other 200   *** LEAKS ***
```

What priya actually received for HR Admin:

```json
{"fiscalYear":"2026-27","grossEarnings":180000,"taxableIncome":156600,
 "taxDeducted":13000,"totalDeductions":22000,"netPay":158000,"contributions":{"PF":2200}}
{"employeeId":"cmqjpydsb001mkpjdxlgw74tv","annualTaxableMinor":120000000,"regime":"IN_NEW_REGIME"}
```

Real salary and tax figures for another person. The fix pattern already exists in
the file — `assertLoanAccess` — it was simply never applied to `getYtd` or
`getTaxDeclaration`.

### 3.2 🔴 Any employee can overwrite any other employee's tax declaration

`POST` / `PATCH /payroll/employees/:id/tax-declaration` are guarded by the same
`payroll:self-read`, and `upsertTaxDeclaration(prisma, employeeId, tenantId, data)`
never compares `:id` to `request.user.employeeId`.

Proof without writing — priya POSTed with a **non-existent** employee id:

```
POST /payroll/employees/emp-does-not-exist-probe/tax-declaration → 500  P2003
```

`P2003` is a Prisma foreign-key violation, raised **at the INSERT**. The request
travelled through authorisation, past validation, to the database write. Only the
missing employee row stopped it. With a real id it would have succeeded.

### 3.3 🟠 `GET /payroll/reimbursement-claims` is tenant-wide, not self-scoped

As priya: **10 claims across at least 4 different employees**, including HR Admin
and the manager. Guard is `payroll:self-read`; there is no per-employee filter.

### 3.4 🟠 A MANAGER can finalise any employee's performance review

`PATCH /performance/reviews/:employeeId` is guarded by **`performance:read`** — a
read key, held by MANAGER — and `updateReview(tenantId, employeeId, data)` scopes
by tenant only, with no team check. The write sets `status: 'Calibrated'` and
`managerComplete: true`, and a calibrated review then rejects further edits (409).

Non-mutating proof — target employee has no review row, so 404 is guaranteed:

```
MANAGER  rating=Exceeds              404 NOT_FOUND  (cleared auth, hit tenant-wide lookup)
MANAGER  rating=not-a-valid-rating   422 VALIDATION_ERROR
EMPLOYEE rating=Exceeds              403 FORBIDDEN
```

45 real review rows exist in this tenant, including HR Admin's own in
`Manager review` status with no manager — a MANAGER could calibrate it with an
arbitrary rating and lock it.

Same shape, same cause, also writes behind a read key:

```
POST   /performance/goals                    performance:read     (any employeeId)
PATCH  /recruitment/candidates/:id/rating     recruitment:read
POST   /reports/export                        reports:read
```

---

## 4. Latent, not yet exploitable

`FINANCE_MANAGER` — the tenant's own custom role — holds **`permissions:manage`**
and `employees:delete`. `permissions:manage` is the key that rewrites the role
matrix, so any user assigned this role could grant themselves anything, including
`payroll:super`. **No user is currently assigned to it**, so nothing is exposed
today. It should not carry that key.

---

## 5. Answers to their open questions

| Their question | Answer |
|---|---|
| Payroll segregation of duties | Confirmed: one key (`payroll:admin`) authorises create, calculate, approve, mark-paid, cancel and publish. A frontend split would be theatre — they are right. Real SoD is backend work. |
| `payroll:approve` — dead key or unfinished intent? | Dead. In the catalogue, granted to HR_ADMIN and SUPER_ADMIN, enforced by **0 of 420** routes. Either wire it to `POST /payroll/runs/:id/approve` (that gives real SoD) or drop it. |
| Review-cycle creation | No route exists — `POST /performance/cycles` is 404 for every role. Their disabled-with-explanation fix is the honest state. Needs a backend endpoint specified. |
| AUDITOR timesheets | Backend genuinely serves them (`timesheets:read`, 200 live). Hiding the nav item is the right interim. |

---

## 6. What is NOT verified

- Their 270-code matrix and browser checks — their run, not reproduced here.
- Their vitest suite runs against MSW mocks; it proves nothing about this backend.
- I did not write any performance review, tax declaration or branding record on
  production. Every write probe used an invalid body or a non-existent id.

## 7. Reproduce

```bash
node probeProd.mjs         # 5 roles x 22 endpoints, live
node probeSelfSweep.mjs    # the cross-employee payroll leak
node probeScoping.mjs      # the performance-review scoping proof
node probeMatrix.mjs       # the preHandler/422 correction
```
