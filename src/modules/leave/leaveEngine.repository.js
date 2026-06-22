// Leave-engine persistence (Phase 4). All reads/writes tenant-scoped. Decimal deltas are
// converted to JS numbers at the boundary so the pure engine (foldBalance) sees plain numbers.

function num(d) {
  return d === null || d === undefined ? 0 : Number(d);
}

// ── Policies ───────────────────────────────────────────────────────────────
export async function listPolicies(prisma, tenantId, { country, status } = {}) {
  return prisma.leavePolicy.findMany({
    where: { tenantId, ...(country ? { country } : {}), ...(status ? { status } : {}) },
    orderBy: [{ country: 'asc' }, { version: 'asc' }],
  });
}

export async function getPolicyById(prisma, tenantId, id) {
  return prisma.leavePolicy.findFirst({ where: { tenantId, id } });
}

export async function countPoliciesForCountry(prisma, tenantId, country) {
  return prisma.leavePolicy.count({ where: { tenantId, country } });
}

export async function createPolicy(prisma, tenantId, data) {
  return prisma.leavePolicy.create({ data: { tenantId, ...data } });
}

export async function updatePolicy(prisma, tenantId, id, data) {
  return prisma.leavePolicy.updateMany({ where: { tenantId, id }, data }).then(() =>
    getPolicyById(prisma, tenantId, id),
  );
}

export async function archivePublishedForCountry(prisma, tenantId, country, exceptId) {
  return prisma.leavePolicy.updateMany({
    where: { tenantId, country, status: 'PUBLISHED', id: { not: exceptId } },
    data: { status: 'ARCHIVED' },
  });
}

// ── Assignments ────────────────────────────────────────────────────────────
export async function listAssignments(prisma, tenantId, { employeeId } = {}) {
  return prisma.leaveAssignment.findMany({
    where: { tenantId, ...(employeeId ? { employeeId } : {}) },
    orderBy: { assignedAt: 'desc' },
  });
}

export async function getAssignment(prisma, tenantId, employeeId, policyId) {
  return prisma.leaveAssignment.findFirst({ where: { tenantId, employeeId, policyId } });
}

export async function createAssignment(prisma, tenantId, data) {
  return prisma.leaveAssignment.create({ data: { tenantId, ...data } });
}

// ── Ledger ─────────────────────────────────────────────────────────────────
export async function listLedger(prisma, tenantId, { employeeId, leaveTypeId } = {}) {
  const rows = await prisma.leaveLedgerTxn.findMany({
    where: {
      tenantId,
      ...(employeeId ? { employeeId } : {}),
      ...(leaveTypeId ? { leaveTypeId } : {}),
    },
    orderBy: { postedAt: 'desc' },
  });
  return rows.map(mapLedger);
}

export async function createLedgerTxns(prisma, tenantId, txns) {
  if (txns.length === 0) return [];
  await prisma.leaveLedgerTxn.createMany({
    data: txns.map((t) => ({ tenantId, ...t, delta: t.delta })),
    skipDuplicates: true,
  });
  return txns;
}

export async function createLedgerTxn(prisma, tenantId, txn) {
  const row = await prisma.leaveLedgerTxn.create({ data: { tenantId, ...txn } });
  return mapLedger(row);
}

// ── Comp-off ───────────────────────────────────────────────────────────────
export async function listCompOff(prisma, tenantId, { employeeId, status } = {}) {
  return prisma.compOffRequest.findMany({
    where: { tenantId, ...(employeeId ? { employeeId } : {}), ...(status ? { status } : {}) },
    orderBy: { submittedAt: 'desc' },
  });
}

export async function getCompOff(prisma, tenantId, id) {
  return prisma.compOffRequest.findFirst({ where: { tenantId, id } });
}

export async function createCompOff(prisma, tenantId, data) {
  return prisma.compOffRequest.create({ data: { tenantId, ...data } });
}

export async function updateCompOff(prisma, tenantId, id, data) {
  await prisma.compOffRequest.updateMany({ where: { tenantId, id }, data });
  return getCompOff(prisma, tenantId, id);
}

// ── Employee context source ──────────────────────────────────────────────────
export async function getEmployee(prisma, tenantId, employeeId) {
  return prisma.employee.findFirst({
    where: { tenantId, id: employeeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      departmentId: true,
      joinedOn: true,
      employmentType: true,
    },
  });
}

export async function listActiveEmployees(prisma, tenantId) {
  return prisma.employee.findMany({
    where: { tenantId, employmentStatus: 'ACTIVE', deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      departmentId: true,
      joinedOn: true,
      employmentType: true,
    },
  });
}

// ── Mappers ──────────────────────────────────────────────────────────────────
const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const iso = (d) => (d ? new Date(d).toISOString() : null);

export function mapLedger(row) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    leaveTypeId: row.leaveTypeId,
    policyId: row.policyId,
    policyVersion: row.policyVersion,
    type: row.type,
    delta: num(row.delta),
    effectiveDate: ymd(row.effectiveDate),
    postedAt: iso(row.postedAt),
    leaveYear: row.leaveYear,
    sourceRef: row.sourceRef ?? undefined,
    reason: row.reason,
    systemGenerated: row.systemGenerated,
  };
}

export { num, ymd, iso };
