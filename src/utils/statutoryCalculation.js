/** Statutory contribution engine — uses pack contributionSchemes + component statutoryTag. */

import { fmtStatutoryPackRow } from './statutoryPackShape.js';

/** Pack amounts (wageCeiling etc.) are minor units; payslip earnings are major currency units. */
function minorToMajor(amount) {
  if (amount == null) return null;
  return Number(amount) / 100;
}

export function schemeManagedComponentCodes(contributionSchemes = []) {
  const employeeCodes = new Set();
  const employerCodes = new Set();
  for (const scheme of contributionSchemes) {
    if (scheme?.employee?.component) employeeCodes.add(scheme.employee.component);
    if (scheme?.employer?.component) employerCodes.add(scheme.employer.component);
  }
  return { employeeCodes, employerCodes };
}

/**
 * Compute employee statutory deductions and employer contributions from tagged earnings.
 */
export function computeStatutoryContributions(earnings, componentByCode, contributionSchemes = []) {
  const statutoryDeductions = [];
  const employerContributions = [];

  for (const scheme of contributionSchemes) {
    const wageBaseTag = scheme?.wageBaseTag;
    if (!wageBaseTag) continue;

    const rawBase = earnings
      .filter((e) => componentByCode.get(e.code)?.statutoryTag === wageBaseTag)
      .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

    if (rawBase <= 0) continue;

    let base = rawBase;
    if (scheme.wageCeiling != null) {
      const ceilingMajor = minorToMajor(scheme.wageCeiling);
      if (ceilingMajor != null) base = Math.min(rawBase, ceilingMajor);
    }

    const empRate = Number(scheme.employee?.rate ?? 0);
    const erRate = Number(scheme.employer?.rate ?? 0);
    const employeeAmt = Math.round((base * empRate) / 100);
    const employerAmt = Math.round((base * erRate) / 100);

    if (employeeAmt > 0 && scheme.employee?.component) {
      statutoryDeductions.push({
        code: scheme.employee.component,
        name: scheme.name ? `${scheme.name} (Employee)` : scheme.employee.component,
        amount: employeeAmt,
        taxable: false,
        schemeCode: scheme.code ?? null,
      });
    }
    if (employerAmt > 0 && scheme.employer?.component) {
      employerContributions.push({
        code: scheme.employer.component,
        name: scheme.name ? `${scheme.name} (Employer)` : scheme.employer.component,
        type: 'EMPLOYER_CONTRIBUTION',
        amount: employerAmt,
        monthlyAmount: employerAmt,
        taxable: false,
        schemeCode: scheme.code ?? null,
      });
    }
  }

  return { statutoryDeductions, employerContributions };
}

export function sumEmployerContributions(employerContributions = []) {
  return employerContributions.reduce((s, c) => s + Number(c.amount ?? c.monthlyAmount ?? 0), 0);
}

export async function resolveStatutoryPackForRun(prisma, tenantId, period) {
  const periodDate = new Date(`${period}-15T12:00:00.000Z`);
  const legalEntity = await prisma.legalEntity.findFirst({
    where: { tenantId, active: true },
    orderBy: { createdAt: 'asc' },
  });

  if (legalEntity?.statutoryPackId) {
    const row = await prisma.statutoryPack.findFirst({
      where: { id: legalEntity.statutoryPackId, tenantId },
    });
    if (row) return { pack: fmtStatutoryPackRow(row), legalEntity };
  }

  const country = legalEntity?.country ?? 'IN';
  const row = await prisma.statutoryPack.findFirst({
    where: {
      tenantId,
      country,
      effectiveFrom: { lte: periodDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodDate } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
  return { pack: row ? fmtStatutoryPackRow(row) : null, legalEntity };
}
