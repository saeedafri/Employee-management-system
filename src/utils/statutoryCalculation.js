/** Statutory contribution engine — uses pack contributionSchemes + component statutoryTag. */

import { fmtStatutoryPackRow } from './statutoryPackShape.js';

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

/**
 * Generic slab-based annual income tax. No country-specific branching.
 * Slab format: { from, to (null=∞), rate (%), base (fixed amount for this bracket) }
 * tax = base + rate/100 * (taxableIncome - from)  for the applicable bracket.
 */
export function computeSlabTax(taxableIncome, slabs = []) {
  if (!slabs.length || taxableIncome <= 0) return 0;
  let tax = 0;
  for (const slab of slabs) {
    const lo = Number(slab.from ?? 0);
    const hi = slab.to != null ? Number(slab.to) : Infinity;
    if (taxableIncome <= lo) continue;
    const applicable = Math.min(taxableIncome, hi);
    tax = Number(slab.base ?? 0) + (Number(slab.rate ?? 0) / 100) * (applicable - lo);
    if (taxableIncome <= hi) break;
  }
  return Math.max(0, tax);
}

/**
 * Compute annual income tax from a taxRegime object.
 * Regime fields:
 *   standardDeduction (number, subtracted before slabs)
 *   slabs             (array)
 *   surcharge         (% of pre-surcharge tax)
 *   cess              (% added after surcharge)
 *   taxCredits        (array of { code, amount })
 *
 * Returns annual tax (number). Caller divides by 12 for monthly withholding.
 */
export function computeIncomeTaxFromRegime(annualGross, taxRegime) {
  if (!taxRegime || !Array.isArray(taxRegime.slabs) || !taxRegime.slabs.length) return 0;

  const stdDeduction = Number(taxRegime.standardDeduction ?? 0);
  const taxableIncome = Math.max(0, annualGross - stdDeduction);

  let tax = computeSlabTax(taxableIncome, taxRegime.slabs);

  const surchargeRate = Number(taxRegime.surcharge ?? 0);
  if (surchargeRate > 0) tax += (surchargeRate / 100) * tax;

  const cessRate = Number(taxRegime.cess ?? 0);
  if (cessRate > 0) tax += (cessRate / 100) * tax;

  const credits = Array.isArray(taxRegime.taxCredits) ? taxRegime.taxCredits : [];
  const totalCredits = credits.reduce((s, c) => s + Number(c.amount ?? 0), 0);

  return Math.max(0, Math.round(tax - totalCredits));
}

/**
 * Resolve fiscal year metadata from a period string and fiscal year start month.
 * Returns fiscalYear (label), fiscalYearStartPeriod, fiscalYearEndPeriod.
 */
export function resolveFiscalYear(period, fiscalYearStartMonth = 4) {
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const fyStartYear = month >= fiscalYearStartMonth ? year : year - 1;
  // For calendar year (start=1) the FY ends in the same year; cross-year FY ends in fyStartYear+1
  const fyEndYear = fiscalYearStartMonth === 1 ? fyStartYear : fyStartYear + 1;
  const fyEndMonth = fiscalYearStartMonth === 1 ? 12 : fiscalYearStartMonth - 1;

  const fiscalYearStartPeriod = `${fyStartYear}-${String(fiscalYearStartMonth).padStart(2, '0')}`;
  const fiscalYearEndPeriod = `${fyEndYear}-${String(fyEndMonth).padStart(2, '0')}`;

  // Label: calendar year → just the year; cross-year → "YYYY-YY"
  const fiscalYear = fiscalYearStartMonth === 1
    ? String(fyStartYear)
    : `${fyStartYear}-${String(fyStartYear + 1).slice(2)}`;

  return { fiscalYear, fiscalYearStartPeriod, fiscalYearEndPeriod };
}

/**
 * Per-employee pack resolution with precedence:
 *   1. salary.legalEntityId → legalEntity.statutoryPackId
 *   2. salary.country → active pack for that country
 *   3. tenant default (first active legal entity) — last resort
 *
 * Returns { pack, legalEntity, fiscalYearStartMonth }
 */
export async function resolveStatutoryPackForEmployee(prisma, tenantId, salary, period) {
  const periodDate = new Date(`${period}-15T12:00:00.000Z`);

  // 1. Explicit legalEntityId on salary record
  if (salary?.legalEntityId) {
    const le = await prisma.legalEntity.findFirst({ where: { id: salary.legalEntityId, tenantId } });
    if (le) {
      if (le.statutoryPackId) {
        const row = await prisma.statutoryPack.findFirst({ where: { id: le.statutoryPackId, tenantId } });
        if (row) return { pack: fmtStatutoryPackRow(row), legalEntity: le, fiscalYearStartMonth: le.fiscalYearStartMonth ?? 4 };
      }
      // No pack pinned on legal entity; try by country from the legal entity
      const row = await prisma.statutoryPack.findFirst({
        where: { tenantId, country: le.country, effectiveFrom: { lte: periodDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodDate } }] },
        orderBy: { effectiveFrom: 'desc' },
      });
      return { pack: row ? fmtStatutoryPackRow(row) : null, legalEntity: le, fiscalYearStartMonth: le.fiscalYearStartMonth ?? 4 };
    }
  }

  // 2. salary.country → active pack for country
  const salaryCountry = salary?.country;
  if (salaryCountry) {
    const row = await prisma.statutoryPack.findFirst({
      where: { tenantId, country: salaryCountry, effectiveFrom: { lte: periodDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodDate } }] },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (row) return { pack: fmtStatutoryPackRow(row), legalEntity: null, fiscalYearStartMonth: 4 };
  }

  // 3. Tenant default: first active legal entity
  const le = await prisma.legalEntity.findFirst({ where: { tenantId, active: true }, orderBy: { createdAt: 'asc' } });
  if (le?.statutoryPackId) {
    const row = await prisma.statutoryPack.findFirst({ where: { id: le.statutoryPackId, tenantId } });
    if (row) return { pack: fmtStatutoryPackRow(row), legalEntity: le, fiscalYearStartMonth: le.fiscalYearStartMonth ?? 4 };
  }
  const country = le?.country ?? 'IN';
  const row = await prisma.statutoryPack.findFirst({
    where: { tenantId, country, effectiveFrom: { lte: periodDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodDate } }] },
    orderBy: { effectiveFrom: 'desc' },
  });
  return { pack: row ? fmtStatutoryPackRow(row) : null, legalEntity: le, fiscalYearStartMonth: le?.fiscalYearStartMonth ?? 4 };
}

// Keep for backward compat (used by legacy callers if any)
export async function resolveStatutoryPackForRun(prisma, tenantId, period) {
  return resolveStatutoryPackForEmployee(prisma, tenantId, null, period);
}
