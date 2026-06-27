// Data access for payout methods, approvals, and the tenant bank-schema catalog.
// Thin Prisma wrappers — all business logic lives in payout.service.js.

// ── PayoutMethod ──────────────────────────────────────────────────────────────
export function createMethod(prisma, data) {
  return prisma.payoutMethod.create({ data });
}

export function findMethodById(prisma, tenantId, id) {
  return prisma.payoutMethod.findFirst({ where: { id, tenantId } });
}

export function listMethodsByEmployee(prisma, tenantId, employeeId, { includeArchived = false } = {}) {
  return prisma.payoutMethod.findMany({
    where: {
      tenantId,
      employeeId,
      ...(includeArchived ? {} : { lifecycleStatus: { not: 'ARCHIVED' } }),
    },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });
}

export function updateMethod(prisma, tenantId, id, data) {
  return prisma.payoutMethod.updateMany({ where: { id, tenantId }, data }).then(() => findMethodById(prisma, tenantId, id));
}

export function listUnverifiedBankMethods(prisma, tenantId) {
  return prisma.payoutMethod.findMany({
    where: { tenantId, type: 'BANK', lifecycleStatus: 'ACTIVE', verificationStatus: 'UNVERIFIED' },
    orderBy: { createdAt: 'asc' },
  });
}

/** Other ACTIVE-or-pending methods of the same employee+currency (to clear primary). */
export function listSameCurrencyMethods(prisma, tenantId, employeeId, currency) {
  return prisma.payoutMethod.findMany({ where: { tenantId, employeeId, currency } });
}

/** The primary, ACTIVE, BANK method for an employee (disbursement selection). */
export function findPrimaryActiveBank(prisma, tenantId, employeeId) {
  return prisma.payoutMethod.findFirst({
    where: { tenantId, employeeId, type: 'BANK', lifecycleStatus: 'ACTIVE', isPrimary: true },
  });
}

export function setPrimaryFlag(prisma, tenantId, id, isPrimary) {
  return prisma.payoutMethod.updateMany({ where: { id, tenantId }, data: { isPrimary } });
}

// ── PayoutApproval ────────────────────────────────────────────────────────────
export function createApproval(prisma, data) {
  return prisma.payoutApproval.create({ data });
}

export function findApprovalById(prisma, tenantId, id) {
  return prisma.payoutApproval.findFirst({ where: { id, tenantId } });
}

export function listApprovals(prisma, tenantId, status) {
  return prisma.payoutApproval.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    orderBy: { requestedAt: 'desc' },
  });
}

export function updateApproval(prisma, tenantId, id, data) {
  return prisma.payoutApproval.updateMany({ where: { id, tenantId }, data });
}

// ── CountryBankSchema (tenant catalog) ────────────────────────────────────────
export function listCatalog(prisma, tenantId) {
  return prisma.countryBankSchema.findMany({ where: { tenantId }, orderBy: { country: 'asc' } });
}

export function findCatalog(prisma, tenantId, country) {
  return prisma.countryBankSchema.findUnique({ where: { tenantId_country: { tenantId, country } } });
}

export function createCatalog(prisma, data) {
  return prisma.countryBankSchema.create({ data });
}

export function updateCatalog(prisma, tenantId, country, data) {
  return prisma.countryBankSchema.update({ where: { tenantId_country: { tenantId, country } }, data });
}

export function deleteCatalog(prisma, tenantId, country) {
  return prisma.countryBankSchema.delete({ where: { tenantId_country: { tenantId, country } } });
}

export function seedCatalogMany(prisma, rows) {
  return prisma.countryBankSchema.createMany({ data: rows, skipDuplicates: true });
}
