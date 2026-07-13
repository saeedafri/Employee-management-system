/** Statutory contribution engine — uses pack contributionSchemes + component statutoryTag. */

import { fmtStatutoryPackRow } from './statutoryPackShape.js';
import { periodRepresentativeDate } from './payrollPeriod.js';
import { currencyDecimals } from './money.js';

// BE-PAY-3: apply a statutory pack's rounding policy {mode, precision} to a computed statutory/
// tax amount. When there is NO config (mode == null) this is the legacy whole-major-unit
// Math.round, so INR and any pack without a rounding block are byte-identical to before.
export function roundWith(mode, precision, value) {
  const n = Number(value) || 0;
  if (mode == null) return Math.round(n);
  const p = Number.isFinite(Number(precision)) ? Math.max(0, Math.trunc(Number(precision))) : 0;
  const factor = 10 ** p;
  const scaled = n * factor;
  // The epsilon nudge only matters when the ×factor scaling can introduce a float artefact
  // (p > 0). At p === 0 (India: precision 0) this stays byte-identical to Math.round(value).
  const eps = p > 0 ? Number.EPSILON : 0;
  const m = String(mode).toUpperCase();
  if (m === 'UP' || m === 'CEIL' || m === 'CEILING') return Math.ceil(scaled - eps) / factor;
  if (m === 'DOWN' || m === 'FLOOR' || m === 'TRUNC') return Math.floor(scaled + eps) / factor;
  return Math.round(scaled + eps) / factor; // NEAREST (default)
}

// Resolve a pack's rounding config, clamping precision to the currency's ISO-4217 minor-unit
// digits (reuses currencyDecimals) so a pack can never round finer than the currency allows.
// Returns { mode: null } when there is no config → callers fall through to the legacy round.
export function resolveRounding(rounding, currency = 'INR') {
  if (!rounding || rounding.mode == null) return { mode: null, precision: 0 };
  const maxDp = currencyDecimals(currency);
  let precision = rounding.precision == null ? 0 : Math.trunc(Number(rounding.precision));
  if (!Number.isFinite(precision) || precision < 0) precision = 0;
  if (precision > maxDp) precision = maxDp;
  return { mode: rounding.mode, precision };
}

// BE-PAY-1: convert a minor-unit config value (e.g. wageCeiling) to major units
// using the currency's ISO-4217 exponent, not a hardcoded ÷100. KWD/BHD (3dp) and
// JPY (0dp) ceilings were 10×/100× off. INR (2dp) is unchanged (÷100).
function minorToMajor(amount, currency = 'INR') {
  if (amount == null) return null;
  return Number(amount) / minorUnitFactor(currency);
}

// ISO 4217 exponent exceptions — default is 2 (×100 = minor unit factor)
const CURRENCY_MINOR_UNITS = {
  BHD: 3, JOD: 3, KWD: 3, OMR: 3, TND: 3,
  CLP: 0, JPY: 0, KRW: 0, VND: 0,
};

export function minorUnitFactor(currency = 'INR') {
  return 10 ** (CURRENCY_MINOR_UNITS[currency] ?? 2);
}

function moneyMinorToMajor(value, currency) {
  if (value == null) return value;
  return Number(value) / minorUnitFactor(currency);
}

// Major (display) units → minor (integer storage) units, ISO-4217 exponent aware.
export function moneyMajorToMinor(value, currency) {
  if (value == null) return value;
  return Math.round(Number(value) * minorUnitFactor(currency));
}

/**
 * Normalize all monetary fields in a taxRegime from minor units to major units.
 * Rates (%) are not converted. Called before passing the regime to computeIncomeTaxFromRegime.
 */
export function normalizeTaxRegimeForComputation(regime, currency) {
  if (!regime) return regime;
  return {
    ...regime,
    standardDeduction: moneyMinorToMajor(regime.standardDeduction ?? 0, currency),
    slabs: Array.isArray(regime.slabs)
      ? regime.slabs.map((s) => ({
        ...s,
        from: moneyMinorToMajor(s.from ?? 0, currency),
        to: s.to == null ? null : moneyMinorToMajor(s.to, currency),
        base: s.base == null ? null : moneyMinorToMajor(s.base, currency),
      }))
      : [],
    taxCredits: Array.isArray(regime.taxCredits)
      ? regime.taxCredits.map((c) => ({
        ...c,
        amount: moneyMinorToMajor(c.amount ?? 0, currency),
      }))
      : [],
    // Surcharge may be a scalar rate (legacy) or an array of {thresholdAnnual, rate} bands
    // (FE parity). Normalize band thresholds (minor→major); leave a scalar untouched.
    surcharge: Array.isArray(regime.surcharge)
      ? regime.surcharge.map((s) => ({ ...s, thresholdAnnual: moneyMinorToMajor(s.thresholdAnnual ?? 0, currency) }))
      : regime.surcharge,
  };
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
 * Compute statutory contributions (PF, ESI, SSS, etc.) from earnings.
 *
 * apportionmentOptions (optional):
 *   periodsPerMonth   {number}  How many pay cycles fall in this calendar month (1 for MONTHLY, 2 for SEMI_MONTHLY).
 *   isLastCycleInMonth {boolean} Whether this is the last cycle in the month. Last cycle absorbs rounding remainder.
 *
 * For schemes with apportionmentMode === 'MONTHLY_TOTAL':
 *   - Scale raw earnings up to monthly estimate, apply ceiling, compute monthly contribution.
 *   - Split across cycles; last cycle absorbs any rounding remainder.
 *   - Prevents double-charging when a contribution has a monthly cap (e.g. SSS, PF).
 *
 * For schemes without apportionmentMode (legacy / MONTHLY): unchanged behaviour.
 */
export function computeStatutoryContributions(earnings, componentByCode, contributionSchemes = [], {
  periodsPerMonth: ppm = 1,
  isLastCycleInMonth = true,
  currency = 'INR',
  rounding = null,
} = {}) {
  const statutoryDeductions = [];
  const employerContributions = [];
  const warnings = [];
  // BE-PAY-3: honour the pack's rounding policy (mode + currency-clamped precision). No config
  // → { mode: null } → roundWith falls back to the legacy Math.round (INR unchanged).
  const rnd = resolveRounding(rounding, currency);

  for (const scheme of contributionSchemes) {
    const wageBaseTag = scheme?.wageBaseTag;
    if (!wageBaseTag) continue;

    const matched = earnings.filter((e) => componentByCode.get(e.code)?.statutoryTag === wageBaseTag);
    // Bug B guardrail: a scheme demanding a wageBaseTag that NO component carries would
    // silently compute 0 and drop the contribution. Surface it instead of vanishing.
    if (matched.length === 0) {
      warnings.push(`STATUTORY_WAGE_BASE_EMPTY: scheme ${scheme.code ?? scheme.name ?? '?'} found no component tagged ${wageBaseTag}`);
      continue;
    }
    const rawBase = matched.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

    if (rawBase <= 0) continue;

    const empRate = Number(scheme.employee?.rate ?? 0);
    const erRate = Number(scheme.employer?.rate ?? 0);

    let employeeAmt, employerAmt;

    if (scheme.apportionmentMode === 'MONTHLY_TOTAL' && ppm > 1) {
      // Monthly total approach: scale up to monthly estimate, apply ceiling, split.
      const monthlyEstimatedBase = rawBase * ppm;
      let monthlyCeiledBase = monthlyEstimatedBase;
      if (scheme.wageCeiling != null) {
        const ceilingMajor = minorToMajor(scheme.wageCeiling, currency);
        if (ceilingMajor != null) monthlyCeiledBase = Math.min(monthlyEstimatedBase, ceilingMajor);
      }
      const monthlyEmpTotal = roundWith(rnd.mode, rnd.precision, (monthlyCeiledBase * empRate) / 100);
      const monthlyErTotal = roundWith(rnd.mode, rnd.precision, (monthlyCeiledBase * erRate) / 100);

      const cycleEmp = Math.floor(monthlyEmpTotal / ppm);
      const cycleEr = Math.floor(monthlyErTotal / ppm);
      // Last cycle absorbs rounding remainder so monthly total is always exact.
      employeeAmt = isLastCycleInMonth ? monthlyEmpTotal - cycleEmp * (ppm - 1) : cycleEmp;
      employerAmt = isLastCycleInMonth ? monthlyErTotal - cycleEr * (ppm - 1) : cycleEr;
    } else {
      // Standard per-cycle computation (existing behaviour — unchanged for MONTHLY).
      let base = rawBase;
      if (scheme.wageCeiling != null) {
        const ceilingMajor = minorToMajor(scheme.wageCeiling, currency);
        if (ceilingMajor != null) base = Math.min(rawBase, ceilingMajor);
      }
      employeeAmt = roundWith(rnd.mode, rnd.precision, (base * empRate) / 100);
      employerAmt = roundWith(rnd.mode, rnd.precision, (base * erRate) / 100);
    }

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

  return { statutoryDeductions, employerContributions, warnings };
}

export function sumEmployerContributions(employerContributions = []) {
  return employerContributions.reduce((s, c) => s + Number(c.amount ?? c.monthlyAmount ?? 0), 0);
}

/**
 * Generic slab-based annual income tax. Supports two slab styles:
 *
 * Style A — cumulative progressive (no base fields):
 *   { from, to, rate }
 *   Tax is accumulated across every bracket up to and including the applicable one.
 *
 * Style B — bracket shortcut (base field present on the applicable slab):
 *   { from, to, rate, base }
 *   base = cumulative tax for all prior brackets; only the applicable bracket is computed.
 *   tax = base + rate/100 * (taxableIncome - from)
 *
 * Detection: if the applicable slab has base != null, use Style B; otherwise Style A.
 */
export function computeSlabTax(taxableIncome, slabs = []) {
  if (!Array.isArray(slabs) || !slabs.length || taxableIncome <= 0) return 0;

  const sorted = [...slabs].sort((a, b) => Number(a.from ?? 0) - Number(b.from ?? 0));

  const applicable = sorted.find((slab) => {
    const lo = Number(slab.from ?? 0);
    const hi = slab.to != null ? Number(slab.to) : Infinity;
    return taxableIncome > lo && taxableIncome <= hi;
  });

  // Style B: base is explicitly provided — use it as cumulative pre-tax for prior brackets.
  if (applicable && applicable.base != null) {
    const lo = Number(applicable.from ?? 0);
    const rate = Number(applicable.rate ?? 0);
    return Math.max(0, Number(applicable.base) + ((taxableIncome - lo) * rate) / 100);
  }

  // Style A: no base — accumulate progressively across all brackets.
  let tax = 0;
  for (const slab of sorted) {
    const lo = Number(slab.from ?? 0);
    const hi = slab.to != null ? Number(slab.to) : Infinity;
    const rate = Number(slab.rate ?? 0);
    if (taxableIncome <= lo) break;
    const taxableInThisSlab = Math.min(taxableIncome, hi) - lo;
    tax += (taxableInThisSlab * rate) / 100;
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
export function computeIncomeTaxFromRegime(annualGross, taxRegime, currency = 'INR', rounding = null) {
  if (!taxRegime || !Array.isArray(taxRegime.slabs) || !taxRegime.slabs.length) return 0;

  // All pack monetary fields are in minor units — normalize before computation.
  const regime = normalizeTaxRegimeForComputation(taxRegime, currency);

  const stdDeduction = Number(regime.standardDeduction ?? 0);
  const taxableIncome = Math.max(0, annualGross - stdDeduction);

  let tax = computeSlabTax(taxableIncome, regime.slabs);

  // Surcharge: FE parity (formula.utils.computeRegimeTax). An array selects the highest
  // applicable band by thresholdAnnual (compared against the pre-standard-deduction annual,
  // as the FE does); a scalar applies a flat rate (legacy packs — byte-identical).
  const sc = regime.surcharge;
  if (Array.isArray(sc)) {
    const band = sc
      .filter((s) => annualGross > Number(s.thresholdAnnual ?? 0))
      .sort((a, b) => Number(b.thresholdAnnual ?? 0) - Number(a.thresholdAnnual ?? 0))[0];
    if (band && Number(band.rate) > 0) tax += (Number(band.rate) / 100) * tax;
  } else {
    const surchargeRate = Number(sc ?? 0);
    if (surchargeRate > 0) tax += (surchargeRate / 100) * tax;
  }

  // cess may be stored as number (rate) or as {rate} object — handle both
  const rawCess = regime.cess;
  const cessRate = typeof rawCess === 'object' && rawCess !== null
    ? Number(rawCess.rate ?? 0)
    : Number(rawCess ?? 0);
  if (cessRate > 0) tax += (cessRate / 100) * tax;

  // taxCredits already normalized to major units by normalizeTaxRegimeForComputation
  const credits = Array.isArray(regime.taxCredits) ? regime.taxCredits : [];
  const totalCredits = credits.reduce((s, c) => s + Number(c.amount ?? 0), 0);

  // BE-PAY-3: final withholding round honours the pack's rounding policy; no config → Math.round.
  const rnd = resolveRounding(rounding, currency);
  return Math.max(0, roundWith(rnd.mode, rnd.precision, tax - totalCredits));
}

/**
 * Resolve fiscal year metadata from a period string and fiscal year start month.
 * Returns fiscalYear (label), fiscalYearStartPeriod, fiscalYearEndPeriod.
 */
export function resolveFiscalYear(period, fiscalYearStartMonth = 4) {
  // Accepts YYYY-MM, YYYY-MM-H1/H2, YYYY-Wnn — only year and month parts are used.
  const parts = String(period).split('-');
  const year = parseInt(parts[0], 10);
  // parts[1] may be "MM" or "Wnn" — parseInt handles both (stops at non-digit)
  const month = parseInt(parts[1], 10) || 1;

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
export async function resolveStatutoryPackForEmployee(prisma, tenantId, salary, period, periodDateOverride = null) {
  // Resolve a date that lies inside the period for effective-dated pack lookups.
  // Sub-monthly periods (YYYY-MM-H1/H2, YYYY-Wnn) would make `${period}-15` an Invalid Date —
  // route everything through periodRepresentativeDate (throws VALIDATION_ERROR if unresolvable).
  const periodDate = periodDateOverride instanceof Date && !Number.isNaN(periodDateOverride.getTime())
    ? periodDateOverride
    : periodRepresentativeDate(period);

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

  // 2. salary.country → active pack for country; look up LE for that country to get fiscalYearStartMonth
  const salaryCountry = salary?.country;
  if (salaryCountry) {
    const row = await prisma.statutoryPack.findFirst({
      where: { tenantId, country: salaryCountry, effectiveFrom: { lte: periodDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodDate } }] },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (row) {
      // Use legal entity for this country if one exists — avoids India-biased hardcode
      const leForCountry = await prisma.legalEntity.findFirst({
        where: { tenantId, country: salaryCountry, active: true },
        orderBy: { createdAt: 'asc' },
      });
      // Default to 1 (calendar year) when no LE found — do NOT default to 4 (India Apr–Mar)
      const fyMonth = leForCountry?.fiscalYearStartMonth ?? 1;
      return { pack: fmtStatutoryPackRow(row), legalEntity: leForCountry ?? null, fiscalYearStartMonth: fyMonth };
    }
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
