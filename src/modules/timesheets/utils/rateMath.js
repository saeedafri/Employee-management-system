// Ported VERBATIM from ems-frontend/src/modules/timesheets/utils/rateMath.ts (TS types stripped).
// Pure revenue/cost/margin math for PSA reporting. Revenue = BILLABLE hours only; cost = ALL hours.
// No I/O. Behavioral oracle: tests/timesheet-rateMath.test.js.

const round2 = (n) => Math.round(n * 100) / 100;

export function computeMargins(entries, billableRate, costRate) {
  const byProject = new Map();
  for (const e of entries) {
    const row = byProject.get(e.projectId) ?? {
      projectId: e.projectId,
      revenue: 0,
      cost: 0,
      margin: 0,
    };
    if (e.billable) row.revenue = round2(row.revenue + e.hours * billableRate(e.projectId));
    row.cost = round2(row.cost + e.hours * costRate(e.employeeId));
    row.margin = round2(row.revenue - row.cost);
    byProject.set(e.projectId, row);
  }
  let revenue = 0;
  let cost = 0;
  for (const r of byProject.values()) {
    revenue = round2(revenue + r.revenue);
    cost = round2(cost + r.cost);
  }
  const margin = round2(revenue - cost);
  const marginPct = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;
  return { byProject, totals: { revenue, cost, margin, marginPct } };
}
