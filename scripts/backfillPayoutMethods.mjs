// BANK_PAYOUT_BACKEND_CONTRACT §12.1 — one-time, idempotent, ADDITIVE migration:
//   1. Seed the per-tenant country bank-schema catalog (8 countries).
//   2. Backfill one ACTIVE primary BANK payout method per employee that has legacy
//      EmployeeSalary.bank* data (UNVERIFIED — HR must verify post-migration).
// Never deletes. Safe to re-run (skips employees that already have a method).
//   Local:    DATABASE_URL=postgresql://postgres@127.0.0.1:5433/ems_local PAYOUT_ENC_KEY=<hex> node scripts/backfillPayoutMethods.mjs
//   Hostinger: docker exec ems-backend node scripts/backfillPayoutMethods.mjs
import { PrismaClient } from '@prisma/client';
import { ensureCatalogSeeded, resolveBankSchema } from '../src/modules/payroll/payout/payout.service.js';
import { validateDetails } from '../src/modules/payroll/payout/bankFieldValidation.js';
import { encryptDetails, lastTail } from '../src/modules/payroll/payout/payoutCrypto.js';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

async function main() {
  if (!process.env.PAYOUT_ENC_KEY) {
    console.error('PAYOUT_ENC_KEY is required (bank details are encrypted at rest).');
    process.exit(1);
  }
  const tenants = await prisma.tenant.findMany({ select: { id: true, tenantKey: true } });
  console.log(`Tenants: ${tenants.length}`);

  let seededTenants = 0;
  for (const t of tenants) {
    const before = await prisma.countryBankSchema.count({ where: { tenantId: t.id } });
    if (!DRY) await ensureCatalogSeeded(prisma, t.id);
    const after = DRY ? before : await prisma.countryBankSchema.count({ where: { tenantId: t.id } });
    if (after > before) seededTenants++;
  }
  console.log(`Catalog seeded for ${seededTenants} tenant(s) that had none.`);

  // Latest EmployeeSalary (with bank data) per employee.
  const salaries = await prisma.employeeSalary.findMany({
    where: { bankAccountNumber: { not: null } },
    orderBy: { effectiveFrom: 'desc' },
    select: {
      tenantId: true, employeeId: true, country: true, effectiveFrom: true,
      bankAccountName: true, bankAccountNumber: true, bankIfscCode: true, bankName: true,
    },
  });
  const seen = new Set();
  let created = 0, skipped = 0;
  for (const s of salaries) {
    if (seen.has(s.employeeId)) continue; // latest wins
    seen.add(s.employeeId);

    const existing = await prisma.payoutMethod.count({ where: { tenantId: s.tenantId, employeeId: s.employeeId } });
    if (existing > 0) { skipped++; continue; }

    const country = (s.country || 'IN').toUpperCase();
    const schema = await resolveBankSchema(prisma, s.tenantId, country);
    const currency = schema.currency;
    const rawDetails = { accountName: s.bankAccountName || '', accountNumber: s.bankAccountNumber };
    if (s.bankIfscCode) rawDetails.ifsc = s.bankIfscCode;
    if (s.bankName) rawDetails.bankName = s.bankName;
    // §11: keep only keys the resolved country schema declares (drops unknown keys, e.g. `ifsc`
    // for a non-IN country). `normalized` is the trimmed schema-key subset.
    const { ok, errors, normalized } = validateDetails(schema.fields, rawDetails);
    if (!ok) console.warn(`  ⚠️  ${s.employeeId}: legacy bank data flagged (${errors.map((e) => e.field).join(', ')}) — backfilling normalized subset, UNVERIFIED`);
    const details = normalized;

    if (DRY) { created++; continue; }
    const now = new Date();
    await prisma.payoutMethod.create({
      data: {
        tenantId: s.tenantId,
        employeeId: s.employeeId,
        type: 'BANK',
        country,
        currency,
        rail: 'BANK_LOCAL',
        label: 'Salary account',
        holderName: s.bankAccountName || '',
        detailsEnc: encryptDetails(details),
        maskedTail: lastTail(details),
        isPrimary: true,
        lifecycleStatus: 'ACTIVE',
        verificationStatus: 'UNVERIFIED',
        // Migrated methods land ACTIVE (not PENDING_APPROVAL): the migration itself is the
        // approver, so stamp the audit trail as system-requested + system-reviewed.
        requestedBy: 'system',
        requestedAt: now,
        reviewedBy: 'system',
        reviewedAt: now,
        effectiveFrom: s.effectiveFrom || now,
      },
    });
    created++;
  }
  console.log(`${DRY ? '[DRY] ' : ''}Backfilled methods: created=${created}, skipped(existing)=${skipped}`);
}

main()
  .catch((e) => { console.error('Backfill failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
