# OSS HRMS internals vs EMS
Clones (shallow, read-only) in scratchpad/oss/: hrms (Frappe), horilla, orangehrm, odoo (sparse: hr, hr_holidays, hr_attendance, hr_work_entry, hr_recruitment, hr_expense, hr_timesheet), jorani, icehrm, Sentrifugo. Note: Odoo hr_payroll/hr_contract are Enterprise, not in community repo; Odoo payroll internals not available. IceHrm/Sentrifugo are legacy PHP, no real payroll engine; skimmed only.
EMS baseline: 77 Prisma models; payroll (SalaryComponent w/ FORMULA, PayGroup, EmployeeSalary, PayrollRun, Payslip w/ JSON lines, StatutoryPack, TaxDeclaration, EmployeeLoan, Garnishment, PayoutMethod), leave engine (LeavePolicy JSON rules, LeaveLedgerTxn, accrual/encashment/yearEnd/proration), no generic approval-workflow engine, no custom fields, no webhooks table (only integrations.service), formula = regex + new Function (src/utils/formulaEval.js).

## Frappe HRMS (hrms/hrms/...)
Payroll
- payroll/doctype/salary_slip/salary_slip.py (2844 lines): formula+condition per salary_detail row evaluated against a data dict (get_data_for_eval L1449, eval_condition_and_formula L1474) with whitelisted globals; salary_detail flags worth copying: depends_on_payment_days, statistical_component, do_not_include_in_total, is_tax_applicable, exempted_from_income_tax, variable_based_on_taxable_salary, amount_based_on_formula, year_to_date, additional_amount/tax_on_additional_salary.
- Tax: compute_taxable_earnings_for_year (L1060) = YTD actuals + projected future periods; income_tax_slab + taxable_salary_slab with python condition; employee_tax_exemption_declaration -> proof_submission (two-stage, declaration then proof); get_opening_for (L2084) = opening YTD for mid-year joiners/migration.
- Arrears: arrear + payroll_correction doctypes (earning_arrears/deduction_arrears/accrual_arrears child tables, days_to_reverse) - corrections are first-class docs posted into a later slip, not mutated slips.
- additional_salary (one-time/recurring, with from/to dates, overwrite flag), salary_withholding (+cycle), employee_benefit_claim/ledger (flexible benefits), gratuity_rule + gratuity_rule_slab, overtime_slip/overtime_type, retention_bonus, payroll_period, payroll_entry (batch, per-employee failure isolation), salary_structure_assignment (dated, per-employee base + variable), bulk_salary_structure_assignment.
- F&F: hr/doctype/full_and_final_statement: payables/receivables lines pulled from assets, advances, loans, withheld slips, leave encashment; journal entry on settle.
Leave
- leave_ledger_entry (append-only: leaves +/-, from/to date, is_carry_forward, is_expired, is_lwp, transaction_type/name) is the balance source of truth; expiry = ledger rows; cancelled only for expired rows. EMS LeaveLedgerTxn already similar.
- leave_policy -> leave_policy_assignment (dated, per employee/period; leave_control_panel bulk-assigns) -> leave_allocation. earned_leave_schedule doctype pre-materialises the whole year's accrual schedule per allocation (calculate_leaves_for_passed_period L269, cap_schedule_to_annual_allocation L407) so backfill, join-mid-year and audits are deterministic.
- leave_type flags: is_earned_leave + earned_leave_frequency, allocate_on_day, rounding (0.25/0.5/1), max_continuous_days_allowed, applicable_after, include_holiday, is_compensatory, is_optional_leave, is_lwp/is_ppl, allow_over_allocation, expire_carry_forwarded_leaves_after_days, encashment fraction_of_daily_salary_per_leave + earning_component + non_encashable_leaves. leave_block_list (blackout dates), compensatory_leave_request, department_approver, leave_adjustment.
Attendance
- shift_type.py: process_auto_attendance (L165) groups employee_checkin logs, thresholds for absent/half-day, enable_entry_grace_period, early-exit, last_sync_of_checkin cursor (idempotent biometric sync), process_auto_attendance_for_all_shifts as scheduled job; shift_assignment (dated), shift_request, shift_schedule(+assignment) rotas, attendance_request, employee_checkin with log_type + device_id.
Workflow/permissions/other (Frappe framework): generic Workflow doctype (states, transitions with role + condition), DocPerm + user permissions (record-level filters), custom fields, Webhook doctype, Notification doctype with conditions, Auto Email Report, Report Builder, translation via _() strings in .po, RTL via CSS, multi-company via `company` Link on every doc.
Pitfalls: salary_slip.py god class (2.8k lines, L1060-1330 tax path hard to test); _safe_eval (payroll/utils.py L139) explicitly a denylist sandbox only for trusted admin formulas; whole-year tax projection recomputed per slip is slow for bulk; leave balance by summing ledger per query needs caching; many docstatus/cancel-amend states make payroll reversal complex.

## Horilla (Django)
- payroll/methods/: component_engine.py, structure_rules.py, proration.py (period_factor/flat_amount), payslip_calc.py (1398), tax_calc.py, contributions.py, employer_cost.py, batch_run.py, payslip_edit.py. Models: Allowance/Deduction (conditional via MultipleCondition/ApplyCondition L1456-1494: field/op/value rules per employee attribute - a data-driven rule engine, no code), Contract, FilingStatus, LoanAccount, Reimbursement, PayslipAutoGenerate, EncashmentGeneralSettings.
- Attendance: AttendanceLateComeEarlyOut, GraceTime, AttendanceValidationCondition, AttendanceOverTime, AttendanceConflictResolution, batch attendance; biometric/ has Anviz, COSEC, Dahua, eTimeOffice connectors; geofencing/ app; facedetection/.
- horilla_automations (MailAutomation on model-field triggers), dynamic_fields (DynamicField/Choice custom fields), LeaveRequestConditionApproval (multi-level approval), request_and_approve.py, horilla_audit, horilla_company_manager.py (row-level company scope, like EMS tenantId).
PITFALL (major): payroll/methods/safe_tax_code.py docstring - FilingStatus.python_code ran bare exec() = CWE-94 RCE; fixed by AST allowlist + thread timeout (TaxFormulaTimeout). Also perm_baseline.json shows permission sprawl. Lesson: never eval admin-authored code; add timeouts.
Better than EMS: condition rules as data (not code); biometric device connectors; late-come/early-out penalty + grace time models.

## OrangeHRM (PHP/Doctrine)
- orangehrmLeavePlugin/entity: LeaveEntitlement (no_of_days decimal(19,15), days_used, from/to/credited date), LeaveLeaveEntitlement join (each leave day linked to entitlement(s) it consumed), LeavePeriodHistory (leave-year start changes versioned), LeaveStatus, WorkWeek, Holiday.
- Entitlement/FIFOEntitlementConsumptionStrategy.php behind EntitlementConsumptionStrategy interface: consume oldest-expiring entitlement first; multi-entitlement splits per leave day. LeaveBalance.php computes balance as entitlement - used - scheduled - pending - taken.
- orangehrmI18NPlugin: I18NLangString (key, group) + I18NTranslation per language + import/export; translation overrides editable in DB by admin - tenant-editable i18n. Also Subscriber/Event pattern for notifications, OAuth2 core plugin, LDAP/OpenID auth.
- Pitfalls: decimal(19,15) entitlements, soft `deleted` flags everywhere, Doctrine DAO sprawl; no payroll at all.

## Odoo community
- hr_holidays/models/hr_leave_accrual_plan.py + hr_leave_accrual_plan_level.py: accrual PLAN with ordered LEVELS (start_count/start_type after N days/months/years of service, added_value per frequency daily/weekly/biweekly/monthly/bimonthly/quarterly/biyearly/yearly with day options, cap_accrued_time + maximum_leave and yearly cap, carryover options (all/limited/none), action_with_unused_accruals, accrual_validity expiry, is_based_on_worked_time). Seniority-tiered accrual is the richest in OSS.
- hr_work_entry/models/hr_time_rule.py (new): time rules classify intervals into work-entry types by sequence with premium-pay categories (overtime/night/holiday) via interval algebra (resolve_intervals_by_sequence, Intervals) - basis for payroll worked-hours inputs. hr_attendance/models/hr_time_rule.py similar. resource.calendar (+leaves, attendance rows) is the shift/holiday base; hr_holidays mandatory days (hr_leave_mandatory_day), allocation approval states.
- Pitfalls: hr_leave.py 2762 lines; heavy computed fields with dependencies cause slow recomputes; payroll behind enterprise paywall so rules engine (hr.salary.rule with python code + rule categories + inputs + structures) not auditable here - Odoo salary rules run python `safe_eval` (known source of customization debt).

## Jorani / IceHrm / Sentrifugo
- Jorani (legacy/application/models): Contracts (per-contract leave year start/end, weekly working days), Dayoffs, Entitleddays (per contract/employee/type with start-end), Delegations (approver delegation), Overtime, Positions, Organization tree (supervisor per node). Simple and leave-only. Delegation model is worth copying.
- IceHrm: ice/ + extensions (advance_reports, leave); payroll is a paid module - none usable. Sentrifugo: 2014-era Zend, no payroll; ignore.

## ADOPT (priority)
1. Replace regex+new Function in src/utils/formulaEval.js with a real parser (expr-eval/jsep AST allowlist) + node/time limit; keep formulas as data. Horilla RCE history shows the risk.
2. Seniority-tiered accrual plan levels (Odoo) + pre-materialised earned-leave schedule per allocation (Frappe) -> deterministic backfill/mid-year joiners; keep LeaveLedgerTxn as truth.
3. Entitlement-lot FIFO consumption with per-day linkage (OrangeHRM) so carry-forward expiry and cancellation restore the correct lot.
4. Payroll corrections/arrears as first-class dated records applied in a later run (Frappe PayrollCorrection/Arrear) with days_to_reverse; additional_salary (one-time/recurring), salary withholding, statistical/do_not_include_in_total component flags, YTD opening balances.
5. Annual tax projection (YTD + projected remainder) with two-stage declaration then proof submission.
6. Condition-as-data rule engine for allowances/components (Horilla MultipleCondition) and attendance grace/late/early penalties.
7. Time rules + work-entry types with premium categories (Odoo) feeding OT/night/holiday pay.
8. Auto-attendance job with last-sync cursor, shift rota/assignment, biometric connector interface (Frappe shift_type + Horilla biometric/).
9. Generic approval workflow (states, transitions, role/condition) + approver delegation (Jorani) instead of per-module approve endpoints; DB-editable i18n strings with groups (OrangeHRM); custom fields + webhook/automation tables.
10. F&F statement aggregating assets, advances, loans, withheld pay, leave encashment (Frappe).

## AVOID
God-classes (salary_slip.py 2.8k, hr_leave.py 2.7k); python-eval of stored code; recomputing full-year tax per slip in bulk without caching; unbounded ledger SUM per balance read (cache/snapshot per leave year); soft-delete flags + docstatus amend states; decimal(19,15) noise.

## EMS already better
Multi-tenant row isolation + versioned StatutoryPack/LeavePolicy by country (OSS is single-company/country-patch via regional modules); AES-GCM payout methods w/ maker-checker and country bank schemas; PayrollRun approval/publish/hold lifecycle with audit JSON; multi-currency (KWD 3-dec); semi-monthly proration verified H1+H2==monthly; legal entities; garnishments, contractor invoices, payment batches; SSRF guard; OTP/MFA policy; announcements/timesheet templates built in. Gaps vs OSS: workflow engine, custom fields, webhooks, i18n, biometric, shifts/rota, time rules, arrears docs.
