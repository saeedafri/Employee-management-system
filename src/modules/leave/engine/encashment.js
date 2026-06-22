// Ported VERBATIM from ems-frontend/src/modules/leave/engine/encashment.ts (TS types stripped).
// Pure function, no I/O. Behavioral oracle: tests/leave-engine-encashment.test.js.

const round2 = (n) => Math.round(n * 100) / 100;

function applyRounding(n, mode) {
  if (mode === 'NEAREST') return Math.round(n);
  if (mode === 'DOWN') return Math.floor(n);
  if (mode === 'UP') return Math.ceil(n);
  return round2(n);
}

/** Encashment amount from config basis tags + divisor, capped by maxDays (spec §5 S-2/S-16). */
export function computeEncashment(i) {
  const days = i.config.maxDays !== undefined ? Math.min(i.days, i.config.maxDays) : i.days;
  const numerator = i.config.basisTags.reduce((s, tag) => s + (i.componentsByTag[tag] ?? 0), 0);
  const divisor = i.config.divisor === 'DAYS_30' ? 30 : i.workingDaysInMonth;
  const perDayRaw = divisor > 0 ? numerator / divisor : 0;
  const amountRaw = perDayRaw * days;
  const amount = applyRounding(amountRaw, i.config.rounding ?? 'NONE');
  return { days, perDay: round2(perDayRaw), amount };
}
