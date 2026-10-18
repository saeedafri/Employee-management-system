# EMS modules audit (read-only, static). Paths relative to src/modules unless noted.

## CRITICAL / HIGH

### H1. Privilege escalation: HR_ADMIN -> SUPER_ADMIN-only permissions via custom roles
- settings/settings.routes.js:145-147 guard POST /settings/roles, DELETE /settings/roles/:key, POST /settings/roles/:key/users with `settings:manage` (held by HR_ADMIN; auth/permissionCatalogue.js HR_ADMIN_KEYS excludes only payroll:super, settings:security, permissions:manage).
- settings/settings.repository.js:createRole takes `permissions[]` and links ANY key found in Permission table; no "caller must hold it" check. assignUsersToRole (same file) takes arbitrary userIds, no tenant check on users.
- auth/auth.service.js:67-73 extractPermissions unions all userRoles -> token.
- Scenario: HR_ADMIN POST /settings/roles {key:"x",name:"x",permissions:["permissions:manage","payroll:super","settings:security"]}; POST /settings/roles/x/users {userIds:[self]}; re-login -> holds SUPER-only keys. Bypasses the guard on PATCH /settings/roles-permissions (permissions:manage).
- Also: userIds not tenant-scoped -> UserRole row can be created for a user in another tenant (needs victim user id).
- None of role create/delete/assign is audit-logged (no recordAuditLog in settings/*).

### H2. Cross-tenant write: department archive
- departments/departments.service.js reassignAndDeleteDepartment never loads the SOURCE department (only target); departments.repository.js:211-223 `prisma.department.update({where:{id}})` has no tenantId. employee.updateMany is tenant-scoped, the update is not.
- Scenario: tenant-A user with departments:write POST /departments/<tenantB dept id>/reassign-and-delete {reassignEmployeesTo:<A dept>} -> B's department gets deletedAt. Unknown id -> Prisma P2025 -> 500 w/ message.
- Same endpoint also: archives a department that still has sub-departments; children keep parentId of archived parent and `buildDepartmentTree` (service) drops them (parentId set but not in map) -> sub-tree vanishes from GET /departments. Target may be a descendant of source.
- softDeleteDepartment(id,_tenantId) and updateDepartment repo also lack tenant in where (guarded only by prior check; TOCTOU-safe enough).

### H3. Mass assignment -> tenant move / state forgery
- recruitment/recruitment.repository.js:updateOpening `data` = raw body; routes.js PATCH body schema has no additionalProperties:false, so `tenantId`, `applicantCount`, `currentStage`, `id`, `createdAt` pass. recruitment:write holder (HR) PATCH {tenantId:"<other tenant>"} moves/injects the opening into another tenant.
- performance/performance.service.js:updateReview `{...data, status:'Calibrated', managerComplete:true}`; body schema only lists rating. Manager can send `tenantId`, `cycleId`, `reviewerId`, `employeeId`, `selfComplete` to repo.updateReview(where id).
- integrations.service.js updateWebhook/updateEmailIntegration/updateStorageIntegration spread `...data` into stored blob (can overwrite id, secretMasked, status:"connected", configured, domainVerified).
- settings.repository.js updateAuthSettings/updateAttendanceRules/updateNotificationPreferences: `{...current, ...req.body}` with schema `additionalProperties:true`, no validation (see M-list).

### H4. Performance: manager can self-rate; no team scoping on reads
- performance.service.js:assertCanWriteFor allows `requestingUser.employeeId === employeeId`. MANAGER (performance:read only) PATCH /performance/reviews/<own employeeId> {rating:"Exceeds"} -> own review Calibrated (status jumps from anything, incl. 'Not started', to 'Calibrated'; no stage guard, no cycle-state guard, ratings of closed cycles editable until Calibrated).
- performance.repository.js getReviews/getGoals/getSummary/getCalibration are tenant-wide for every performance:read holder. Any MANAGER sees all employees' ratings/goals incl. HR's and peers'. getReviews employee lookup `where id in` lacks tenantId (ids come from tenant-scoped rows, so safe).
- No route for employee to see own review/goals (EMPLOYEE lacks performance:read) -> no self-review step; `selfComplete` can never become true via API. Calibration notes are hardcoded ("Engineering skews high 41%..."); goalsOnTrackDelta:6 hardcoded.

### H5. SSE stream bypasses session check
- notifications/notifications.routes.js:82-135 does not use `authenticate`; only verifyToken(). Revoked session (logout / logout-all / DELETE session) still authenticates; token verified once, stream then lives forever (no re-check at expiry). Deactivated employee keeps receiving live notifications.
- No per-user connection cap (utils/sseClients.js Set per user) -> unbounded sockets/heartbeat timers per user (memory DoS).
- Token accepted in `?token=` (lands in access logs via middleware/requestLogging).

### H6. Reports present fabricated payroll numbers as real
- reports/reports.repository.js:655-760 getPayrollSummaryReport / getPayrollCtcAnalysis use hardcoded `avgGross {FULL_TIME:80000,...}`, 12% deductions, currency 'INR'. reports.service.js:176,186 `employee_count*50000`. Not wired to PayrollRun. KWD/USD tenant sees INR invented totals. ctc-analysis bands/percentiles are synthetic.
- Scheduled reports: POST /reports/schedule stores ScheduledReport, but nothing outside reports/* references the model -> no runner; emails never sent; `nextRunDate` set once and never advanced. emailRecipients accepts any external address (no domain allowlist) - latent exfil once a runner exists.

### H7. DPIA / compliance report is always "COMPLIANT"
- auditLogs.repository.js getDataAccessAuditLogs filters actions LOGIN, EMPLOYEE_VIEW, EMPLOYEE_DATA_ACCESS, SALARY_VIEW, PERSONAL_DATA_VIEW. grep: SALARY_VIEW/EMPLOYEE_VIEW/PERSONAL_DATA_VIEW/EMPLOYEE_DATA_ACCESS are never written anywhere. Scenario: HR exports 500 payslips; POST /audit-logs/dpia-report -> high_access_users [], compliance_status COMPLIANT.
- recordAuditLog callers only in auth, employees, departments, manager dashboard. NOT audited: recruitment, performance, assets, announcements, settings (roles, auth/MFA policy, integrations, webhooks, branding), billing, exports, reports, document download. All audit writes elsewhere use `.catch(() => {})` (best effort).
- DPIA report loads every row in range with no take/limit; unbounded from/to.

### H8. SSRF guard bypass + webhook is a stub
- utils/ssrfGuard.js isPrivateIp v6: only dotted `::ffff:a.b.c.d` handled. WHATWG URL normalises `https://[::ffff:127.0.0.1]/` to `[::ffff:7f00:1]` -> not private -> accepted. Also NAT64 `64:ff9b::7f00:1`, 6to4 `2002:7f00:1::`, `fec0::`, 198.51.100/24, 203.0.113/24 not blocked. Checked only at create/update (DNS rebinding TOCTOU at delivery time).
- Currently latent: integrations.service.js testWebhook returns simulated success; no delivery code exists (no webhook dispatch anywhere; DEFAULT_WEBHOOK_EVENTS never emitted). Secret never stored (only maskSecret(secret)) so HMAC signing impossible. `events` not validated against catalog; `name` unbounded.
- settings/integrations.service.js read-modify-write of one JSON blob (`webhooks`) -> lost updates under concurrent edits.
- virusScan.webhookUrl stored without assertSafeWebhookUrl.

### H9. Plaintext third-party secrets stored and returned
- integrations.service.js getEmailIntegration returns stored config.password, secretAccessKey, apiKey; getStorageIntegration returns secretAccessKey, serviceAccountJson, connectionString, accessKeyId in clear (stored in Setting.valueJson unencrypted). Any settings:integrations holder (HR_ADMIN) GET reads them back. Integrations are cosmetic: email sending uses env RESEND_API_KEY (jobs/emailJob.js), storage uses Cloudinary env; "connected" status/testStorage latency 42ms are fabricated. Misleads admins into believing BYO SMTP/S3 is active.

## MEDIUM

### M1. File upload (employees/employees.controller.js)
- uploadDocument (l.171): NO type allowlist/magic-byte check/size beyond global 10MB (app.js:82). Client mimetype trusted; any file (exe/html/svg/zip) stored raw to Cloudinary 'authenticated' (signed attachment URLs mitigate XSS). Claimed `image/*` -> sharp decodes (server-side image parsing of attacker SVG/TIFF; no limitInputPixels -> decompression-bomb memory spike; failure -> 500 with raw err.message).
- `data.filename.replace` throws if filename missing (500). fileName stored unsanitised (CRLF/HTML/path chars) and echoed; documentType from query unvalidated (arbitrary string, e.g. PAYSLIP forged by an EMPLOYEE for self).
- `employee: {connect:{id: employeeId}}` with no tenant ownership check (l.~210): HR in tenant A can attach docs to tenant B employee id (row tenantId=A, folder ems/A/employees/<B emp>). presignDocument (l.387) creates DB rows with raw tenantId/employeeId, empty storageKey, client contentType/filename; confirmDocument never verifies an upload exists -> ghost documents; presign orphans never cleaned.
- Image docs (ID proofs) are lossy re-encoded to WebP q85 without resize cap; evidentiary fidelity lost (WebP rule satisfied).
- uploadPhoto: type allowlist uses client mimetype but sharp re-encodes -> WebP rule OK; no `.rotate()` (EXIF orientation ignored then stripped). Stored with `type:'upload'` (public, permanent URL).
- Photo replace/delete bug: old-key regex `/\/ems\/[^?]+/` keeps `.webp` extension but Cloudinary public_id for images has none -> destroy fails silently (`.catch(()=>{})`). Old photos and "deleted" photos stay publicly reachable at the old URL forever (erasure/GDPR gap).
- Oversize file: toBuffer throws -> 500 UPLOAD_ERROR rather than 413. No `files`/`parts` limits.

### M2. Export (export/*)
- export.routes.js:81 download guarded by requireAnyPermission(employees|attendance|leave :export) but does not check the perm matching the job's export_type nor ownership. A `leave:export`-only role lists all jobs (listExports seesAll uses any-of) and downloads an EMPLOYEES export (PII) by job_id.
- Exports: findMany without take; `ids[]` unbounded; attendance/leave date range unbounded; run in-process via setImmediate -> OOM risk, lost on restart leaving rows PROCESSING forever (no reaper). scheduleExportCleanup deletes DB rows >7d for ALL tenants but never deletes Cloudinary/local files -> exported PII persists indefinitely.
- utils/csv.js escapeCsvValue: no formula-injection neutralisation (leading = + - @ tab). Employee-controlled names/leave `reason` land in HR's Excel via /export/leave, /recruitment/export, reports csv.
- Download proxy buffers whole file in memory (acknowledged ponytail comment).

### M3. Search (search/search.controller.js)
- Leave search matches `reason` for MANAGER tenant-wide (l.~56: only EMPLOYEE scoped). Manager searches "chemo"/"surgery" -> groupedCounts.leave reveals which other teams' leave reasons contain it (oracle), results show leave type + status + #seq of non-reports. Users with no employeeId and non-listed role (e.g. AUDITOR without employee record) get NO filter -> all leave and all employees.
- Employee branch for non-admin: `OR.push({managerId})` then `id in [self]` -> manager sees only self (functional bug, reports invisible).
- No permission keys (only authenticate); q no maxLength (4 ILIKE '%q%' scans, no trigram index); `%`/`_` not escaped (q=% enumerates); `types` unvalidated. Prisma `contains` is parameterised -> no SQL injection; no $queryRaw in these modules.

### M4. Recruitment
- State machine: candidate stages applied->screening->interview->offer->hired strictly forward by one; no reject/withdraw/talent-pool, no reopen, no back-step; JobOpening.status free text on PATCH (route has no enum, service no check); `employmentType` free text on PATCH. Closing an opening does not touch candidates; `hired` doesn't create Employee or increment anything.
- POST /recruitment/candidates/:id/advance and PATCH rating: rating route uses `recruitment:read` (l.~110 canReadRecruitment) so a read-only MANAGER can write ratings (service even documents "HR only" for advance). Rating schema `integer` w/o min/max (service guards 1-5 only).
- No create-candidate route at all (no ATS intake/career page/apply endpoint); no resume upload, scorecards, interviewer assignment, interview scheduling, offers/approvals, email templates, source tracking, duplicate-candidate check. Summary fakes: avgDaysToHire hardcoded 28, interviewsToday = floor(interviews/3), interviewsThisWeek = count of stage 'interview'. daysInStage never incremented (only reset). applicantCount never updated.
- PII: every MANAGER (recruitment:read) reads all candidate names/emails/ratings tenant-wide and exports CSV (no export key, no hiring-manager scoping, no opening-level ACL).
- Pagination: `Number(limit)||50` no max (limit=1e9), page<=0 -> negative skip -> Prisma 500. Same pattern in assets, announcements, performance, billing (billing.controller slices in memory).
- Index gap: Candidate list orders by appliedAt with filters tenantId/openingId/stage; no (tenantId, appliedAt) index.

### M5. Assets
- assignAsset: employeeId/name are client strings, never checked against Employee in tenant -> assign to nonexistent/foreign employee, spoof displayed name. Assigning an already Assigned or in Repair asset silently overwrites holder (no check status==='Available'); no history table (denormalised assignedToName/assignedSince string) -> no audit of custody, no return condition, no depreciation/cost/purchase date/serial/warranty/QR; updateAssetStatus to Retired/Repair on an Assigned asset silently wipes the assignment.
- AssetRequest: no POST route (employees cannot raise requests; only approve/decline); 'Fulfilled' unreachable; approve doesn't link/assign asset; TOCTOU read-then-update(id) without status guard. avgRepairDays hardcoded 6.
- Employees cannot see their own assigned assets (all routes require assets:manage). createAsset: tag unbounded; assignedTo.employeeId unverified.

### M6. Announcements
- Audience never enforced: `audience` is free text; GET /announcements returns all tenant announcements to any authenticated user (e.g. "Managers only" / "Leadership" leaks to EMPLOYEE).
- authorName/authorRole come from request body (POST /announcements) -> any MANAGER posts as "CEO". No server-side author from JWT.
- updateAnnouncement: no ownership check (MANAGER can rewrite HR's post); `channelId` on PATCH not validated against tenant (FK to another tenant's channel -> row visible nowhere / integrity), category not validated on create/patch, body/title unbounded, no sanitisation (stored XSS if FE renders HTML).
- postCount/readCount never incremented anywhere (dead counters); pinned item fetched ignoring channelId filter and feed excludes pinned while pagination.total includes it. No scheduling/expiry/ack/ comments/ attachments; createEvent date free string.
- No audit logging, no notification fan-out on publish (webhook event 'announcement.published' catalogued but not emitted).

### M7. Settings validation
- PATCH /settings/security/auth (SUPER only) body unvalidated: password_min_length:1 or "abc", session_idle_timeout_minutes:-1, mfa_policy:any string (policyRequiresMfa on unknown value -> silently OPTIONAL = MFA not enforced), sso_enabled flag with no SSO implementation; arbitrary extra keys persisted (blob stuffing).
- PATCH /settings/attendance-rules: `work_week_days` forwarded straight to tenantConfig.update (invalid tokens corrupt work-week for payroll/attendance); numeric thresholds unvalidated.
- settings.service updateTenantConfig: logoUrl/supportPhone unvalidated strings (javascript:/tracking URL); email templates: only 3 types, body min 10 no max, no placeholder allowlist; GET /settings/email-templates writes (seeds) on read and races on unique(tenantId,type) -> 500.
- Roles: createRole `key`/`name` unvalidated; deleteRole checks UserRole by roleId only; updateRolePermissions deletes then createMany non-transactionally (crash between = role with zero permissions = lockout).
- settings.controller wrap(): leave-types create/update pass req.body to leave service unvalidated (out of scope; noted).

### M8. Billing
- billing/billing.service.js serves hardcoded fixture subscription (usage apiCalls 12450, storage 4.5GB), fake invoices INV-2026-00x, plans, to every tenant unless a Setting blob exists. Plan `modules` flags (recruitment/performance Enterprise-only) are NOT enforced anywhere (grep: no module gating) -> Starter tenant uses recruitment/performance. downloadUrl '#'. Invoice pagination in memory; no write path (no plan change/payment). Seats `total` never enforced when creating employees.

### M9. Notifications
- limit/page unbounded (`parseInt`, schema no min/max): limit=1e6, page=0 -> 500 negative skip. `since` invalid string -> Invalid Date -> Prisma error 500. deleteExpired() defined but never scheduled -> table grows. Missing composite index (tenantId,userId,createdAt) for the main list query (3 separate single-col indexes). Notification.metadataJson.actionUrl returned raw (FE open-redirect/javascript: risk if rendered as link; creators are internal).

### M10. Departments (other)
- GET /departments/:id/employees: limit unbounded; exposes user.email for all dept members to departments:read holders (EMPLOYEE role holds departments:read -> any employee lists a department's staff emails incl. HR/SUPER). wouldCreateCircularParent: N sequential queries; `depth` column not recomputed on re-parent. headEmployeeId unique check not transactional.

## LOW / NOTES
- Audit logs: `user_email` filter exact-match only; action/entity unbounded strings; export capped 10k with truncation headers (good). Audit table has no DB-level immutability (no UPDATE/DELETE grants revoked); no tamper-evidence/hash chain.
- AuditLog indexes are adequate (tenantId+createdAt/action/entity/actor); actor.email filter joins User without index on (email) per tenant (exists by unique likely).
- authenticate.js: JWT permissions baked at login -> role/permission changes take effect only after token refresh/re-login (<=15m window), and user deactivation not checked per request (session-only).
- Prisma $queryRaw not used in audited modules; no raw SQL injection found.
- Cloudinary: document uploads correctly use type:'authenticated' + signed 300s URLs; storageKey path contains tenantId (fine). Export file `type:'authenticated'` OK.

## Workflow completeness vs norms (summary)
- ATS: missing candidate intake, resumes, scorecards, interview scheduling, offers, requisition approval, stage config, reject reasons, career page, EEO/GDPR retention, talent pools, source analytics, hire->employee conversion.
- Performance: no review templates/competencies, no 360/peer feedback, no OKR cascade/key results (goal = title+%), no self-review submission, no 9-box, calibration = distribution only (no sessions/locks), cycle CRUD absent (cycles seed-only; no POST /performance/cycles), no review-cycle status transitions, no goal update/delete route (can create but never update progress!).
- Assets: no depreciation, purchase info, serial, warranty, QR/barcode, assignment history/ack, return workflow w/ condition, maintenance log, bulk import, employee self-service, offboarding recall tie-in.
- Announcements: no audience targeting enforcement, scheduling, expiry, read receipts, acknowledgements, attachments, comments/reactions, notification fan-out.
- Settings: webhooks no delivery/retry/signing/delivery log; integrations decorative; MFA policy persisted but unvalidated.
