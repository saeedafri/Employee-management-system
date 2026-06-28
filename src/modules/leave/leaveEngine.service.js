// Leave-engine business logic (Phase 4). Mirrors the FE reference store
// (ems-frontend/src/mocks/data/leave-engine-store.ts) but persists to Postgres and is
// tenant + employee scoped. Balance is ALWAYS the fold of the append-only ledger.
// Config-over-code: country/policy behaviour comes from data (StatutoryPacks/LeavePolicy), never branches.
import {
  parseISO,
  isBefore,
  addDays,
  format,
} from 'date-fns';
import { foldBalance, catchUpAccrual, computeEncashment } from './engine/index.js';
import { LEAVE_STARTER_PACKS, LEAVE_TYPE_NAMES, packForCountry } from './data/leavePacks.js';
import * as repo from './leaveEngine.repository.js';

const TENANT_DEFAULT_COUNTRY = 'IN';
const today = () => new Date().toISOString().slice(0, 10);
const round2 = (n) => Math.round(n * 100) / 100;

// ── Employee context ─────────────────────────────────────────────────────────
export function buildEmployeeContext(employee, country) {
  return {
    employeeId: employee.id,
    joinDate: employee.joinedOn ? new Date(employee.joinedOn).toISOString().slice(0, 10) : today(),
    exitDate: null,
    employmentType: employee.employmentType ?? 'FULL_TIME',
    departmentId: employee.departmentId ?? undefined,
    legalEntityId: undefined,
    country: country ?? TENANT_DEFAULT_COUNTRY,
    workWeekDays: [1, 2, 3, 4, 5],
    holidays: [],
  };
}

const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

function mapPolicy(row) {
  return {
    id: row.id,
    country: row.country,
    version: row.version,
    effectiveFrom: ymd(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? ymd(row.effectiveTo) : null,
    status: row.status,
    applicability: row.applicability,
    rules: row.rules,
    statutoryFloors: row.statutoryFloors ?? undefined,
  };
}

/** Tenant policies in the LeavePolicy wire shape; falls back to starter packs when none seeded
 *  (read-only fallback — mirrors the FE store's lazy starter-pack seeding so the UI is never empty). */
export async function getTenantPolicies(prisma, tenantId) {
  const rows = await repo.listPolicies(prisma, tenantId);
  if (rows.length === 0) return LEAVE_STARTER_PACKS.map((p) => ({ ...p }));
  return rows.map(mapPolicy);
}

/** Resolve the employee's policy + its rules (mirrors store.rulesForEmployee: by-country, GLOBAL fallback). */
function rulesForEmployee(policies, ctx) {
  const country = ctx.country ?? TENANT_DEFAULT_COUNTRY;
  const forCountry = policies.filter((p) => p.country === country);
  const policy =
    forCountry.find((p) => p.status === 'PUBLISHED') ?? forCountry[0] ?? packForCountry(country);
  return policy.rules.map((rule) => ({ policy, rule }));
}

function foldFor(ledgerRows, leaveTypeCode) {
  return foldBalance(ledgerRows, leaveTypeCode);
}

/** Balance for one leave type = fold of the persisted ledger (no write-on-read). */
export function deriveBalance(ctx, leaveTypeCode, ledgerRows) {
  const folded = foldFor(ledgerRows, leaveTypeCode);
  return {
    id: `${ctx.employeeId}-${leaveTypeCode}`,
    leaveTypeId: leaveTypeCode,
    leaveTypeName: LEAVE_TYPE_NAMES[leaveTypeCode] ?? leaveTypeCode,
    leaveTypeCode,
    total: folded.granted,
    used: folded.used,
    pending: folded.pending,
    available: folded.available,
  };
}

export function getBalances(ctx, ledgerRows, policies) {
  const seen = new Set();
  const out = [];
  for (const { rule } of rulesForEmployee(policies, ctx)) {
    if (seen.has(rule.leaveTypeCode)) continue;
    seen.add(rule.leaveTypeCode);
    out.push(deriveBalance(ctx, rule.leaveTypeCode, ledgerRows));
  }
  return out;
}

function probationCleared(ctx, rule) {
  const days = rule.eligibility?.probationDays ?? 0;
  if (days === 0) return true;
  return !isBefore(parseISO(today()), addDays(parseISO(ctx.joinDate), days));
}

// ── Policy packs ─────────────────────────────────────────────────────────────
export function getStarterPacks() {
  return LEAVE_STARTER_PACKS;
}

/** Idempotently persist the starter packs (optionally for one country) for this tenant. */
export async function seedPacks(prisma, tenantId, country) {
  const packs = country
    ? LEAVE_STARTER_PACKS.filter((p) => p.country === country)
    : LEAVE_STARTER_PACKS;
  const existing = await repo.listPolicies(prisma, tenantId);
  const have = new Set(existing.map((p) => `${p.country}:${p.version}`));
  const created = [];
  for (const pack of packs) {
    if (have.has(`${pack.country}:${pack.version}`)) continue;
    const row = await repo.createPolicy(prisma, tenantId, {
      country: pack.country,
      version: pack.version,
      effectiveFrom: new Date(pack.effectiveFrom),
      effectiveTo: pack.effectiveTo ? new Date(pack.effectiveTo) : null,
      status: pack.status,
      applicability: pack.applicability,
      rules: pack.rules,
      statutoryFloors: pack.statutoryFloors ?? undefined,
    });
    created.push(mapPolicy(row));
  }
  const all = await repo.listPolicies(prisma, tenantId);
  const policies = (country ? all.filter((p) => p.country === country) : all).map(mapPolicy);
  return { seeded: created.length, policies };
}

// ── Assignments ──────────────────────────────────────────────────────────────
function mapAssignment(row) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    policyId: row.policyId,
    policyVersion: row.version,
    leaveTypeCodes: row.leaveTypeCodes,
    assignedAt: new Date(row.assignedAt).toISOString(),
    source: 'AUTO',
  };
}

export async function listAssignments(prisma, tenantId, employeeId) {
  const rows = await repo.listAssignments(prisma, tenantId, { employeeId });
  return rows.map(mapAssignment);
}

/** Auto-assign the country policy + post opening grants / accrual catch-up. Idempotent. */
export async function autoAssign(prisma, tenantId, employee, country) {
  const ctx = buildEmployeeContext(employee, country);
  const policies = await getTenantPolicies(prisma, tenantId);
  const matched = rulesForEmployee(policies, ctx);
  if (matched.length === 0) return { assignment: null, skipped: true };
  const policy = matched[0].policy;

  const existing = await repo.getAssignment(prisma, tenantId, employee.id, policy.id);
  if (existing) return { assignment: mapAssignment(existing), skipped: true };

  // Build opening grants + accrual catch-up txns from the resolved rules.
  const ledgerNow = await repo.listLedger(prisma, tenantId, { employeeId: employee.id });
  const txns = [];
  for (const { rule } of matched) {
    if (rule.grantStyle === 'UPFRONT' && probationCleared(ctx, rule)) {
      txns.push({
        id: `og-${employee.id}-${rule.leaveTypeCode}`,
        employeeId: employee.id,
        leaveTypeId: rule.leaveTypeCode,
        policyId: policy.id,
        policyVersion: policy.version,
        type: 'OPENING_GRANT',
        delta: rule.annualQuota,
        effectiveDate: new Date(today()),
        postedAt: new Date(),
        leaveYear: new Date().getFullYear(),
        reason: 'Opening grant on assignment',
        systemGenerated: true,
      });
    } else if (rule.grantStyle === 'ACCRUE' && rule.accrual) {
      const before = foldFor(ledgerNow, rule.leaveTypeCode).available;
      const res = catchUpAccrual({
        employeeId: employee.id,
        leaveTypeId: rule.leaveTypeCode,
        policyId: policy.id,
        policyVersion: policy.version,
        accrual: rule.accrual,
        joinDate: ctx.joinDate,
        exitDate: ctx.exitDate ?? null,
        prorationBasis: rule.proration.basis,
        leaveYearStart: `${new Date().getFullYear()}-01-01`,
        watermark: null,
        asOf: today(),
        balanceBefore: before,
      });
      for (const t of res.txns) {
        txns.push({
          id: t.id,
          employeeId: t.employeeId,
          leaveTypeId: t.leaveTypeId,
          policyId: t.policyId,
          policyVersion: t.policyVersion,
          type: t.type,
          delta: t.delta,
          effectiveDate: new Date(t.effectiveDate),
          postedAt: new Date(t.postedAt),
          leaveYear: t.leaveYear,
          reason: t.reason,
          systemGenerated: t.systemGenerated,
        });
      }
    }
  }
  await repo.createLedgerTxns(prisma, tenantId, txns);

  const codes = matched.map((m) => m.rule.leaveTypeCode);
  const row = await repo.createAssignment(prisma, tenantId, {
    employeeId: employee.id,
    policyId: policy.id,
    country: policy.country,
    version: policy.version,
    leaveTypeCodes: codes,
  });
  return { assignment: mapAssignment(row), skipped: false };
}

// ── Ledger ───────────────────────────────────────────────────────────────────
export async function getLedger(prisma, tenantId, employeeId, leaveTypeCode, country) {
  const employee = await repo.getEmployee(prisma, tenantId, employeeId);
  const ctx = buildEmployeeContext(employee ?? { id: employeeId }, country);
  const all = await repo.listLedger(prisma, tenantId, { employeeId });
  const entries = all
    .filter((t) => t.leaveTypeId === leaveTypeCode)
    .sort((a, b) => String(b.postedAt).localeCompare(String(a.postedAt)));
  const balance = deriveBalance(ctx, leaveTypeCode, all);
  return { entries, balance };
}

export async function getBalancesForEmployee(prisma, tenantId, employeeId, country) {
  const employee = await repo.getEmployee(prisma, tenantId, employeeId);
  const ctx = buildEmployeeContext(employee ?? { id: employeeId }, country);
  const policies = await getTenantPolicies(prisma, tenantId);
  const ledger = await repo.listLedger(prisma, tenantId, { employeeId });
  return getBalances(ctx, ledger, policies);
}

/**
 * Leave-type catalog derived from active policies — mirrors the FE leave-engine
 * `GET /leave/types` handler so `id === code === leaveTypeCode` (EL/SL/CL/CO).
 * This keeps the self-service balance↔type join working: `/leave/balance` returns
 * `leaveTypeId = code`, so `/leave/types` must key on the same code (not a DB cuid),
 * otherwise the FE join yields undefined and crashes reading `.color`. Union across
 * all policies' rules (not country-filtered) so every balance code is covered.
 */
export async function getLeaveTypesFromPolicies(prisma, tenantId) {
  const policies = await getTenantPolicies(prisma, tenantId);
  const seen = new Map();
  for (const p of policies) {
    for (const rule of p.rules ?? []) {
      if (seen.has(rule.leaveTypeCode)) continue;
      seen.set(rule.leaveTypeCode, {
        id: rule.leaveTypeCode,
        code: rule.leaveTypeCode,
        name: LEAVE_TYPE_NAMES[rule.leaveTypeCode] ?? rule.leaveTypeCode,
        annualAllowance: rule.annualQuota ?? 0,
        carryForwardAllowed: rule.carryForward?.allowed ?? false,
        isPaid: rule.isPaid ?? true,
      });
    }
  }
  return [...seen.values()];
}

// Post a leave-lifecycle ledger txn (HOLD on submit, RELEASE + TAKEN on approve,
// RELEASE on reject/withdraw). `code` is the leave-type CODE (EL/SL/CL/CO); `requestId`
// is the sourceRef the fold uses to pair a hold with its release. Consumption is signed
// negative; the fold uses Math.abs for HOLD/RELEASE/TAKEN so the sign is audit-only.
export async function postLeaveLedger(prisma, tenantId, {
  type, employeeId, code, days, requestId, reason, policyId, policyVersion,
}) {
  return repo.createLedgerTxn(prisma, tenantId, {
    employeeId,
    leaveTypeId: code,
    policyId: policyId ?? 'manual',
    policyVersion: policyVersion ?? '1',
    type,
    delta: -Math.abs(days),
    effectiveDate: new Date(today()),
    postedAt: new Date(),
    leaveYear: new Date().getFullYear(),
    sourceRef: requestId,
    reason: reason ?? 'Leave lifecycle ledger entry',
    systemGenerated: true,
  });
}

export async function postAdjustment(prisma, tenantId, employeeId, leaveTypeCode, delta, reason, country) {
  const employee = await repo.getEmployee(prisma, tenantId, employeeId);
  const ctx = buildEmployeeContext(employee ?? { id: employeeId }, country);
  const entry = await repo.createLedgerTxn(prisma, tenantId, {
    employeeId,
    leaveTypeId: leaveTypeCode,
    policyId: 'manual',
    policyVersion: '1',
    type: 'ADJUSTMENT',
    delta,
    effectiveDate: new Date(today()),
    postedAt: new Date(),
    leaveYear: new Date().getFullYear(),
    reason,
    systemGenerated: false,
  });
  const all = await repo.listLedger(prisma, tenantId, { employeeId });
  return { entry, balance: deriveBalance(ctx, leaveTypeCode, all) };
}

// ── Comp-off ───────────────────────────────────────────────────────────────
function mapCompOff(row, employeeName) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: employeeName ?? null,
    employeeCode: employeeName ?? null,
    leaveTypeId: row.leaveTypeId,
    leaveTypeName: LEAVE_TYPE_NAMES[row.leaveTypeId] ?? row.leaveTypeId,
    workDate: ymd(row.workDate),
    units: Number(row.units),
    reason: row.reason,
    status: row.status,
    expiryDate: row.expiryDate ? ymd(row.expiryDate) : null,
    submittedAt: new Date(row.submittedAt).toISOString(),
    decidedAt: row.decidedAt ? new Date(row.decidedAt).toISOString() : null,
    approverComment: row.approverComment ?? null,
  };
}

export async function eligibleCompOffTypes(prisma, tenantId, employeeId, country) {
  const employee = await repo.getEmployee(prisma, tenantId, employeeId);
  const ctx = buildEmployeeContext(employee ?? { id: employeeId }, country);
  const policies = await getTenantPolicies(prisma, tenantId);
  return rulesForEmployee(policies, ctx)
    .filter((r) => r.rule.grantStyle === 'EVENT_CREDITED' && r.rule.compOff)
    .map((r) => ({
      id: r.rule.leaveTypeCode,
      code: r.rule.leaveTypeCode,
      name: LEAVE_TYPE_NAMES[r.rule.leaveTypeCode] ?? r.rule.leaveTypeCode,
      expiryDays: r.rule.compOff.expiryDays,
    }));
}

async function employeeName(prisma, tenantId, employeeId) {
  const e = await repo.getEmployee(prisma, tenantId, employeeId);
  return e ? `${e.firstName} ${e.lastName}` : null;
}

export async function submitCompOff(prisma, tenantId, employeeId, body) {
  const row = await repo.createCompOff(prisma, tenantId, {
    employeeId,
    leaveTypeId: body.leaveTypeId,
    workDate: new Date(body.workDate),
    units: body.units,
    reason: body.reason,
    status: 'PENDING',
  });
  return mapCompOff(row, await employeeName(prisma, tenantId, employeeId));
}

export async function listCompOffRequests(prisma, tenantId, employeeId, status) {
  const rows = await repo.listCompOff(prisma, tenantId, { employeeId, status });
  const names = new Map();
  const out = [];
  for (const r of rows) {
    if (!names.has(r.employeeId)) names.set(r.employeeId, await employeeName(prisma, tenantId, r.employeeId));
    out.push(mapCompOff(r, names.get(r.employeeId)));
  }
  return out;
}

export async function approveCompOff(prisma, tenantId, id, approverId, country) {
  const req = await repo.getCompOff(prisma, tenantId, id);
  if (!req || req.status !== 'PENDING') return null;
  const employee = await repo.getEmployee(prisma, tenantId, req.employeeId);
  const ctx = buildEmployeeContext(employee ?? { id: req.employeeId }, country);
  const policies = await getTenantPolicies(prisma, tenantId);
  const match = rulesForEmployee(policies, ctx).find((r) => r.rule.leaveTypeCode === req.leaveTypeId);
  const rate = match?.rule.compOff?.rate ?? 1;
  const units = Number(req.units);

  // Post COMP_OFF_EARNED (delta = units * rate).
  await repo.createLedgerTxn(prisma, tenantId, {
    employeeId: req.employeeId,
    leaveTypeId: req.leaveTypeId,
    policyId: match?.policy.id ?? 'manual',
    policyVersion: match?.policy.version ?? '1',
    type: 'COMP_OFF_EARNED',
    delta: round2(units * rate),
    effectiveDate: new Date(req.workDate),
    postedAt: new Date(),
    leaveYear: new Date(req.workDate).getFullYear(),
    reason: `Comp-off earned for work on ${ymd(req.workDate)}`,
    systemGenerated: false,
  });

  const days = match?.rule.compOff?.expiryDays ?? 0;
  const expiryDate =
    days > 0 ? format(addDays(parseISO(ymd(req.workDate)), days), 'yyyy-MM-dd') : null;
  const updated = await repo.updateCompOff(prisma, tenantId, id, {
    status: 'APPROVED',
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    approverId,
    decidedAt: new Date(),
  });
  return mapCompOff(updated, await employeeName(prisma, tenantId, req.employeeId));
}

export async function rejectCompOff(prisma, tenantId, id, approverComment, approverId) {
  const req = await repo.getCompOff(prisma, tenantId, id);
  if (!req || req.status !== 'PENDING') return null;
  const updated = await repo.updateCompOff(prisma, tenantId, id, {
    status: 'REJECTED',
    approverComment,
    approverId,
    decidedAt: new Date(),
  });
  return mapCompOff(updated, await employeeName(prisma, tenantId, req.employeeId));
}

// ── Encashment ───────────────────────────────────────────────────────────────
export async function encash(prisma, tenantId, employeeId, leaveTypeCode, days, componentsByTag, country, workingDaysInMonth = 22) {
  const employee = await repo.getEmployee(prisma, tenantId, employeeId);
  const ctx = buildEmployeeContext(employee ?? { id: employeeId }, country);
  const policies = await getTenantPolicies(prisma, tenantId);
  const match = rulesForEmployee(policies, ctx).find((r) => r.rule.leaveTypeCode === leaveTypeCode);
  if (!match?.rule.encashment?.allowed) return null;
  const res = computeEncashment({
    config: match.rule.encashment,
    days,
    componentsByTag: componentsByTag ?? {},
    workingDaysInMonth,
  });
  const entry = await repo.createLedgerTxn(prisma, tenantId, {
    employeeId,
    leaveTypeId: leaveTypeCode,
    policyId: match.policy.id,
    policyVersion: match.policy.version,
    type: 'ENCASHED',
    delta: -res.days,
    effectiveDate: new Date(today()),
    postedAt: new Date(),
    leaveYear: new Date().getFullYear(),
    reason: `Encashed ${res.days} day(s) — ${res.amount}`,
    systemGenerated: false,
  });
  return { entry, payable: { amount: res.amount, days: res.days, perDay: res.perDay } };
}

// ── Policy versioning ────────────────────────────────────────────────────────
async function nextVersion(prisma, tenantId, country) {
  const year = new Date().getFullYear();
  const n = (await repo.countPoliciesForCountry(prisma, tenantId, country)) + 1;
  return `${year}.${n}`;
}

export async function createPolicyVersion(prisma, tenantId, input) {
  const row = await repo.createPolicy(prisma, tenantId, {
    country: input.country,
    version: await nextVersion(prisma, tenantId, input.country),
    effectiveFrom: new Date(input.effectiveFrom),
    effectiveTo: null,
    status: 'DRAFT',
    applicability: input.applicability ?? { employmentTypes: [], departmentIds: [] },
    rules: input.rules,
    statutoryFloors: input.statutoryFloors ?? undefined,
  });
  return mapPolicy(row);
}

export async function newPolicyVersion(prisma, tenantId, id) {
  const src = await repo.getPolicyById(prisma, tenantId, id);
  if (!src) return null;
  return createPolicyVersion(prisma, tenantId, {
    country: src.country,
    effectiveFrom: ymd(src.effectiveFrom),
    rules: src.rules,
    applicability: src.applicability,
    statutoryFloors: src.statutoryFloors ?? undefined,
  });
}

export async function patchDraftPolicy(prisma, tenantId, id, patch) {
  const p = await repo.getPolicyById(prisma, tenantId, id);
  if (!p) return { notFound: true };
  if (p.status !== 'DRAFT') return { immutable: true };
  const data = {};
  if (patch.rules) data.rules = patch.rules;
  if (patch.effectiveFrom) data.effectiveFrom = new Date(patch.effectiveFrom);
  if (patch.applicability) data.applicability = patch.applicability;
  const row = await repo.updatePolicy(prisma, tenantId, id, data);
  return { policy: mapPolicy(row) };
}

export async function publishPolicy(prisma, tenantId, id) {
  const p = await repo.getPolicyById(prisma, tenantId, id);
  if (!p || p.status !== 'DRAFT') return null;
  await repo.archivePublishedForCountry(prisma, tenantId, p.country, p.id);
  const row = await repo.updatePolicy(prisma, tenantId, id, { status: 'PUBLISHED' });
  return mapPolicy(row);
}

export async function listPolicies(prisma, tenantId, filters) {
  const rows = await repo.listPolicies(prisma, tenantId, filters);
  if (rows.length === 0) {
    // read-only starter-pack fallback so the policy screen is never empty (FE-parity)
    let packs = LEAVE_STARTER_PACKS.map((p) => ({ ...p }));
    if (filters?.country) packs = packs.filter((p) => p.country === filters.country);
    if (filters?.status) packs = packs.filter((p) => p.status === filters.status);
    return packs;
  }
  return rows.map(mapPolicy);
}

export { repo };
