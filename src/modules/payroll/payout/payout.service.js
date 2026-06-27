// Payout-methods business logic (BANK_PAYOUT_BACKEND_CONTRACT §4–§9).
// Config-over-code: bank fields/currency/validation come from the resolved country
// bank-schema (tenant catalog → built-in seed → generic IBAN/BIC fallback). No
// `if (country === …)` anywhere. Bank identifiers encrypted at rest; reads masked.
import * as repo from './payout.repository.js';
import { ISO_COUNTRIES, GENERIC_FALLBACK_FIELDS, defaultCurrencyFor, isoCountry } from './isoCountries.js';
import { seedSchemaFor, COUNTRY_BANK_SCHEMA_SEED, SEED_TIMESTAMP } from './bankSchemaCatalog.js';
import { validateDetails } from './bankFieldValidation.js';
import { encryptDetails, decryptDetails, maskDetails, lastTail } from './payoutCrypto.js';

const FALLBACK_UPDATED_AT = '1970-01-01T00:00:00.000Z';

function AppError(message, code, statusCode = 400, details) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  if (details) err.details = details;
  return err;
}

const isoDate = (d) => (d ? new Date(d).toISOString() : null);
const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// ── Country layer ─────────────────────────────────────────────────────────────

/** Full ISO-3166 country list (FE-parity for the Country dropdowns). */
export function listCountries() {
  return ISO_COUNTRIES;
}

/**
 * Resolve a country's bank-schema: tenant catalog row → built-in seed → generic
 * IBAN/BIC fallback. Always returns `{ country, currency, fields }` — never 404.
 */
export async function resolveBankSchema(prisma, tenantId, country) {
  const code = String(country || '').toUpperCase();
  const row = await repo.findCatalog(prisma, tenantId, code);
  if (row) return { country: code, currency: row.currency, fields: row.fieldsJson };
  const seed = seedSchemaFor(code);
  if (seed) return { country: code, currency: seed.currency, fields: seed.fields };
  return { country: code, currency: defaultCurrencyFor(code), fields: GENERIC_FALLBACK_FIELDS };
}

export async function resolveCurrency(prisma, tenantId, country) {
  return (await resolveBankSchema(prisma, tenantId, country)).currency;
}

// ── Catalog CRUD (SUPER_ADMIN) ────────────────────────────────────────────────

function serializeCatalog(row) {
  return {
    country: row.country,
    currency: row.currency,
    fields: row.fieldsJson,
    updatedAt: isoDate(row.updatedAt),
    updatedBy: row.updatedBy,
  };
}

/** Seed the 8-country built-in catalog for a tenant that has none (idempotent). */
export async function ensureCatalogSeeded(prisma, tenantId) {
  const existing = await repo.listCatalog(prisma, tenantId);
  if (existing.length > 0) return existing;
  const rows = COUNTRY_BANK_SCHEMA_SEED.map((s) => ({
    tenantId,
    country: s.country,
    currency: s.currency,
    fieldsJson: s.fields,
    updatedAt: new Date(SEED_TIMESTAMP),
    updatedBy: 'system',
  }));
  await repo.seedCatalogMany(prisma, rows);
  return repo.listCatalog(prisma, tenantId);
}

export async function listCatalog(prisma, tenantId) {
  const rows = await ensureCatalogSeeded(prisma, tenantId);
  return rows.map(serializeCatalog);
}

export async function getCatalogOne(prisma, tenantId, country) {
  const code = String(country || '').toUpperCase();
  const row = await repo.findCatalog(prisma, tenantId, code);
  if (row) return serializeCatalog(row);
  // Fallback synthetic row (resolved schema) with the contract's sentinel audit fields.
  const resolved = await resolveBankSchema(prisma, tenantId, code);
  return { ...resolved, updatedAt: FALLBACK_UPDATED_AT, updatedBy: 'system' };
}

export async function createCatalog(prisma, tenantId, body, actor) {
  const code = String(body.country || '').toUpperCase();
  const existing = await repo.findCatalog(prisma, tenantId, code);
  if (existing) throw AppError('Schema already exists', 'SCHEMA_EXISTS', 409);
  const row = await repo.createCatalog(prisma, {
    tenantId,
    country: code,
    currency: body.currency,
    fieldsJson: body.fields,
    updatedAt: new Date(),
    updatedBy: actor,
  });
  return serializeCatalog(row);
}

export async function updateCatalog(prisma, tenantId, country, body, actor) {
  const code = String(country || '').toUpperCase();
  const existing = await repo.findCatalog(prisma, tenantId, code);
  if (!existing) throw AppError('Schema not found', 'NOT_FOUND', 404);
  const data = { updatedAt: new Date(), updatedBy: actor };
  if (body.currency !== undefined) data.currency = body.currency;
  if (body.fields !== undefined) data.fieldsJson = body.fields;
  const row = await repo.updateCatalog(prisma, tenantId, code, data);
  return serializeCatalog(row);
}

export async function deleteCatalog(prisma, tenantId, country) {
  const code = String(country || '').toUpperCase();
  const existing = await repo.findCatalog(prisma, tenantId, code);
  if (existing) await repo.deleteCatalog(prisma, tenantId, code);
  return { deleted: true };
}

// ── PayoutMethod serialization ────────────────────────────────────────────────

export function serializeMethod(row, { unmask = false } = {}) {
  const full = decryptDetails(row.detailsEnc);
  const details = unmask ? full : maskDetails(full);
  const approval = { requestedBy: row.requestedBy, requestedAt: isoDate(row.requestedAt) };
  if (row.reviewedBy) approval.reviewedBy = row.reviewedBy;
  if (row.reviewedAt) approval.reviewedAt = isoDate(row.reviewedAt);
  if (row.approvalNote) approval.note = row.approvalNote;
  return {
    id: row.id,
    employeeId: row.employeeId,
    type: row.type,
    country: row.country,
    currency: row.currency,
    rail: row.rail,
    label: row.label,
    holderName: row.holderName,
    details,
    maskedTail: row.maskedTail,
    isPrimary: row.isPrimary,
    lifecycleStatus: row.lifecycleStatus,
    verificationStatus: row.verificationStatus,
    approval,
    effectiveFrom: ymd(row.effectiveFrom),
    createdAt: isoDate(row.createdAt),
    updatedAt: isoDate(row.updatedAt),
    supersededById: row.supersededById ?? null,
  };
}

function serializeApproval(row) {
  const out = {
    id: row.id,
    kind: row.kind,
    employeeId: row.employeeId,
    employee: { id: row.employeeId, name: row.employeeName },
    summary: row.summary,
    requestedBy: row.requestedBy,
    requestedAt: isoDate(row.requestedAt),
  };
  if (row.diffJson != null) out.diff = row.diffJson;
  if (row.methodId) out.methodId = row.methodId;
  return out;
}

// ── PayoutMethod reads ────────────────────────────────────────────────────────

export async function listForEmployee(prisma, tenantId, employeeId) {
  const rows = await repo.listMethodsByEmployee(prisma, tenantId, employeeId);
  return { methods: rows.map((r) => serializeMethod(r)), instructions: [] };
}

export async function getMethodRaw(prisma, tenantId, id) {
  return repo.findMethodById(prisma, tenantId, id);
}

// ── Create (→ PENDING_APPROVAL + enqueue METHOD_ADD) ──────────────────────────

export async function createMethod(prisma, tenantId, employeeId, input, actorUserId, unmask = false) {
  const country = String(input.country || '').toUpperCase();
  const topErrors = [];
  const label = String(input.label ?? '').trim();
  if (label.length < 1 || label.length > 60) {
    topErrors.push({ field: 'label', message: 'Label is required (1–60 characters)' });
  }
  if (!isoCountry(country)) {
    topErrors.push({ field: 'country', message: 'Invalid country' });
  }
  const schema = await resolveBankSchema(prisma, tenantId, country);
  const { errors, normalized } = validateDetails(schema.fields, input.details);
  const allErrors = [...topErrors, ...errors];
  if (allErrors.length) throw AppError('Validation failed', 'VALIDATION_ERROR', 422, allErrors);

  const holderName = normalized.accountName ?? input.holderName ?? '';
  const maskedTail = lastTail(normalized);
  const now = new Date();
  const row = await repo.createMethod(prisma, {
    tenantId,
    employeeId,
    type: input.type || 'BANK',
    country,
    currency: schema.currency,
    rail: input.rail || 'BANK_LOCAL',
    label: input.label,
    holderName,
    detailsEnc: encryptDetails(normalized),
    maskedTail,
    isPrimary: false,
    lifecycleStatus: 'PENDING_APPROVAL',
    verificationStatus: 'UNVERIFIED',
    requestedBy: actorUserId,
    requestedAt: now,
    effectiveFrom: now,
    supersededById: null,
  });

  await repo.createApproval(prisma, {
    tenantId,
    kind: 'METHOD_ADD',
    employeeId,
    employeeName: holderName,
    summary: `Add ${input.label} (${schema.currency})`,
    methodId: row.id,
    requestedBy: actorUserId,
    requestedAt: now,
    status: 'PENDING',
    diffJson: { label: input.label, maskedTail, makePrimary: !!input.makePrimary },
  });

  // §2.3: the owner-creator may see full details (they just submitted them); HR-on-behalf masked.
  return serializeMethod(row, { unmask });
}

// ── Set-primary (→ 202 enqueue SET_PRIMARY) ───────────────────────────────────

export async function requestSetPrimary(prisma, tenantId, id, actorUserId) {
  const m = await repo.findMethodById(prisma, tenantId, id);
  if (!m) throw AppError('Method not found', 'NOT_FOUND', 404);
  const now = new Date();
  const appr = await repo.createApproval(prisma, {
    tenantId,
    kind: 'SET_PRIMARY',
    employeeId: m.employeeId,
    employeeName: m.holderName,
    summary: `Set primary → ${m.label} (${m.currency})`,
    methodId: m.id,
    requestedBy: actorUserId,
    requestedAt: now,
    status: 'PENDING',
  });
  return serializeApproval(appr);
}

// ── Archive ───────────────────────────────────────────────────────────────────

export async function archiveMethod(prisma, tenantId, id, unmask = false) {
  const m = await repo.findMethodById(prisma, tenantId, id);
  if (!m) throw AppError('Method not found', 'NOT_FOUND', 404);
  const updated = await repo.updateMethod(prisma, tenantId, id, { lifecycleStatus: 'ARCHIVED' });
  return serializeMethod(updated, { unmask }); // §2.3 owner sees full
}

// ── Approvals (maker-checker) ─────────────────────────────────────────────────

export async function listApprovals(prisma, tenantId, status = 'PENDING') {
  const rows = await repo.listApprovals(prisma, tenantId, status);
  return {
    items: rows.map(serializeApproval),
    pagination: { page: 1, pageSize: 50, total: rows.length },
  };
}

async function applyPrimaryEffect(prisma, tenantId, method) {
  const siblings = await repo.listSameCurrencyMethods(prisma, tenantId, method.employeeId, method.currency);
  for (const s of siblings) {
    await repo.setPrimaryFlag(prisma, tenantId, s.id, s.id === method.id);
  }
}

export async function approveApproval(prisma, tenantId, id, reviewerUserId, note) {
  const appr = await repo.findApprovalById(prisma, tenantId, id);
  if (!appr || appr.status !== 'PENDING') throw AppError('Approval not found', 'NOT_FOUND', 404);
  if (appr.requestedBy === reviewerUserId) {
    throw AppError('You cannot approve your own request', 'SELF_APPROVAL_FORBIDDEN', 403);
  }
  const now = new Date();
  const method = appr.methodId ? await repo.findMethodById(prisma, tenantId, appr.methodId) : null;
  if (method) {
    if (appr.kind === 'METHOD_ADD' || appr.kind === 'METHOD_EDIT') {
      await repo.updateMethod(prisma, tenantId, method.id, {
        lifecycleStatus: 'ACTIVE',
        reviewedBy: reviewerUserId,
        reviewedAt: now,
        approvalNote: note ?? null,
      });
      const fresh = await repo.findMethodById(prisma, tenantId, method.id);
      if (appr.diffJson?.makePrimary) await applyPrimaryEffect(prisma, tenantId, fresh);
    } else if (appr.kind === 'SET_PRIMARY') {
      await repo.updateMethod(prisma, tenantId, method.id, {
        reviewedBy: reviewerUserId,
        reviewedAt: now,
        approvalNote: note ?? null,
      });
      const fresh = await repo.findMethodById(prisma, tenantId, method.id);
      await applyPrimaryEffect(prisma, tenantId, fresh);
    }
  }
  await repo.updateApproval(prisma, tenantId, id, {
    status: 'APPROVED',
    reviewedBy: reviewerUserId,
    reviewedAt: now,
    note: note ?? null,
  });
  return { applied: true };
}

export async function rejectApproval(prisma, tenantId, id, reviewerUserId, note) {
  const appr = await repo.findApprovalById(prisma, tenantId, id);
  if (!appr || appr.status !== 'PENDING') throw AppError('Approval not found', 'NOT_FOUND', 404);
  const now = new Date();
  if (appr.kind === 'METHOD_ADD' && appr.methodId) {
    await repo.updateMethod(prisma, tenantId, appr.methodId, {
      lifecycleStatus: 'REJECTED',
      reviewedBy: reviewerUserId,
      reviewedAt: now,
      approvalNote: note ?? null,
    });
  }
  await repo.updateApproval(prisma, tenantId, id, {
    status: 'REJECTED',
    reviewedBy: reviewerUserId,
    reviewedAt: now,
    note: note ?? null,
  });
  return { rejected: true };
}

// ── Verification ──────────────────────────────────────────────────────────────

export async function listUnverified(prisma, tenantId) {
  const rows = await repo.listUnverifiedBankMethods(prisma, tenantId);
  return { items: rows.map((r) => serializeMethod(r)) };
}

export async function verifyMethod(prisma, tenantId, id, result, note) {
  const m = await repo.findMethodById(prisma, tenantId, id);
  if (!m) throw AppError('Method not found', 'NOT_FOUND', 404);
  if (m.lifecycleStatus !== 'ACTIVE') {
    throw AppError('Only an active account can be verified', 'NOT_ACTIVE', 409);
  }
  const updated = await repo.updateMethod(prisma, tenantId, id, {
    verificationStatus: result,
    approvalNote: note ?? m.approvalNote,
  });
  return serializeMethod(updated);
}

// ── Disbursement selection (§10) ──────────────────────────────────────────────

export const DISBURSEMENT_EXCLUSIONS = { NO_ACCOUNT: 'NO_ACCOUNT', UNVERIFIED: 'UNVERIFIED', CURRENCY_MISMATCH: 'CURRENCY_MISMATCH' };

/**
 * Resolve the payout account for one payslip line. Returns either
 * `{ method, details }` (eligible, unmasked details) or `{ excludedReason }`.
 */
export async function resolvePayoutForLine(prisma, tenantId, employeeId, payslipCurrency) {
  const method = await repo.findPrimaryActiveBank(prisma, tenantId, employeeId);
  if (!method) return { excludedReason: 'NO_ACCOUNT' };
  if (method.verificationStatus !== 'VERIFIED') return { excludedReason: 'UNVERIFIED' };
  if (method.currency !== payslipCurrency) return { excludedReason: 'CURRENCY_MISMATCH' };
  return { method, details: decryptDetails(method.detailsEnc) };
}
