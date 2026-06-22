// Ported VERBATIM from ems-frontend/src/modules/timesheets/utils/budgetMath.ts (TS types stripped;
// display-only formatBudgetAmount omitted — it pulls a payroll formatter not needed server-side).
// Pure budget burn classification. No I/O. Behavioral oracle: tests/timesheet-budgetMath.test.js.

const round2 = (n) => Math.round(n * 100) / 100;

export function classifyBudget(cap, consumed, warnPct) {
  if (cap <= 0) return { burnPct: 0, status: 'OK', remaining: 0 };
  const ratio = (consumed / cap) * 100;
  const burnPct = Math.round(ratio);
  const remaining = round2(cap - consumed);
  const status = ratio >= 100 ? 'OVER' : ratio >= warnPct ? 'AT_RISK' : 'OK';
  return { burnPct, status, remaining };
}
