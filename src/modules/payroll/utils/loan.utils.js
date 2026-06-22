// Ported VERBATIM from ems-frontend/src/modules/payroll/utils/loan.utils.ts (TS types stripped).
// Loan amortization. interestMethod is DATA (REDUCING | FLAT | ZERO) — a new method is a new
// branch here, never a country/loan special-case. Behavioral oracle: tests/payroll-loan.utils.test.js.
//
// NOTE on units: the FE reference uses integer minor units; this backend's payroll (run engine,
// payslips, deductions) operates in MAJOR units, so loans are stored/computed in major units to stay
// consistent with EMI recovery in payroll.repository.js. The math itself is unit-agnostic.

/** Monthly rate as a fraction (e.g. 12% p.a. → 0.01). */
export function monthlyRate(annualRatePct) {
  return annualRatePct / 100 / 12;
}

/** Advance a `YYYY-MM` period by `n` months. */
export function addMonths(period, n) {
  const [y, m] = period.split('-').map(Number);
  const offset = m - 1 + n;
  const year = y + Math.floor(offset / 12);
  const month = (offset % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Level EMI for the chosen method. */
export function computeEmi(principal, annualRatePct, tenureMonths, method) {
  if (tenureMonths <= 0) return 0;
  if (method === 'ZERO' || annualRatePct === 0) return Math.round(principal / tenureMonths);
  if (method === 'FLAT') {
    const totalInterest = principal * (annualRatePct / 100) * (tenureMonths / 12);
    return Math.round((principal + totalInterest) / tenureMonths);
  }
  // REDUCING balance
  const r = monthlyRate(annualRatePct);
  const f = Math.pow(1 + r, tenureMonths);
  return Math.round((principal * r * f) / (f - 1));
}

/** Full amortization schedule. */
export function buildSchedule(principal, annualRatePct, tenureMonths, method, startPeriod) {
  const emi = computeEmi(principal, annualRatePct, tenureMonths, method);
  const r = monthlyRate(annualRatePct);
  const flatInterestPer =
    method === 'FLAT'
      ? Math.round((principal * (annualRatePct / 100) * (tenureMonths / 12)) / tenureMonths)
      : 0;

  const schedule = [];
  let balance = principal;
  for (let i = 1; i <= tenureMonths; i++) {
    const isLast = i === tenureMonths;
    let interest;
    if (method === 'ZERO' || annualRatePct === 0) interest = 0;
    else if (method === 'FLAT') interest = flatInterestPer;
    else interest = Math.round(balance * r);

    let principalComponent = isLast ? balance : emi - interest;
    if (principalComponent > balance) principalComponent = balance;
    balance = Math.max(0, balance - principalComponent);

    schedule.push({
      installmentNo: i,
      period: addMonths(startPeriod, i - 1),
      emi: principalComponent + interest,
      principalComponent,
      interestComponent: interest,
      balanceAfter: balance,
      status: 'PENDING',
    });
  }
  return schedule;
}
