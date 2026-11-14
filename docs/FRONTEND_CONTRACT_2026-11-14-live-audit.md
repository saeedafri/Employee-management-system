# Frontend contract — live UI audit, 2026-11-14

**For:** the UI team (`SAQIBJH/ems-frontend`)
**From:** backend (`saeedafri/Employee-management-system`). Follows `docs/FRONTEND_CONTRACT_2026-11-14.md`; items still open there are not repeated, except where this audit changes them.
**API:** `https://ems-api.saqibsaeed.cloud/api/v1` · full reference: `docs/API_MAPPING.md` → "2026-11-14 (round 3)" · Swagger at `/docs`
**How these were found:** a real browser drove the live site (frontend `99298cb`) for every role. It created a company through signup, activated each role from its real invite email, then opened every menu, tab and button, and ran the core workflows end to end.

The **UI status** column is empty on purpose. Fill it in (`done` / `in progress` / `won't do` + PR link), and add questions under each section.

Priority: **P1** = users hit a crash, a dead end or a security risk today · **P2** = wrong or confusing behaviour, or a backend feature waiting for UI · **P3** = polish.

---

## 1. Bugs in the frontend today

| # | P | Where | Problem | What to do | UI status |
|---|---|---|---|---|---|
| 1.1 | P1 | `src/modules/leave/components/NewLeaveRequestDialog.tsx:68` and `:193-217` | The Leave page crashed ("Something went wrong") as soon as type and dates were filled: the dialog reads `preview.data.errors.length`, and the live preview had no `errors`. The same dialog is used on the employee dashboard. **The backend now sends `errors`, `balanceBefore` and `balanceAfter` (section 2.2), so it works live.** | Read optional fields defensively (`preview.data.errors?.length`, `balanceAfter ?? '—'`), so a missing field can never take the page down again. | |
| 1.2 | P1 | `src/modules/leave/components/LeaveBalanceCards.tsx:14` | `const ME = 'emp-1'` is a mock ID. Every "View ledger" sends `employeeId=emp-1`: HR and super admin get `404`, managers `403`. Broken for every role. | Use the signed-in user's `employeeId`. Hide "View ledger" when the user has no employee record. | |
| 1.3 | P1 | `LoginForm.tsx:115`, `RegisterForm.tsx:78`, `SetPasswordForm.tsx:63` and `:245`, `ResetPasswordForm.tsx:98`, `ForgotPasswordForm.tsx:102` (all in `src/modules/auth/components/`) | The forms have `onSubmit` but no `method`. Submitting before the page finishes loading does a browser GET. Seen live: `/login?email=…&password=…`, which puts the password in history, server and CDN logs, and the Referer header. | Add `method="post"` to each `<form>`. Optionally keep the submit button disabled until hydrated. | |
| 1.4 | P1 | `src/lib/public-paths.ts:13` | `/signup` is missing from `PUBLIC_PATHS`. Opening it directly (bookmark, refresh, shared link) runs the start-up `/auth/me` 401 → `/login?next=/signup`. Only the in-app link works. | Add `'/signup'`. | |
| 1.5 | P1 | `src/modules/employees/components/EmployeeProfile.tsx` (header actions, ~`:325`) | "Resend invite" shows only for INVITED users. An employee with **no** account (e.g. created with the invite switch off) has no way to get one from the UI. | Show **"Send invite"** when the employee has no linked user (`user == null`) and call `POST /employees/:id/invite`. After success, offer the role change in 2.1 if they shouldn't be an Employee. | |
| 1.6 | P1 | `src/modules/employees/components/EmployeeFormStepper.tsx:419-428` (and the edit form) | "Reports to" is a text box wanting the manager's **internal database ID** ("Employee ID of their manager"). Typing a name returns `422 INVALID_MANAGER` "Manager not found in this organisation". | Replace it with an employee search picker (`GET /employees?search=`) that submits the selected `id`. | |
| 1.7 | P2 | Timesheets → My Timesheet → **History** | Crashed the page for employees (`403` on `/timesheets/audit`). **Backend fixed:** owners now get `200` with their own weeks, and the history is actually recorded (2.4). | Render an empty state, and show an inline error instead of the page error boundary when the call fails. | |
| 1.8 | P2 | Leave → **Team Calendar** tab (employee, auditor) | The tab is shown, then says "Access restricted". | Show the tab only with `can(user, 'leave:team-read')`. | |
| 1.9 | P2 | Employee profile tabs | The **Activity** tab shows "Access restricted" on your own profile. The **Leave** tab calls `GET /leave/policies` (`403` for employees). | Hide Activity without `can(user, 'audit:read')`. Have the Leave tab use `GET /leave/balance` for self-service. | |
| 1.10 | P2 | Employees list (AUDITOR) | Rows link to profiles the auditor can't open (`403` "Cannot view other employee data"). | Don't link rows unless `can(user, 'employees:read-any')` or it's the user's own row (see decision 4.3). | |
| 1.11 | P2 | Holidays → Add Holiday | Country is free text ("e.g. India"). Employees with no country or legal entity see only company-wide holidays, so a holiday tagged "India" shows to HR and **not** to employees ("0 holidays"). | Use a country select (ISO code). Under the field, say who will see it, e.g. "Only employees in India (company country not set)". | |
| 1.12 | P3 | `src/modules/settings/hooks/useResolvedSettings.ts:28` (via `SettingsProvider`) | Every page for an admin without a salary record fires `GET /payroll/employees/<me>/salary` → `404` (console error on each navigation). | Query only when `user.employeeId` is set, treat `404` as "no salary" with no retry (see 1.1 in the earlier contract). | |
| 1.13 | P3 | `EmployeeFormStepper.tsx:641-646` | The Role select shows the raw value `EMPLOYEE` until it's opened. | Render the option label in `SelectValue`. | |
| 1.14 | P3 | Settings → Billing → Plan | "Manage plan", "Add seats", "Upgrade" and "Contact sales" do nothing. | Hide them or mark "Coming soon". | |
| 1.15 | P3 | Settings → Leave Types | 12 icon-only buttons have no accessible name. | Add `aria-label` ("Edit Earned Leave", "Delete Earned Leave"…). | |
| 1.16 | P3 | Settings → Integrations → Email → "Copy webhook URL" | Unhandled promise rejection when the clipboard is refused. | Catch it, select the text instead, and toast "Press ⌘C to copy". | |

## 2. Backend changes that need UI

### 2.1 Change a user's role; Super Admin and Auditor accounts (P1)

Today the role dropdown offers only Employee, Manager and HR Admin (`EmployeeFormStepper.tsx:110`), and no screen can change a role after creation. The backend accepts all five at creation and now has a change endpoint.

```
PATCH /employees/:id/role                  (employees:write)
{ "memberType": "SUPER_ADMIN" | "HR_ADMIN" | "MANAGER" | "EMPLOYEE" | "AUDITOR" }
→ 200 { success, data: { userId, memberType, previous } }
  403 FORBIDDEN          — granting or removing SUPER_ADMIN needs permissions:manage (super admin); or it's your own role
  404 NOT_FOUND          — employee not in this company
  409 NO_ACCOUNT         — no login yet: send an invite first (1.5)
  409 LAST_SUPER_ADMIN   — the company must keep one active super admin
```
The user is signed out everywhere, so the new permissions take effect at their next sign-in. Say so in the confirm dialog.

| # | Task | UI status |
|---|---|---|
| 2.1a | Add **Auditor** to `MEMBER_TYPE_OPTIONS`, and **Super Admin** only when `can(user, 'permissions:manage')`. `POST /employees` already accepts both (HR creating a SUPER_ADMIN → `403`). | |
| 2.1b | Profile → "Change role" action (employees:write) with the select above and a confirm: "They'll be signed out and get the new access at next sign-in." | |
| 2.1c | Handle `409 NO_ACCOUNT` by offering "Send invite" (1.5), and show `409 LAST_SUPER_ADMIN` and `403` messages as returned. | |
| 2.1d | Permissions page: a "Members" list per role using the existing `POST /settings/roles/:key/users` and `DELETE /settings/roles/:key/users/:userId` (earlier contract 2.3). | |

### 2.2 Leave request preview now has the dialog's fields (live)

```
GET /leave/requests/preview?leaveTypeId=EL&startDate=2026-11-24&endDate=2026-11-24
→ 200 { data: { chargeableDays, calendarDays, weekendDays, holidayDays, holidaysExcluded[], workWeekDays,
                balanceBefore: number|null, balanceAfter: number|null, errors: string[] } }
```
`errors` lists **every** reason submit would refuse, in submit's order: `Leave type not found` · `Selected dates contain no chargeable working days (all weekly-offs/holidays)` · `No leave balance found for this leave type` · `Insufficient leave balance. Available: X, Requested: Y` · `Overlapping leave request exists`. Empty means submit will succeed. Submit returns the first of these as its error `message`, so the dialog and submit always agree. Balances are `null` when `leaveTypeId` is omitted.

| # | Task | UI status |
|---|---|---|
| 2.2a | Keep Submit disabled while `errors.length > 0` (already done through `blocked`), and show all messages, not just the first. | |
| 2.2b | Show `balanceBefore → balanceAfter`, and "—" when null. | |

### 2.3 Invites never drop the account (live)

`POST /employees` with `sendInvite: true` (and `POST /employees/:id/invite`) without `emailTarget` (what the form sends) go to Settings → Company Profile → "Send invites to". When that address is blank they **fall back to the other one**. An explicit `emailTarget` is honoured as-is. Before, a hire with no personal email got no account and lost their role. The response `invite.sentTo` (`WORK` or `PERSONAL`) is the address actually used. Without `emailTarget`, `NO_DELIVERY_EMAIL` can no longer happen, because the work email is required.

| # | Task | UI status |
|---|---|---|
| 2.3a | After create, toast with the real target: "Invite sent to their work email" / "…personal email". The old "No email on file…" warning (`EmployeeFormStepper.tsx:801-816`) only needs to cover `invite.sent === false`, which means the email provider failed. | |

### 2.4 Timesheet history (live)

```
GET /timesheets/audit?timesheetId=…&week=YYYY-MM-DD&employeeId=…
→ 200 { data: [ { id, timesheetId, weekStart, employeeId,
                  action: "WEEK_SUBMITTED" | "WEEK_RECALLED" | "WEEK_APPROVED" | "WEEK_REJECTED",
                  actor, at, comment? } ] }      newest first, max 200
```
Approvers (`timesheets:approve`) can read any employee. Everyone else always gets only their own weeks, whatever `employeeId` they pass. `ENTRY_*` actions are not recorded yet.

| # | Task | UI status |
|---|---|---|
| 2.4a | History panel: render these rows ("Submitted by …", "Approved by … — comment") and an empty state. | |

### 2.5 Company country at signup

`POST /auth/register` accepts optional `country` (ISO 3166-1 alpha-2, e.g. `"IN"`). Anything else → `422 VALIDATION_ERROR` (field `country`). It becomes the company country, which employees without a legal entity use for holidays (1.11). The response `tenant.country` echoes it.

| # | Task | UI status |
|---|---|---|
| 2.5a | Add a Country select to `RegisterForm.tsx` (default from the browser locale) and send the ISO code. | |
| 2.5b | Company Profile: make the company country required if it's empty, with the same explanation. | |

### 2.6 Review cycles: still not wired

`StartReviewDialog.tsx:124` hard-codes `<Button type="submit" disabled>`. `POST /performance/cycles` has been live since round 2 (earlier contract 1.3 and 2.1). Confirmed in this audit: "Start cycle" stays disabled with every field filled.

## 3. Behaviour changes and error codes

| Endpoint | Change | UI status |
|---|---|---|
| `GET/POST /leave/requests/preview` | New fields `balanceBefore`, `balanceAfter`, `errors[]` (2.2). | |
| `POST /employees`, `POST /employees/:id/invite` | Address fallback; `invite.sentTo` is the address used (2.3). | |
| `PATCH /employees/:id/role` | New: `403 FORBIDDEN`, `404 NOT_FOUND`, `409 NO_ACCOUNT`, `409 LAST_SUPER_ADMIN` (2.1). | |
| `GET /employees/next-code`, `POST /employees` | Codes are per company: a new company starts at `E0001`, and codes used by other companies are no longer refused (`409 DUPLICATE_EMPLOYEE_CODE` only means a clash inside this company). | |
| `GET /timesheets/audit` | `200` for every signed-in user (was `403` for employees) (2.4). | |
| `POST /leave/policies/:id/new-version` | Works on unsaved starter-pack rows (`pack-in`, `pack-global`…): saves the pack, then versions it → `201` (was `404`). No UI change needed; optionally label those rows "Starter pack (not saved yet)". | |
| `POST /auth/register` | Optional `country`; `422` if not two letters (2.5). | |

## 4. Decisions needed (product + UI + backend)

| # | Question | Options | Decision |
|---|---|---|---|
| 4.1 | The name typed at signup is discarded. The founder has no employee record, so the header shows only the email or its first letter. | (a) Create the founder's employee profile during onboarding: name, department, gets leave and payroll. (b) Add a display name to the user account (backend migration + header reads it). | |
| 4.2 | Invites default to the **personal** email, but password resets go to the **work** email. | Keep, or align both on one setting. | |
| 4.3 | Auditors can list employees but not open profiles. | (a) Read-only profiles for auditors (backend change). (b) No profile links for auditors (1.10). | |
| 4.4 | Reference numbers (`REG-`, `ATT-`, `LVR-`) come from one database-wide counter, so a new company's first regularization is `REG-0009`. | Per-company numbering needs a backend migration. Low priority. | |

## 5. Questions for the UI team

- Is `NEXT_PUBLIC_USE_MOCKS` off in every Vercel environment? (It is off in production: no service worker answered any API call during the audit.)
- Which items above do you want split into separate tickets?
