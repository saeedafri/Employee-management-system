# BE-1 — Per-Employee Monthly Attendance Calendar (build-ready contract)

> **Audience:** backend team (separate repo).
> **Status: ✅ BUILT — 2026-06-25.** Both endpoints are live in `attendance.routes.js`
> (`GET /attendance/calendar` + `GET /employees/:id/attendance/calendar`). The classifier is
> transcribed verbatim from the FE engine into `src/modules/attendance/attendanceCalendar.service.js`
> (`buildCalendar`), wired to the **shared holiday resolver** (same off-days as `GET /me/holidays`),
> the employee's resolved work-week + timezone, and tenant attendance-rules thresholds. When the
> FE points at it, its client-engine fallback stops firing with **no app-code change**.
>
> **Implementation map (this contract → code):**
> - §1 endpoints → `attendance.routes.js` (`/attendance/calendar`, `/employees/:id/attendance/calendar`); controllers `getMyAttendanceCalendar` / `getEmployeeAttendanceCalendar`.
> - §4 per-day precedence + §5 summary math → `attendanceCalendar.service.js#buildCalendar` (PURE).
> - §4.1 wall-time LATE parity → compares the `[11,16)` HH:mm slice of the emitted `checkInAt` ISO string (same basis the FE reads back).
> - §6 config (work-week / timezone / thresholds) → `holidayResolver.service.js#resolveEmployeeHolidayContext` (now also returns `timezone` + `hoursPerDay`) + `settings.repository.js#getAttendanceRules`.
> - §3 record passthrough → `attendance.repository.js#getAttendanceRecords`; leave paid-ness → `getApprovedLeavesForEmployee`.
> - §7 errors → `401` auth, `403`/`404` via shared `assertCanViewEmployee`, `422 VALIDATION_ERROR` (`error.details[]`) on bad/missing `month`.
> - Tests → `tests/attendance-calendar.test.js` (precedence + summary, `node --test`, green).
>
> **Why this is precise:** this endpoint's whole purpose is to make the backend the single
> source of truth and kill FE/BE drift. So the classification algorithm below is the FE
> engine transcribed verbatim (`src/modules/attendance/engine/classifyDay.ts`,
> `classifyMonth.ts`, `utils/contextResolve.ts`). **Match it exactly** — a different rule
> re-introduces the drift this endpoint exists to remove.

---

## 1. Endpoints

| Method | Path                                               | Who                                                    |
| ------ | -------------------------------------------------- | ------------------------------------------------------ |
| GET    | `/attendance/calendar?month=YYYY-MM`               | self (EMPLOYEE and up)                                 |
| GET    | `/employees/:id/attendance/calendar?month=YYYY-MM` | MANAGER (their team) · HR_ADMIN / SUPER_ADMIN (anyone) |

- Casing: **camelCase** (matches the FE types).
- `month` is `YYYY-MM`. Resolve the calendar for **that employee** (self = caller's employee;
  `:id` = the target). Mirrors the existing `/me/holidays` · `/employees/:id/holidays` pattern.

## 2. Success response (200)

```jsonc
{
  "success": true,
  "data": {
    "month": "2026-06",
    "days": [
      {
        "date": "2026-06-01", // YYYY-MM-DD, every calendar day of the month, ascending
        "weekDay": "MON", // SUN|MON|TUE|WED|THU|FRI|SAT (UTC-anchored from date)
        "bucket": "WORKED", // see §4 enum + rules
        "holidayName": null, // string when bucket=HOLIDAY, else null
        "leaveType": null, // string when bucket=PAID_LEAVE|UNPAID_LEAVE, else null
        "isLop": false, // true ONLY for an attendance-owned ABSENT day (§4.5)
        "record": null, // AttendanceRecord for the day, or null (§3)
      },
      // ... one entry for EVERY day in the month (28–31 entries), sorted ascending
    ],
    "summary": {
      "totalDays": 0, // elapsed WORKING days = present+wfh+late+halfDay+absent (§5)
      "present": 0, // count of WORKED
      "wfh": 0,
      "late": 0,
      "halfDay": 0,
      "leave": 0, // PAID_LEAVE + UNPAID_LEAVE
      "absent": 0,
      "holiday": 0,
      "weeklyOff": 0,
      "attendancePercentage": 0, // integer 0–100 (§5)
    },
    "lopDays": ["2026-06-12"], // YYYY-MM-DD of every ABSENT (isLop) day
  },
  "meta": {},
}
```

## 3. `record` — the day's AttendanceRecord (or null)

Same object `GET /attendance/records` already returns for that day, or `null` if none:

```jsonc
{
  "id": "string",
  "referenceNo": "string|undefined",
  "attendanceDate": "ISO string",
  "checkInAt": "ISO string | null",
  "checkOutAt": "ISO string | null",
  "status": "PRESENT|ABSENT|LATE|HALF_DAY|WFH|LEAVE|HOLIDAY|WEEKLY_OFF", // raw stored status
  "workMode": "OFFICE|WFH|HYBRID|FIELD | null",
  "totalMinutes": 0, // number | null
  "notes": "string | null",
}
```

> The `bucket` is the **reconciled** classification (§4) and may differ from `record.status`
> (e.g. a checked-in day that is also an approved holiday → `bucket:"HOLIDAY"`). The reconciled
> bucket wins; `record` is passed through untouched for the day-detail drawer.

## 4. Per-day classification — strict precedence (transcribe exactly)

For each day, evaluate **in this order** and stop at the first match
(`classifyDay.ts`). The inputs are: the resolved **holiday set**, the resolved
**workWeekDays**, the employee's **approved-leave spans**, the day's **attendance record**,
the resolved **thresholds**, and **todayKey** (today in the employee's resolved timezone).

1. **HOLIDAY** — the day is in the employee's resolved holiday set →
   `bucket:"HOLIDAY"`, `holidayName = <name>`, `isLop:false`.
   _Holiday wins over weekly-off and leave_ — a holiday on a non-working day is still HOLIDAY.
   Use the **same resolved holidays** as `GET /me/holidays` (country-scoped, observed-shifted,
   optional-selection applied) — match by `holidayDate` date-only.
2. **WEEKLY_OFF** — the day's weekday ∉ `workWeekDays` → `bucket:"WEEKLY_OFF"`, `isLop:false`.
3. **PAID_LEAVE / UNPAID_LEAVE** — an approved-leave span covers the day (inclusive,
   date-only `start ≤ day ≤ end`) → `bucket = paid ? "PAID_LEAVE" : "UNPAID_LEAVE"`,
   `leaveType = <leave type name>`, `isLop:false`. Paid-ness comes from the leave **type**
   (`isPaid`); if the type is unknown, **default to paid**. Leave is leave-owned — never LOP.
4. **Worked family** — the record has a `checkInAt`, evaluate in this sub-order:
   1. `totalMinutes != null && totalMinutes < halfDayMinutes` → `HALF_DAY`
   2. else `workMode === "WFH"` → `WFH`
   3. else `wallTime(checkInAt) > lateAfter` → `LATE` ⟵ **see §4.1, parity-critical**
   4. else → `WORKED`
      All `isLop:false`.
5. **ABSENT** — a **strictly-past** working day (`day < todayKey`) with **no check-in and no
   leave** (and not a holiday/weekly-off, already handled) → `bucket:"ABSENT"`, `isLop:true`.
6. **UPCOMING** — today or a future working day, not yet worked → `bucket:"UPCOMING"`, `isLop:false`.

### 4.1 `wallTime` for LATE — parity-critical

The FE computes LATE by taking the **literal `HH:mm` substring at positions 11–16** of the
`checkInAt` string and string-comparing it to `lateAfter` (`"HH:mm"`) — it does **not**
timezone-convert. Whatever wall-time basis `checkInAt` is stored in is what gets compared.
**The backend must use the same wall-time basis** so FE-fallback and BE agree (this is the
BR-ATT-2 class of bug — be explicit about whether `checkInAt` is UTC or local and compare
consistently). If your stored `checkInAt` is local wall-time, compare its `HH:mm` directly.

## 5. Summary math (transcribe exactly — `classifyMonth.ts`)

Counts over all days: `present=WORKED`, `wfh=WFH`, `late=LATE`, `halfDay=HALF_DAY`,
`leave=PAID_LEAVE+UNPAID_LEAVE`, `absent=ABSENT`, `holiday=HOLIDAY`, `weeklyOff=WEEKLY_OFF`.
**UPCOMING is not counted anywhere.**

```
totalDays          = present + wfh + late + halfDay + absent      // elapsed WORKING days only
workedEquivalent   = present + wfh + late + 0.5 * halfDay
attendancePercentage = totalDays === 0 ? 0 : round(workedEquivalent / totalDays * 100)
lopDays            = [every ABSENT day's date]
```

> `totalDays` deliberately **excludes** leave, holiday, weekly-off, and upcoming — it is the
> denominator of the attendance %, i.e. only days the employee was expected to work and that
> have already elapsed.

## 6. Config resolution (`contextResolve.ts`) — where the inputs come from

Resolve per employee, layered **entity → tenant rules → defaults** (never throw):

- **workWeekDays**: legal-entity `workWeekDays` → tenant/attendance-rules `work_week_days`
  → fallback `["MON","TUE","WED","THU","FRI"]`. Tokens `SUN…SAT`.
- **timezone** (for `todayKey`): entity timezone → tenant timezone → (FE: browser). The
  server should use the **employee's resolved timezone** to compute "today" so the
  ABSENT-vs-UPCOMING boundary is correct.
- **thresholds** (from attendance-rules, snake_case; `hoursPerDay` from entity → fallback 8):
  - `fullDay = round(hoursPerDay * 60)`
  - `lateAfter = rules.late_after || "09:30"` (a blank string also falls back)
  - `halfDayMinutes = rules.half_day_threshold_minutes ?? round(fullDay / 2)`
  - `fullDayMinutes = rules.full_day_threshold_minutes ?? fullDay`

## 7. Errors

- `401` — unauthenticated.
- `403` — caller requests `/employees/:id/...` for an employee they may not view (a MANAGER
  outside their team, or an EMPLOYEE targeting someone else).
- `404` — `:id` employee does not exist.
- `422 VALIDATION_ERROR` — `month` missing or not `YYYY-MM` (`error.details[]`).

## 8. Edge cases / notes

- **Empty month (no records):** classify honestly — every strictly-past working day with no
  leave/holiday becomes `ABSENT`/`isLop`. Do **not** special-case "employee has zero records"
  into a blank month; that "no data → show dashes" choice is a **frontend display** concern
  (the FE checks `records.length === 0` itself) and must not change the endpoint's output.
- **Full month always returned:** `days[]` has one entry per calendar day (including holidays,
  weekly-offs, and future days as `UPCOMING`), ascending by date.
- **camelCase** throughout `data` (the attendance-rules _source_ is snake_case, but this
  response is camelCase like the rest of the attendance read endpoints).
- The backend already has a per-day classifier for the team-weekly grid
  (`attendance.service.js` → `P/W/H/A/L` using resolved work-week + the holiday engine).
  BE-1 reuses that, **adding** the finer buckets (`LATE`, `HALF_DAY`, `UPCOMING`,
  paid-vs-unpaid `LEAVE`) + the `attendancePercentage`/`isLop` rules above.

## 9. FE references (source of truth for this contract)

- `src/modules/attendance/engine/classifyDay.ts` — per-day precedence (§4)
- `src/modules/attendance/engine/classifyMonth.ts` — summary math (§5)
- `src/modules/attendance/utils/contextResolve.ts` — config + thresholds (§6)
- `src/modules/attendance/engine/types.ts` — `DayBucket`, `EngineSummary`,
  `AttendanceCalendarDay`, `AttendanceCalendarData`
- `src/modules/attendance/services/attendance.api.ts` — `getCalendar` (the consumer)
- `src/mocks/handlers/attendance.ts` — the MSW handler that computes this shape today
