# Global competitor configuration depth vs EMS (public sources only, 2026-10-17)

Evidence grade: A = vendor help/doc page fetched or quoted in search; B = vendor marketing/press; C = third-party (unverified). Many help centers (BambooHR, Gusto, SAP) block WebFetch or return only search snippets; cells marked C need a human re-check. Not covered in depth (no usable public pages found this pass): Culture Amp, Paycor, Remote EOR ops, Paylocity internals.

## 1. Configuration-depth matrix (cell = how it is configured; URL)

| Area | Best-in-class finding | URL | Grade |
|---|---|---|---|
| Time-off accrual (BambooHR) | Accrual policy: frequency (yearly/monthly/biweekly/semi-monthly), tenure milestones raise accrual w/o separate policy, carryover cap + carryover expiry date (max 1y) per policy, reset-negative-to-0 at carryover date, pause accruals per employee. Negative balance NOT blocked; warning only on request and approver email | https://www.bamboohr.com/product-updates/set-expiration-dates-for-carryover-time-off-balances ; https://www.bamboohr.com/product-updates/time-off-balance-reset-after-carryover-date ; https://www.bamboohr.com/product-updates/pause-time-off-accruals ; https://www.bamboohr.com/product-updates/clarify-balances-on-time-off-requests | A |
| Time-off (Factorial) | Allowance modes: all-at-once, daily, monthly (1st/15th/last), twice-monthly, per-clock-out (hours based), contract anniversary. Carryover: automatic w/ cap, manual (needs approval), none, full; expiry date or none. Approval = named approval groups with levels; each level must approve; auto-approve per group; reroute | https://help.factorialhr.com/en_US/time-off-settings/about-time-off-allowances ; https://help.factorialhr.com/en_US/absences-approvals/how-to-create-time-off-approval-systems ; https://help.factorialhr.com/en_US/time-off-deductions/carryover-deduction-with-planning-tools | A |
| Time-off (Gusto) | Policy types fixed-amount / accrual by hours worked / per pay period; waiting period, max balance, carryover limit editable anytime; paid-vs-unpaid and limited-vs-unlimited immutable after creation; moving policy carries balance. Embedded API: accrual-methods, policy management flow (changelog v2026-02-01) | https://support.gusto.com/article/999756591000000/set-up-and-manage-time-off-policies-for-admins ; https://docs.gusto.com/embedded-payroll/docs/accrual-methods ; https://docs.gusto.com/embedded-payroll/v2026-02-01/changelog/time-off-policy-management-flow | A |
| Time-off (Sage) | Sage People: accrual pattern attached to policy, per-employee override on employment record, accrue-during-paid/unpaid-absence flags. Sage HR: approver per employee = direct mgr / team mgr / admin / named person; approver does not imply visibility (role perms separate) | https://help-people.sage.com/Content/SP_Time/SP_Time_AbsenceAccrual.htm ; https://support.sage.hr/en/articles/3883519-set-up-time-off-approvers | A |
| Time-off (Personio) | Absence-type config (half-day, substitute) exposed via API | https://developer.personio.de/changelog/absence-api-absence-type-configuration | A |
| Timesheets/shifts | Factorial: shifts overlapping approved full-day absence auto-move to "backup"; leave editable from Shifts page by permission "Create and edit leaves". Rippling Time rebuilt 2026-07-07: AI-assisted scheduling, approved time flows straight into payroll. Paycor: auto-approve timecards under thresholds (C) | https://help.factorialhr.com/en_US/shift-management/how-to-manage-leaves-in-shifts- ; https://releasebot.io/updates/rippling | A/B |
| Payroll off-cycle + retro | Gusto: no reversal needed for most errors; underpayment = off-cycle run for the difference (no fee); "processed" = bank debit (4pm PT on debit date); past quarter -> non-Gusto payroll report; dismissal payroll is a separate flow; embedded API POST /payrolls creates off-cycle | https://support.gusto.com/article/999908231000000/run-an-off-cycle-payroll-for-admins ; https://support.gusto.com/article/106621949100000/change-cancel-or-reverse-a-payroll-or-payment-for-admins ; https://support.gusto.com/article/100894844100000/run-a-dismissal-payroll-for-admins | A |
| Benefits admin | Rippling AI benefits admin 2026-07-30 (dependent verification, carrier decisions applied in bulk adjusting deductions); open-enrollment mgmt Oct 2026; Gusto: benefit corrections for managed plans need Gusto staff | https://releasebot.io/updates/rippling ; https://support.gusto.com/article/210830074851110/fix-past-benefit-amounts | A/B |
| Onboarding/offboarding | Checklists + new-hire packets + e-sign; offboarding checklist incl. asset collection (BambooHR, C). Rippling IT: attribute-driven on/offboarding, device mgmt (2026-07-28) | https://releasebot.io/updates/rippling ; https://www.forbes.com/advisor/business/software/bamboohr-review/ | B/C |
| Workflow/approval builder | Workday BP framework (see 3b). Rippling: Approvals app (rules on any employee-graph attribute, e.g. comp change >20%, multi-approver, vacation reroute) + Workflow Studio recipes. SAP Intelligent Services Center: publisher/subscriber event flows with trigger rules (onPostSave), timing option "when event published", prepackaged SAP_EVENT_HIRE/TERM/DEPTCHG; 30s endpoint limit, <=2 integration jobs per event. Paylocity Workflows: approvals + cross-module triggers | https://www.rippling.com/platform/permissions ; https://doc.workday.com/admin-guide/en-us/manage-workday/business-processes/business-process-framework-concepts/dan1370797198449.html ; https://help.sap.com/docs/successfactors-platform/implementing-and-managing-intelligent-services/using-intelligent-services-center | A |
| Custom fields/reports/dashboards | Workday Report Writer + calculated fields (resolve at runtime; report-specific vs tenant-wide needs separate permission) + Prism; HiBob field-level perms at People's fields category/field; Rippling Data Cloud (2026-06-25) BI bound to worker identity + permissions; BambooHR custom dashboards only Elite (C); Paylocity 1,000+ prebuilt reports, cross-module limited (C) | https://doc.workday.com/workday-education/en-us/course-manuals/workday-reporting/calculated-fields.html ; https://apidocs.hibob.com/docs/how-to-read-employee-data ; https://releasebot.io/updates/rippling | A/C |
| Permission model | Rippling scope/access/actions on attribute-bound profiles; SuccessFactors RBP; Workday security groups + domain policies; HiBob permission groups + field/category. See 3a | https://www.rippling.com/platform/permissions ; https://blogs.sap.com/2020/10/09/role-based-permissions-in-sap-successfactors/ ; https://apidocs.hibob.com/docs/api-service-users | A |
| Audit | Lattice permissions CSV export for audits (Jan 2026); Workday "View AI Agent User Audit Trail" report; Rippling pre-call policy check + call log | https://lattice.com/blog/january-2026-product-updates ; https://doc.workday.com/admin-guide/en-us/workday-ai/agents/set-up-agent-system-of-record.html | A |
| SSO/SCIM | HiBob SCIM (SAML first) (C); BambooHR SAML + JIT, no native SCIM per Stitchflow (C, conflicting); Personio SCIM disputed | https://www.stitchflow.com/scim/hibob ; https://www.stitchflow.com/scim/bamboohr | C |
| API/webhooks | HiBob: service user + permission group, field-level; webhooks carry fieldIds, you re-read via API. Personio: credentials scopes + attribute whitelist, Webhooks API with enabled_events, absence-period.* events. Deel API date-versioned (2026-01-01) while MCP unversioned | https://apidocs.hibob.com/reference/api-calls-for-webhook-events ; https://developer.personio.de/reference/webhooks ; https://www.scalekit.com/blog/deel-mcp-vs-api | A/C |
| Global payroll/EOR | Deel: legal employer via own entities in 100-150+ countries, EOR ~USD 599/emp/mo, contractor ~49, Global Payroll needs your own local entity (~29, unverified); single funding payment, FX markup 0.6-2% (C); EOR->entity migration path | https://www.pin.com/blog/deel-pricing/ ; https://www.noon.ai/blog/articles/106-deel-pricing-2026 | C |
| Pricing mechanics | BambooHR Core 10/Pro 17/Elite 25 per emp/mo, flat for <=25, payroll/benefits US add-ons; Gusto base+per-emp (Simple 49+6, Plus 80+12, Premium 180+22 after Mar-2026 rise), time tracking add-on on Simple; Rippling quote-only, base + per-module | https://www.hireinsouth.com/post/bamboohr-pricing ; https://www.joinhomebase.com/blog/gusto-vs-rippling-comparison | C |

## 2. AI features actually shipped (dated)

| Vendor | Item | Date | URL |
|---|---|---|---|
| Rippling | AI Governance: MCP Gateway + Agent Identity live, AI Gateway/Shadow AI waitlist | 2026-08-20 | https://www.rippling.com/blog/introducing-rippling-ai-governance |
| Rippling | MCP server (single "code" tool, model writes JS run in isolate granted only functions the user's role may call; read-only ask_ai tool) | 2026-08-25/27 | https://www.rippling.com/en-IE/blog/building-mcp-server |
| Rippling | Helpdesk (agentic IT, approvals routed, all logged) | 2026-08-31 | https://releasebot.io/updates/rippling |
| Rippling | AI plugins (3rd-party MCPs), reusable skills, automations under Rippling permissions | 2026-09-23 | https://releasebot.io/updates/rippling |
| Workday | Agent System of Record (agent system user, delegate vs ambient mode); Sana rebrand worldwide | Sana 2026-03-17 (C) | https://doc.workday.com/admin-guide/en-us/workday-ai/agents/set-up-agent-system-of-record.html ; https://drel.ai/blog/workday-illuminate-security-review |
| Gusto | Cofounder agent (20+ automations; MCP connectors), early access | 2026-06-02 | https://www.cpapracticeadvisor.com/2026/06/02/gusto-introduces-an-ai-teammate-for-small-businesses/184399/ |
| Gusto | Multi-client MCP + Gusto Pro | 2026-10-07 | https://www.morningstar.com/news/pr-newswire/20261007sf66108/gusto-unveils-redesigned-gusto-pro-new-multi-client-model-context-protocol-and-expanded-partner-program-for-accountants |
| Lattice | MCP early access (NA) at Lattiverse; AI Agent in 1:1s free | Jun 2026 | https://lattice.com/blog/introducing-lattice-mcp |
| HiBob | MCP server w/ OAuth on behalf of user (mid-2026, C); Galileo agents Q3 2026 | 2026-09-16 | https://www.globenewswire.com/news-release/2026/09/16/3363105/0/en/hibob-and-the-josh-bersin-company-launch-galileo-powered-workforce-intelligence-in-bob.html |
| Deel | AI Workforce agents (hiring/onboarding/payroll/IT/compliance); MCP at api.letsdeel.com/mcp, OAuth scoped | 2026 (date not found) | https://www.deel.com/blog/big-deel-recap-2026/ ; https://developer.deel.com/home |
| Remote | MCP at mcp.remote.com/mcp, OAuth sign-in | 2026 (date not found) | https://developer.remote.com/docs/quick-start-guide-2 |
| Factorial | One / personal agent; MCP claim Jan 2026 conflicts with Oct 2026 report | unclear | https://en.ara.cat/economy/factorial-completes-the-jump-to-ai-for-companies-with-new-personal-agent_1_5872571.html |
| Personio | aurio acquisition agents (Apr 2026), Assistant on Confluence/Drive (Q2) | 2026 | https://www.leapsome.com/comparisons/personio-alternatives |
| Paylocity | AI Assistant acts on user's roles, conversational approvals | 2026 | https://www.paylocity.com/company/about-us/newsroom/press-releases/paylocitys-ai-assistant-leaps-from-questions-to-actions-in-seconds/ |
| BambooHR | AI Assistant tiered: Core data Qs, Pro policy docs, Elite benchmarks (C) | 2026 | https://thrivea.com/blog/bamboohr-review/ |

Common pattern: every vendor binds agent to acting user's permissions; none publicly documents a mandatory per-action human confirm. Workday explicitly leaves that to the customer.

## 3. Design patterns + concrete EMS proposals

EMS baseline (read-only audit): 77 Prisma models; `Role/Permission/RolePermission/UserRole`, `PERMISSION_CATALOGUE` (flat `module:action` keys, defaults per memberType, tenant-editable via Settings -> Roles & Permissions, `requirePermission()`); `AuditLog` (old/new JSON, ip, UA); `SavedView`, `ScheduledReport` (3 fixed reportTypes), webhooks CRUD under /settings/webhooks; `LeavePolicy` (versioned, `applicability` json incl. tenureTier, rules json), `LeaveLedgerTxn` ledger, carryForward/encash/negativeBalance present; payroll runs have `approvalsJson`, `auditJson`, type OFF_CYCLE/ARREARS/BONUS/FNF; `TimesheetSettings` per tenant.

### 3a. Permission / data-scope model
Best pattern: three orthogonal axes (Rippling scope x access x action; SuccessFactors RBP "granted users" x "target population" x field perms; Workday security group x domain policy). Profiles bind to attributes, not people (Rippling "supergroups").
Gap in EMS: permission keys are flat; scope is hardcoded per role (MANAGER = team, EMPLOYEE = self); no field-level; no attribute-driven groups; leave manager-scope bypass already found at repository level.
Proposal (additive):
- `RolePermission` add nullable `scopeJson` (type SELF | REPORTS(depth) | DEPARTMENT(ids|own) | LEGAL_ENTITY | COUNTRY | ALL) keeping existing keys. Default scope per existing grant reproduces today's behavior (employees:read -> ALL, attendance:team-read -> REPORTS(1)).
- New `AccessGroup` (tenantId, name, ruleJson over Employee attributes: department, legalEntity, country, level, employmentType) + `AccessGroupRole`; membership computed at request time and cached per session. This is Rippling supergroups.
- New `FieldPolicy` (tenantId, roleId, entity, field, mode HIDDEN|READ|WRITE); serializer middleware strips fields (salary, bank, ids). Start with Employee + EmployeeSalary + PayoutMethod only.
- One `resolveScope(user, permissionKey)` returning a Prisma `where` fragment; every repository calls it (kills per-repo hand-written scope bugs). Settings matrix gains a scope dropdown per row.
- Keep SUPER_ADMIN bypass; cap custom-role grants at creator's own permissions (Rippling rule).
- Audit: log role/scope/field-policy changes to `AuditLog`; add permissions CSV export (Lattice Jan 2026).

### 3b. Workflow builder
Best pattern: Workday BP = ordered steps (action/approval/to-do), each step has condition rules, responsible security group, parallel or sequential, skip/alternate routing, plus BP security policy for who can initiate/approve/cancel/rescind/reassign; types fixed by vendor, steps configurable. Rippling: rules on any attribute with threshold. SuccessFactors ISC: event + trigger rule + timing.
Gap in EMS: approvals are hardcoded per module (leave approve, payroll approvalsJson, payout maker-checker); no tenant-defined chains, delegation, or auto-approve; no event-trigger automations (onboarding/offboarding tasks absent).
Proposal:
- `WorkflowDefinition` (tenantId, subjectType e.g. LEAVE_REQUEST|PAYROLL_RUN|PAYOUT_METHOD|COMP_CHANGE|TIMESHEET, version, status DRAFT|PUBLISHED, conditionJson, stepsJson). Step = {kind APPROVAL|TASK|NOTIFY|WEBHOOK, approverRef: MANAGER(level n)|ROLE|PERMISSION_KEY|NAMED, mode ANY|ALL, parallelGroup, when: condition, skipIfSelf, escalateAfterHours, delegateOnLeave}.
- `WorkflowInstance` (definitionVersion pinned, subjectId, state, currentStepIds) + `WorkflowStepTask` (assignee, decision, decidedAt, note). Approvers must hold `<module>:approve`; engine refuses assignment to anyone lacking it (fixes HR self-approve: add `forbidSelf` default true).
- Conditions: tiny JSON predicate (field op value, and/or) reusing existing formulaEval whitelist grammar; no code execution.
- Triggers: `WorkflowTrigger` event names (employee.hired, employee.terminated, leave.submitted) subscribed internally; same event bus feeds existing webhooks. Onboarding/offboarding = definitions whose steps are TASKs (assign IT asset via Asset model, e-sign via EmployeeDocument). Ship leave + payroll-run first, since `approvalsJson` can migrate in.
- Fixed subject types (as Workday) so FE need not render arbitrary forms.

### 3c. Reports / dashboard builder
Best pattern: Workday Report Writer (data source + fields + filters + calculated fields; report-specific vs tenant-wide calculated fields gated separately; secured by domain), Rippling Data Cloud (BI bound to identity+permissions), HiBob field-level.
Gap: EMS reports are 3 fixed types; SavedView stores filters/columns only; no calculated fields, no dashboards; ExportJob exists.
Proposal:
- `ReportDefinition` (tenantId, ownerId, dataSource enum fixed list: EMPLOYEES|LEAVE_LEDGER|ATTENDANCE|PAYSLIPS|TIMESHEETS, fieldsJson, filtersJson, groupByJson, aggregatesJson, calcFieldsJson, visibility PRIVATE|ROLE|TENANT). Execution goes through one report runner that composes Prisma queries from a data-source registry (allowed fields declared with the permission key + FieldPolicy that governs each) and applies `resolveScope`; no raw SQL (project rule).
- `Dashboard` + `DashboardWidget` (reportId, chart type, layout). Reuse ScheduledReport by pointing it at reportId and replacing reportType enum.
- Sensitive sources (PAYSLIPS) require `payroll:export`; exports reuse the existing ExportJob + audit.
- Calculated fields: whitelist expression grammar as in formulaEval; report-specific only in v1.

### 3d. AI agent safety model
Best pattern synthesis: Rippling (agent acts as the user; policy check before each tool call; call logged; agent identity owned + revocable; model gets no authority of its own) + Workday ASOR (agent system user, delegate vs ambient mode, platform-enforced scoping, audit trail report) + Workday's own acknowledged gap: approval gating of high-risk actions is left to the customer.
Proposal for EMS (MCP server and/or in-app assistant):
1. Identity: `AgentIdentity` (tenantId, ownerUserId, name, mode DELEGATE only in v1, scopes[], status, expiresAt); token is OAuth/JWT with `act` claim = user; effective permission = intersection(user permissions, agent scopes). No ambient mode.
2. Tool registry maps 1:1 to existing `requirePermission` keys; read tools default on, write tools default off per tenant (`Setting`).
3. Risk tiers in the registry: READ (auto), WRITE_LOW (own leave request, own check-in: auto + log), WRITE_HIGH (approve leave/payroll, edit salary, terminate, payout method, export): two-phase. Tool call returns `{pendingActionId, diff, expiresIn}`; a human confirms in UI (or via `POST /agent/actions/:id/confirm` with fresh session, and OTP for payroll/payout), never by the model. Payroll approve/publish, bank details, deletes and bulk >N rows are denied to agents in v1.
4. Audit: extend `AuditLog` with `agentId`, `onBehalfOfUserId`, `confirmedByUserId`, `toolName`, `requestId`; every call (allowed, denied, pending, confirmed) logged with input hash; exposed in a report like Workday's AI Agent User Audit Trail.
5. Controls: per-agent rate limits, kill switch (revoke identity), prompt-injection posture: treat all DB text (notes, announcements) as data, strip from tool descriptions; field-level policy applies to agent reads so an agent cannot see what the user cannot.
6. Unknown/not found publicly: no vendor documents mandatory confirmations; this tiering is our design, informed by Workday's stated gap.

## 4. EMS diff

| Capability | EMS | Status |
|---|---|---|
| Versioned leave policy w/ tenure applicability, ledger, carryover, encash, negative balance | present (LeavePolicy/Ledger) | Meets/exceeds BambooHR/Gusto on ledger audit; verify carryover expiry date, pause-accrual per employee, blackout dates (grep found none), accrue-during-leave flag |
| Multi-level named approval groups, auto-approve, reroute | absent | LACKS (Factorial/Rippling) |
| Timesheets: settings, rounding, overtime, approvals, templates | present | Partial; no shifts/scheduling, no shift-vs-leave backup logic |
| Payroll off-cycle/bonus/arrears/FNF, multi-country packs, semi-monthly | present | Meets/exceeds Gusto off-cycle; retro pay = ARREARS type (TDS bug noted in prior doc) |
| Benefits admin (plans, enrollment, carriers) | absent | LACKS |
| Onboarding/offboarding workflows, e-sign | absent (documents only) | LACKS |
| Workflow builder | absent; hardcoded approvals | LACKS |
| Custom fields/objects | absent | LACKS |
| Report/dashboard builder | fixed reports + SavedView | PARTIAL |
| Permission catalogue, tenant-editable | present, flat keys | PARTIAL: no data scope, field-level, attribute groups |
| Audit with before/after + IP | present | Meets; lacks agent attribution, permissions export |
| SSO/SCIM | OTP/MFA policy only; no SAML/SCIM | LACKS |
| Webhooks | CRUD+test+SSRF guard | PARTIAL: no event catalogue/replay/signing verified; no marketplace |
| API versioning/public API keys/scopes | JWT only | LACKS |
| Global payroll/EOR | LegalEntity, StatutoryPack, country bank schemas, multi-currency | PARTIAL for global payroll; no EOR entity operating model |
| AI assistant/MCP | none | LACKS |
| Billing/modules/usage | billing module present | PARTIAL; no per-module entitlement gating found |

Priority suggestion: (1) data-scope resolver + field policy (security foundation, also protects AI), (2) workflow engine on leave/payroll, (3) agent identity + MCP read tools, (4) report builder, (5) SSO/SCIM.
