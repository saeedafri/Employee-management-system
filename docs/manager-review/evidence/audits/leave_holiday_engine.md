# Leave / Holiday / Timesheet / Attendance deep audit (read-only; pure-function script: t.mjs in this dir)
Reference behaviour: Frappe/Odoo/OrangeHRM (accrual per period, sandwich only between leave days, balance=ledger sum, approved-leave cancellation restores balance, atomic status transitions).

## HIGH
1. Year-end close never runs. engine/yearEnd.js `runYearEndClose` has zero callers (grep). No carry-forward, lapse, or comp-off expiry ever posts. CompOffRequest.expiryDate (leaveEngine.service.js:~420) is stored but nothing expires the COMP_OFF_EARNED credit.
2. Monthly accrual never runs after assignment. `catchUpAccrual` called only from autoAssign (leaveEngine.service.js:~228) with watermark:null; no job/cron (src/jobs has only submitReminderJob). Balance stops growing after the one-time catch-up. ANNUAL/QUARTERLY/anniversary rejected at write (validatePolicyRules).
3. Timesheet->payroll OT hand-off is always 0. payroll.service.js:1833 reads `t.overtimeHours`, but Timesheet (schema.prisma:1688) has no such column (OT is derived, timesheets.derive.js:19). Also the query (:1825) has no lower weekStart bound and swallows errors `.catch(()=>[])`. Input: approved week with 50h, std 40 -> expected otHours=10, actual 0.
4. Country hardcoded 'IN'. buildEmployeeContext (leaveEngine.service.js:15,~95) defaults country 'IN', workWeek Mon-Fri; leave.service.createLeaveRequest calls getBalancesForEmployee(prisma,tenant,emp) with no country, and no caller resolves it from legal entity. A UAE employee gets the IN policy (EL/SL/CL). Violates config-over-code. Also rulesForEmployee ignores `applicability` (employmentType/department/effectiveFrom/To); engine/applicability.js resolvePolicyForEmployee is dead code.
5. Double-approve race. leave.service.approveLeaveRequest:290-332: read status, then `update where {id,tenantId}` (no status predicate, leave.repository.js:241), then post RELEASE+TAKEN (non-atomic, no txn). Two concurrent approvals => two LEAVE_TAKEN rows (used doubled). LeaveLedgerTxn has no unique(sourceRef,type). Same pattern: approve/reject comp-off (:~440), timesheet decideTimesheet, regularization approve (attendance.service:319).
6. No cancel-after-approval. Only PENDING can be withdrawn (leave.service:420). Enum has CANCELLED but nothing sets it; no ledger REVERSAL path -> approved leave can never be restored.
7. Half-day/hourly impossible on the live path. LeaveRequest.totalDays and LeaveBalance.* are Int (schema:627,649); live path uses chargeableDaysBetween (whole days). engine/requestMath.js countChargeableDays (half-day, sandwich) is dead code.
8. Sandwich rule not applied live, and the dead implementation is wrong. Test: start Sat 2026-10-17 end Mon 10-19, sandwich on => returns 3, expected 1 (weekend not between leave days). Fri-Sun => 3, expected 1.
9. Calendar LATE classification uses UTC (attendanceCalendar.service.js:28 wallHHmm = toISOString().slice(11,16)). IST employee checks in 10:00 IST (04:30Z) vs lateAfter 09:30 => WORKED not LATE; US/EST 09:00 (14:00Z) => always LATE. Timezone resolved (ctx.timezone) but unused here.
10. Approved regularization has no effect on calendar/LOP. attendance.service:342 only sets status=PRESENT via updateMany (no-op if no row; checkIn/totalMinutes untouched); buildCalendar ignores `status`, uses checkInAt only -> day stays ABSENT/isLop. Silent success when no record exists.

## MEDIUM
11. Encashment (leaveEngine.service.js encash): no balance check; days=-5 passes schema (type number) -> computeEncashment returns amount -5000, delta=-(-5)=+5 (grants leave). Test T19. encash can drive available negative though negative balance is "hard-blocked".
12. Self-approval gaps: assertCanApprove returns early for HR/SA (approvalGuard.js:20) so HR can approve own leave/timesheet; assertCanReviewRegularization (attendance.service:309) has no self check at all (manager/HR approve own); comp-off approve/reject uses only canApproveLeave, no subject/manager scoping.
13. Holiday country match substring bug (utils/applicability.js:21-24): `loc.includes(name)||name.includes(loc)`. RO employee gets 'Oman' holidays, NG gets 'Niger', IN gets 'Indiana' (T21, all return 1). Conversely 'UAE','USA','Czech Republic' don't match AE/US/CZ (Intl names differ).
14. Fiscal leave-year labelling mismatch: accrual.js mkAccrual leaveYear = calendar year of effectiveDate; resolveLeaveYear labels FISCAL by start year. Apr26-Mar27 accruals labelled 2026 and 2027 (T9).
15. UPFRONT opening grant not prorated for mid-year joiners (autoAssign og-: full annualQuota); probation-blocked UPFRONT never granted later (no job). Accrual ignores probationDays. BY_MONTH proration identical to BY_DAY for partial months (proration.js:19).
16. Overnight shift: checkOut resolves "today" in tz (attendance.service:92); check-in 22:00 D, out 06:00 D+1 => NO_CHECK_IN. checkIn accepts client `date` (backdating unbounded). Check-out overwrites check-in note with null. Geofence uses hardcoded Delhi coords (:52) and is not enforced.
17. Missed checkout not flagged: calendar HALF_DAY only if totalMinutes!=null; past day with check-in only => WORKED.
18. Timesheet: entry.date not validated to fall inside sheet week; weekStart not validated as Monday/work-week start (toWeekBounds repo:96 uses local setDate, DST-unsafe on non-UTC server); weekly-only OT, no daily OT, no leave/holiday deduction from standard hours; decideTimesheet has no status predicate (race).
19. Team weekly grid uses tenant work-week for all members while holidays are per-employee (attendance.service:428) -> mixed Fri-Sat/Sat-Sun teams mis-coded; N+1 resolver (4+ queries/employee).
20. No blocked periods, gender/tenure eligibility, notice period, max-consecutive, or half-day leave anywhere (grep). Overlap check and balance check are not atomic with create (leave.service:176-230): two simultaneous requests can overdraw.

## LOW / design notes
- foldBalance: REVERSAL(+) inflates `granted` and leaves `used` (T14); comment says TAKEN cancels a hold, code requires explicit RELEASE (T13); double RELEASE silently clamped (T15 hides race 5).
- Accrual excludes a period ending on asOf (T7): last-day-of-month balance omits that month. Cap compares only against balanceBefore+this run.
- Observed-date shift ignores collisions with another holiday; resolveEmployeeHolidays clips shifts across Dec31/Jan1 (query bounded to year).
- Floating/lunar/Hijri: not modelled; data-driven per-year rows (acceptable), no validation.
- Legal: manager change mid-request handled correctly (guard evaluated at decision time).
- resolveLeaveYear uses local getFullYear/getMonth while rest uses UTC; today() is UTC (probation/opening date off by a day for tz != UTC near midnight).

## Test vectors (run: node t.mjs)
T1 sandwich Sat-Mon exp 1 act 3 | T2 Fri-Sun exp 1 act 3 | T5 join 2026-03-16 rate2 BY_DAY exp 1.03,2,2 ok | T10 exit 06-10 last=0.67 ok | T13 hold+taken no release pending=2 | T14 reversal granted 12/used 2 | T17 closing -3 -> [] | T19 days -5 amount -5000 | T21 RO/Oman=1 NG/Niger=1 IN/Indiana=1.
Expected-per-rule (derive): accrual idempotent by id acc-emp-type-date (ok, skipDuplicates); ledger fold ok for plain accrue/hold/release/taken; year-end CARRY cap 5 of 8 -> +5 carry, -3 expired (ok but uncalled).
