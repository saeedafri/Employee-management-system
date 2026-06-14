/**
 * Compute pay calendar cycles for a date range.
 * No DB writes — pure computation.
 */
import { formatPeriodLabel, getISOWeek } from './payrollPeriod.js';

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function lastWorkingDay(date) {
  const d = new Date(date);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

function resolvePayDate(cycleEnd, rule, payDay) {
  if (rule === 'SPECIFIC_DAY' && payDay) {
    return new Date(cycleEnd.getFullYear(), cycleEnd.getMonth(), payDay);
  }
  if (rule === 'NEXT_WORKING_DAY') {
    const d = new Date(cycleEnd);
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d;
  }
  return lastWorkingDay(new Date(cycleEnd));
}

/**
 * Generate cycles for a pay calendar between two YYYY-MM strings (inclusive).
 */
export function generateCycles(payCalendar, fromYYYYMM, toYYYYMM) {
  const [fy, fm] = fromYYYYMM.split('-').map(Number);
  const [ty, tm] = toYYYYMM.split('-').map(Number);
  const fromDate = new Date(fy, fm - 1, 1);
  const toDate = new Date(ty, tm, 0);

  switch (payCalendar.paySchedule) {
  case 'SEMI_MONTHLY': return genSemiMonthlyCycles(payCalendar, fromDate, toDate);
  case 'BIWEEKLY': return genBiweeklyCycles(payCalendar, fromDate, toDate);
  case 'WEEKLY': return genWeeklyCycles(payCalendar, fromDate, toDate);
  default: return genMonthlyCycles(payCalendar, fromDate, toDate);
  }
}

function genMonthlyCycles(cal, fromDate, toDate) {
  const cycles = [];
  let cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  while (cur <= toDate) {
    const y = cur.getFullYear(), m = cur.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    const period = `${y}-${String(m + 1).padStart(2, '0')}`;
    const payDate = resolvePayDate(end, cal.payDateRule, cal.payDay);
    const cutDay = Math.min(cal.cutoffDay ?? 25, end.getDate());
    cycles.push({
      period,
      periodLabel: formatPeriodLabel(period),
      startDate: fmtDate(start),
      endDate: fmtDate(end),
      payDate: fmtDate(payDate),
      cutoffDate: fmtDate(new Date(y, m, cutDay)),
      paySchedule: 'MONTHLY',
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return cycles;
}

function genSemiMonthlyCycles(cal, fromDate, toDate) {
  const cycles = [];
  let cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  while (cur <= toDate) {
    const y = cur.getFullYear(), m = cur.getMonth();
    const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`;
    const lastDay = new Date(y, m + 1, 0).getDate();

    // H1: 1–15
    const h1End = new Date(y, m, 15);
    const h1PayDate = resolvePayDate(h1End, cal.payDateRule, cal.payDay ? Math.min(Number(cal.payDay), 15) : 15);
    const h1CutDay = Math.min(cal.cutoffDay ?? 14, 14);
    cycles.push({
      period: `${monthStr}-H1`,
      periodLabel: formatPeriodLabel(`${monthStr}-H1`),
      startDate: fmtDate(new Date(y, m, 1)),
      endDate: fmtDate(h1End),
      payDate: fmtDate(h1PayDate),
      cutoffDate: fmtDate(new Date(y, m, h1CutDay)),
      paySchedule: 'SEMI_MONTHLY',
    });

    // H2: 16–EOM
    const h2End = new Date(y, m + 1, 0);
    const h2PayDate = resolvePayDate(h2End, cal.payDateRule, cal.payDay);
    const h2CutDay = Math.min(cal.cutoffDay ?? 25, lastDay);
    cycles.push({
      period: `${monthStr}-H2`,
      periodLabel: formatPeriodLabel(`${monthStr}-H2`),
      startDate: fmtDate(new Date(y, m, 16)),
      endDate: fmtDate(h2End),
      payDate: fmtDate(h2PayDate),
      cutoffDate: fmtDate(new Date(y, m, h2CutDay)),
      paySchedule: 'SEMI_MONTHLY',
    });

    cur.setMonth(cur.getMonth() + 1);
  }
  return cycles;
}

function getFirstAnchorDate(cal, fromDate) {
  if (cal.firstPayDate) {
    const anchor = new Date(cal.firstPayDate + 'T00:00:00');
    while (anchor < fromDate) anchor.setDate(anchor.getDate() + 14);
    // If overshot, step back one cycle to find the right starting cycle
    while (anchor >= fromDate) anchor.setDate(anchor.getDate() - 14);
    anchor.setDate(anchor.getDate() + 14);
    return anchor;
  }
  // Default: first Monday on or after fromDate
  const d = new Date(fromDate);
  const day = d.getDay();
  if (day !== 1) d.setDate(d.getDate() + (day === 0 ? 1 : 8 - day));
  return d;
}

function genBiweeklyCycles(cal, fromDate, toDate) {
  const cycles = [];
  let anchor = getFirstAnchorDate(cal, fromDate);

  let safety = 0;
  while (anchor <= toDate && safety++ < 200) {
    const start = new Date(anchor);
    const end = new Date(anchor);
    end.setDate(end.getDate() + 13);

    if (end >= fromDate) {
      const week = getISOWeek(start);
      const period = `${start.getFullYear()}-W${String(week).padStart(2, '0')}`;
      const payDate = resolvePayDate(end, cal.payDateRule, cal.payDay);
      cycles.push({
        period,
        periodLabel: `${fmtDate(start)} – ${fmtDate(end)}`,
        startDate: fmtDate(start),
        endDate: fmtDate(end),
        payDate: fmtDate(payDate),
        cutoffDate: fmtDate(end),
        paySchedule: 'BIWEEKLY',
      });
    }

    anchor = new Date(end);
    anchor.setDate(anchor.getDate() + 1);
  }
  return cycles;
}

function genWeeklyCycles(cal, fromDate, toDate) {
  const cycles = [];
  const anchorBase = getFirstAnchorDate(cal, fromDate);
  // For weekly, step back 7 days to get true Mon start
  let anchor = new Date(anchorBase);

  let safety = 0;
  while (anchor <= toDate && safety++ < 600) {
    const start = new Date(anchor);
    const end = new Date(anchor);
    end.setDate(end.getDate() + 6);

    if (end >= fromDate) {
      const week = getISOWeek(start);
      const period = `${start.getFullYear()}-W${String(week).padStart(2, '0')}`;
      const payDate = resolvePayDate(end, cal.payDateRule, cal.payDay);
      cycles.push({
        period,
        periodLabel: `${fmtDate(start)} – ${fmtDate(end)}`,
        startDate: fmtDate(start),
        endDate: fmtDate(end),
        payDate: fmtDate(payDate),
        cutoffDate: fmtDate(end),
        paySchedule: 'WEEKLY',
      });
    }

    anchor = new Date(end);
    anchor.setDate(anchor.getDate() + 1);
  }
  return cycles;
}
