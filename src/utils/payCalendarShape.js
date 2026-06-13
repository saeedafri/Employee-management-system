/** Pay calendar API ↔ DB mapping (frontend PayCalendar contract). */

const FREQ_TO_SCHEDULE = { MONTHLY: 'MONTHLY', SEMI_MONTHLY: 'SEMI_MONTHLY', BIWEEKLY: 'BIWEEKLY', WEEKLY: 'WEEKLY' };
const SCHEDULE_TO_FREQ = { MONTHLY: 'MONTHLY', SEMI_MONTHLY: 'SEMI_MONTHLY', BIWEEKLY: 'BIWEEKLY', WEEKLY: 'WEEKLY' };

/** Frontend contract: periodAnchor is integer day-of-month 1–28. */
export function normalizePeriodAnchor(value) {
  if (value === undefined || value === null || value === '' || value === 'MONTH_START') return 1;
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(28, Math.max(1, Math.trunc(n)));
}

export function fmtPayCalendar(row) {
  if (!row) return null;
  const frequency = row.paySchedule ?? row.frequency ?? 'MONTHLY';
  return {
    id: row.id,
    name: row.name,
    legalEntityId: row.legalEntityId ?? null,
    frequency: SCHEDULE_TO_FREQ[frequency] ?? frequency,
    periodAnchor: normalizePeriodAnchor(row.periodAnchor),
    payDateRule: row.payDateRule ?? 'LAST_WORKING_DAY',
    payDay: row.payDay ?? (frequency === 'MONTHLY' ? 30 : (frequency === 'SEMI_MONTHLY' ? 15 : (frequency === 'BIWEEKLY' ? 15 : 7))),
    cutoffDay: row.cutoffDay ?? 25,
    holidayCalendarId: row.holidayCalendarId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function payCalendarInputToDb(data, existing = {}) {
  const frequency = data.frequency ?? data.paySchedule ?? existing.paySchedule ?? 'MONTHLY';
  return {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.code !== undefined && { code: data.code.toUpperCase() }),
    ...(data.country !== undefined && { country: data.country }),
    paySchedule: FREQ_TO_SCHEDULE[frequency] ?? frequency,
    ...(data.firstPayDate !== undefined && { firstPayDate: data.firstPayDate }),
    ...(data.legalEntityId !== undefined && { legalEntityId: data.legalEntityId }),
    ...(data.periodAnchor !== undefined && { periodAnchor: String(normalizePeriodAnchor(data.periodAnchor)) }),
    ...(data.payDateRule !== undefined && { payDateRule: data.payDateRule }),
    ...(data.payDay !== undefined && { payDay: data.payDay }),
    ...(data.cutoffDay !== undefined && { cutoffDay: data.cutoffDay }),
    ...(data.holidayCalendarId !== undefined && { holidayCalendarId: data.holidayCalendarId }),
  };
}
