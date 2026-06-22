// Timesheet workflow-extras (Phase 5.4/5.5): locks, audit, approval-chain, rates-config,
// budgets, cost-rates, week-config, delegations. Mirrors the FE MSW handlers
// (ems-frontend/src/mocks/handlers/timesheets.ts). Config singletons/collections persist as
// tenant Setting JSON blobs (groupKey='timesheets'); budgets are COMPUTED from real TimeEntry
// rows via the ported pure engines. Config-over-code: no hardcoded tenant/country logic.
import { prisma } from '../../plugins/prisma.js';
import { computeMargins } from './utils/rateMath.js';
import { classifyBudget } from './utils/budgetMath.js';
import { resolveWorkWeekDays, weekStartDayFromDays } from '../../utils/workingDays.js';

const GROUP = 'timesheets';
const nowIso = () => new Date().toISOString();
const round2 = (n) => Math.round(n * 100) / 100;

// ── Setting blob helpers ──────────────────────────────────────────────────────
async function getBlob(tenantId, key, fallback) {
  const row = await prisma.setting.findUnique({
    where: { tenantId_groupKey_settingKey: { tenantId, groupKey: GROUP, settingKey: key } },
  });
  return row ? row.valueJson : fallback;
}

async function setBlob(tenantId, key, value, updatedById) {
  await prisma.setting.upsert({
    where: { tenantId_groupKey_settingKey: { tenantId, groupKey: GROUP, settingKey: key } },
    create: { tenantId, groupKey: GROUP, settingKey: key, valueJson: value, updatedById },
    update: { valueJson: value, updatedById },
  });
  return value;
}

// ── Locks ──────────────────────────────────────────────────────────────────
export async function getLocks(tenantId) {
  const locks = await getBlob(tenantId, 'locks', []);
  return [...locks].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
}

export async function createLock(tenantId, body, actorName, userId) {
  if (!body.startDate || !body.endDate || body.startDate > body.endDate) {
    const e = new Error('Start date must be on or before end date.');
    e.code = 'VALIDATION';
    e.statusCode = 422;
    e.details = [{ field: 'endDate', message: 'End date must be on or after start date.' }];
    throw e;
  }
  const locks = await getBlob(tenantId, 'locks', []);
  const maxN = locks.reduce((m, l) => Math.max(m, Number(String(l.id).replace('lock-', '')) || 0), 0);
  const created = {
    id: `lock-${maxN + 1}`,
    startDate: body.startDate,
    endDate: body.endDate,
    label: body.label?.trim() || undefined,
    status: 'LOCKED',
    lockedBy: actorName,
    lockedAt: nowIso(),
  };
  await setBlob(tenantId, 'locks', [...locks, created], userId);
  return created;
}

export async function deleteLock(tenantId, id, userId) {
  const locks = await getBlob(tenantId, 'locks', []);
  await setBlob(tenantId, 'locks', locks.filter((l) => l.id !== id), userId);
  return { id, removed: true };
}

// ── Audit ────────────────────────────────────────────────────────────────────
export async function getAudit(tenantId, { timesheetId, week, employeeId } = {}) {
  const log = await getBlob(tenantId, 'auditLog', []);
  return log
    .filter(
      (a) =>
        (!timesheetId || a.timesheetId === timesheetId) &&
        (!week || a.weekStart === week) &&
        (!employeeId || a.employeeId === employeeId),
    )
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

// ── Approval chain ───────────────────────────────────────────────────────────
export async function getApprovalChain(tenantId) {
  const steps = await getBlob(tenantId, 'approvalChain', []);
  return { steps };
}

export async function patchApprovalChain(tenantId, stepsInput, userId) {
  const filtered = (stepsInput ?? []).filter((s) => s.role === 'MANAGER' || s.role === 'HR_ADMIN');
  const steps = filtered.map((s, i) => ({
    level: i + 1,
    role: s.role,
    label: s.label?.trim() || undefined,
    assignee:
      s.role === 'MANAGER' && s.assignee === 'EMPLOYEE_MANAGER' ? 'EMPLOYEE_MANAGER' : 'ROLE',
  }));
  await setBlob(tenantId, 'approvalChain', steps, userId);
  return { steps };
}

// ── Rates config ─────────────────────────────────────────────────────────────
const DEFAULT_RATES = { reportingCurrency: 'USD', warnThresholdPct: 80 };
export async function getRatesConfig(tenantId) {
  return getBlob(tenantId, 'ratesConfig', { ...DEFAULT_RATES });
}
export async function patchRatesConfig(tenantId, patch, userId) {
  const current = await getRatesConfig(tenantId);
  return setBlob(tenantId, 'ratesConfig', { ...current, ...patch }, userId);
}

// ── Cost rates ───────────────────────────────────────────────────────────────
async function seedCostRates(tenantId) {
  const employees = await prisma.employee.findMany({
    where: { tenantId, employmentStatus: 'ACTIVE', deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  return employees.map((e) => ({
    employeeId: e.id,
    employeeName: `${e.firstName} ${e.lastName}`,
    costRate: 50,
  }));
}

export async function getCostRates(tenantId, userId) {
  let rows = await getBlob(tenantId, 'costRates', null);
  if (!rows || rows.length === 0) {
    rows = await seedCostRates(tenantId);
    await setBlob(tenantId, 'costRates', rows, userId); // persist seed once so PATCH can find rows
  }
  return rows;
}

export async function patchCostRate(tenantId, employeeId, costRate, userId) {
  const rows = await getCostRates(tenantId, userId);
  const row = rows.find((c) => c.employeeId === employeeId);
  if (!row) {
    const e = new Error('Employee not found');
    e.code = 'NOT_FOUND';
    e.statusCode = 404;
    throw e;
  }
  row.costRate = costRate;
  await setBlob(tenantId, 'costRates', rows, userId);
  return row;
}

// ── Budgets (computed from real TimeEntry) ────────────────────────────────────
async function budgetStatusOf(tenantId, b, ratesConfig, costRates, projectsById) {
  const entries = await prisma.timeEntry.findMany({
    where: { tenantId, projectId: b.projectId },
    select: { projectId: true, employeeId: true, hours: true, billable: true },
  });
  const consumedHours = round2(entries.reduce((acc, e) => acc + e.hours, 0));
  const project = projectsById.get(b.projectId);
  const billableRate = () => project?.defaultRate ?? 0;
  const costRateMap = new Map(costRates.map((c) => [c.employeeId, c.costRate]));
  const costRate = (employeeId) => costRateMap.get(employeeId) ?? 0;
  const { byProject } = computeMargins(entries, billableRate, costRate);
  const consumedRevenue = round2(byProject.get(b.projectId)?.revenue ?? 0);
  const consumed = b.basis === 'HOURS' ? consumedHours : consumedRevenue;
  const { burnPct, status, remaining } = classifyBudget(b.cap, consumed, ratesConfig.warnThresholdPct);
  return {
    projectId: b.projectId,
    projectName: project?.name ?? 'Project',
    basis: b.basis,
    cap: b.cap,
    consumedHours,
    consumedRevenue,
    consumed,
    remaining,
    burnPct,
    status,
    currency: ratesConfig.reportingCurrency,
  };
}

export async function getBudgets(tenantId, userId) {
  const budgets = await getBlob(tenantId, 'budgets', []);
  if (budgets.length === 0) return [];
  const ratesConfig = await getRatesConfig(tenantId);
  const costRates = await getCostRates(tenantId, userId);
  const projects = await prisma.timesheetProject.findMany({
    where: { tenantId },
    select: { id: true, name: true, defaultRate: true },
  });
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const out = [];
  for (const b of budgets) out.push(await budgetStatusOf(tenantId, b, ratesConfig, costRates, projectsById));
  return out;
}

export async function patchBudget(tenantId, projectId, body, userId) {
  const budgets = await getBlob(tenantId, 'budgets', []);
  const idx = budgets.findIndex((b) => b.projectId === projectId);
  if (!body.cap || body.cap <= 0) {
    if (idx >= 0) budgets.splice(idx, 1);
    await setBlob(tenantId, 'budgets', budgets, userId);
    return { projectId, removed: true };
  }
  const next = { projectId, basis: body.basis, cap: body.cap };
  if (idx >= 0) budgets[idx] = next;
  else budgets.push(next);
  await setBlob(tenantId, 'budgets', budgets, userId);
  const ratesConfig = await getRatesConfig(tenantId);
  const costRates = await getCostRates(tenantId, userId);
  const projects = await prisma.timesheetProject.findMany({
    where: { tenantId },
    select: { id: true, name: true, defaultRate: true },
  });
  return budgetStatusOf(tenantId, next, ratesConfig, costRates, new Map(projects.map((p) => [p.id, p])));
}

// ── Week config ──────────────────────────────────────────────────────────────
export async function getWeekConfig(tenantId) {
  // An explicit weekConfig blob wins; otherwise derive the week-start day from the
  // canonical tenant work-week (TenantConfig) instead of a hardcoded Monday — so a
  // Sun–Thu tenant reports weekStartDay=0. (0=Sun..6=Sat.)
  const cfg = await getBlob(tenantId, 'weekConfig', null);
  if (cfg && cfg.weekStartDay != null) return { weekStartDay: cfg.weekStartDay };
  const tc = await prisma.tenantConfig.findUnique({
    where: { tenantId },
    select: { workWeekPattern: true, workWeekDays: true },
  });
  const days = resolveWorkWeekDays(tc?.workWeekDays, tc?.workWeekPattern);
  return { weekStartDay: weekStartDayFromDays(days) };
}

// ── Delegations ──────────────────────────────────────────────────────────────
export async function getDelegations(tenantId) {
  return getBlob(tenantId, 'delegations', []);
}

export async function createDelegation(tenantId, b, userId) {
  if (!b.delegateId || !b.fromDate || !b.toDate) {
    const e = new Error('delegateId, fromDate, toDate are required.');
    e.code = 'VALIDATION';
    e.statusCode = 422;
    throw e;
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(b.fromDate) || !dateRe.test(b.toDate)) {
    const e = new Error('Dates must be YYYY-MM-DD.');
    e.code = 'VALIDATION';
    e.statusCode = 422;
    throw e;
  }
  if (b.fromDate > b.toDate) {
    const e = new Error('End date must be on or after the start date.');
    e.code = 'VALIDATION';
    e.statusCode = 422;
    throw e;
  }
  const delegatorId = b.delegatorId ?? b.actorEmployeeId ?? 'self';
  if (delegatorId === b.delegateId) {
    const e = new Error('A delegate must be a different person.');
    e.code = 'VALIDATION';
    e.statusCode = 422;
    throw e;
  }
  const delegations = await getBlob(tenantId, 'delegations', []);
  const maxN = delegations.reduce((m, d) => Math.max(m, Number(String(d.id).replace('del-', '')) || 0), 100);
  const created = {
    id: `del-${maxN + 1}`,
    delegatorId,
    delegatorName: b.delegatorName ?? b.actorName ?? 'Approver',
    role: b.role ?? 'MANAGER',
    delegateId: b.delegateId,
    delegateName: b.delegateName ?? 'Delegate',
    fromDate: b.fromDate,
    toDate: b.toDate,
    reason: b.reason?.trim() || undefined,
    createdAt: nowIso(),
    createdBy: b.createdBy ?? b.actorName ?? 'Approver',
  };
  await setBlob(tenantId, 'delegations', [created, ...delegations], userId);
  return created;
}

export async function deleteDelegation(tenantId, id, userId) {
  const delegations = await getBlob(tenantId, 'delegations', []);
  if (!delegations.some((d) => d.id === id)) {
    const e = new Error('Delegation not found');
    e.code = 'NOT_FOUND';
    e.statusCode = 404;
    throw e;
  }
  await setBlob(tenantId, 'delegations', delegations.filter((d) => d.id !== id), userId);
  return { deleted: true };
}
