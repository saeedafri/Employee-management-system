/**
 * Canonical permission catalogue.
 *
 * This file is the single source of truth for what is customizable per tenant.
 * `ensureTenantRolePermissionDefaults` seeds every key below into the `Permission`
 * table and grants the defaults via `RolePermission`, so a tenant editing
 * Settings -> Roles & Permissions governs real route behavior.
 *
 * Adding a permission = add a row here. Routes then reference the key via
 * `requirePermission()`; no per-route role arrays.
 *
 * Day-1 grants below reproduce each route's historical `authorize([...])`
 * membership, except where a product decision resolved the drift documented in
 * BACKEND_CONTRACT_configurable_rbac.md Gap D. Those are marked DECISION.
 */

/** module -> { key: description } */
export const PERMISSION_CATALOGUE = Object.freeze({
  employees: {
    'employees:read': 'View employee records',
    'employees:read-any': 'View any employee record, documents and photo',
    'employees:write': 'Create and update employee records',
    'employees:delete': 'Soft-delete employee records',
    'employees:export': 'Export employee data',
  },
  departments: {
    'departments:read': 'View departments',
    'departments:write': 'Create, update and delete departments',
  },
  attendance: {
    'attendance:read': 'View attendance records',
    'attendance:write': 'Check in/out and request regularization',
    'attendance:team-read': 'View team attendance records and weekly rollups',
    'attendance:approve': 'Approve or deny team attendance and regularization',
    'attendance:export': 'Export attendance data',
  },
  leave: {
    'leave:read': 'View leave records and balances',
    'leave:request': 'Submit and withdraw own leave requests',
    'leave:team-read': 'View team leave requests, calendar and coverage',
    'leave:approve': 'Approve or reject team leave requests',
    'leave:manage-types': 'Create and update leave types',
    'leave:policy-manage': 'Manage leave policy packs, policies, ledger and encashment',
    'leave:export': 'Export leave data',
  },
  holidays: {
    'holidays:read': 'View the holiday calendar',
    'holidays:write': 'Create, update, delete and import holidays',
  },
  payroll: {
    'payroll:admin': 'Manage payroll components, groups, schedules and runs',
    'payroll:super': 'Manage legal entities, statutory packs and country bank schemas',
    'payroll:self-read': 'View own salary, payslips, tax declaration, loans and reimbursements',
    'payroll:approve': 'Approve payroll runs',
    'payroll:export': 'Export payroll registers, journals and bank files',
  },
  payout: {
    'payout:self': 'Manage own payout methods',
    'payout:manage': 'Verify and approve payout methods',
  },
  reports: {
    'reports:read': 'View and generate reports',
    'reports:schedule': 'Manage scheduled reports and export history',
  },
  analytics: {
    'analytics:read': 'View tenant-wide analytics dashboards',
    'analytics:team-read': 'View the team analytics dashboard (department performance)',
  },
  permissions: {
    'permissions:manage': 'Manage roles and permissions',
  },
  settings: {
    'settings:tenant-write': 'Edit company profile and email templates',
    'settings:manage': 'Manage branding, attendance rules, leave types and custom roles',
    'settings:security': 'Manage authentication and security settings',
    'settings:integrations': 'Manage email, storage and webhook integrations',
  },
  recruitment: {
    'recruitment:read': 'View requisitions, candidates and interviews',
    'recruitment:write': 'Manage requisitions, candidates and offers',
  },
  performance: {
    'performance:read': 'View performance reviews and goals',
    'performance:manage': 'Manage review cycles and calibration',
    'performance:export': 'Export performance reviews and goals',
  },
  assets: {
    'assets:manage': 'Manage the asset inventory and assignments',
    'assets:export': 'Export the asset inventory',
  },
  announcements: {
    'announcements:read': 'View announcements',
    'announcements:write': 'Create and update announcements',
    'announcements:admin': 'Delete and pin announcements',
  },
  timesheets: {
    'timesheets:read': 'View timesheets',
    'timesheets:write': 'Create and submit timesheets',
    'timesheets:approve': 'Approve or reject team timesheets',
    'timesheets:admin': 'Manage projects and timesheet settings',
  },
  audit: {
    'audit:read': 'View audit logs',
    'audit:export': 'Export audit logs and DPIA reports',
  },
  logs: {
    'logs:read': 'View application logs',
  },
  billing: {
    'billing:read': 'View subscription, invoices and usage',
    'billing:export': 'Export the invoice list',
  },
});

export const PERMISSION_KEYS = Object.freeze(
  Object.values(PERMISSION_CATALOGUE).flatMap((group) => Object.keys(group)).sort(),
);

export function permissionDescription(key) {
  for (const group of Object.values(PERMISSION_CATALOGUE)) {
    if (group[key]) return group[key];
  }
  return key;
}

export function permissionModule(key) {
  return key.split(':')[0];
}

// SUPER_ADMIN holds every key. It also bypasses checks unconditionally in
// hasPermission()/authorize(); the explicit grant keeps the settings matrix honest.
const ALL_KEYS = PERMISSION_KEYS;

const HR_ADMIN_KEYS = ALL_KEYS.filter((key) => ![
  // SUPER_ADMIN-only surfaces (today's `superOnly`).
  'payroll:super',
  'settings:security',
  'permissions:manage',
].includes(key));

const MANAGER_KEYS = [
  'employees:read',
  'departments:read',
  'attendance:read', 'attendance:write', 'attendance:team-read', 'attendance:approve',
  'leave:read', 'leave:request', 'leave:team-read', 'leave:approve',
  'holidays:read',
  // MANAGER sees the team dashboard, not tenant-wide analytics. This used to be
  // `analytics:read` plus a hardcoded path allowlist in analytics.policy.js, which
  // made the settings matrix show Analytics ticked for a role that got 403 on all
  // but one route (FE report NEW-1). Now it is just a different key.
  'analytics:team-read',
  'payroll:self-read',
  'payout:self',
  'timesheets:read', 'timesheets:write', 'timesheets:approve',
  'recruitment:read',
  'performance:read',
  'announcements:read', 'announcements:write',
];

const EMPLOYEE_KEYS = [
  'employees:read',
  'departments:read',
  'attendance:read', 'attendance:write',
  'leave:read', 'leave:request',
  'holidays:read',
  'payroll:self-read',
  'payout:self',
  'timesheets:read', 'timesheets:write',
  'announcements:read',
];

// DECISION (2026-07-26): AUDITOR gains payroll self-service, timesheets read and
// analytics read. Resolves Gap D / audit Findings B, C, E: payroll and timesheets
// previously excluded AUDITOR while payout included it, and analytics granted
// `analytics:read` by default but never enforced it. Timesheets stays read-only.
const AUDITOR_KEYS = [
  'employees:read',
  'departments:read',
  'attendance:read',
  'leave:read',
  'holidays:read',
  'analytics:read',
  'audit:read', 'audit:export',
  'payroll:self-read',
  'payout:self',
  'timesheets:read',
  'announcements:read',
];

export const DEFAULT_PERMISSIONS_BY_ROLE = Object.freeze({
  SUPER_ADMIN: Object.freeze([...ALL_KEYS]),
  HR_ADMIN: Object.freeze([...HR_ADMIN_KEYS]),
  MANAGER: Object.freeze([...MANAGER_KEYS].sort()),
  EMPLOYEE: Object.freeze([...EMPLOYEE_KEYS].sort()),
  AUDITOR: Object.freeze([...AUDITOR_KEYS].sort()),
});

export function roleDefaultPermissions(memberType) {
  return DEFAULT_PERMISSIONS_BY_ROLE[memberType] ?? [];
}
