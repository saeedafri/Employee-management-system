// Ported VERBATIM from ems-frontend/src/modules/leave/engine/yearEnd.ts (TS types stripped).
// Pure function, no I/O. Behavioral oracle: tests/leave-engine-yearEnd.test.js.

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Posts close txns in fixed order for the closing year (spec §4.4): carry/lapse/encash.
 * The opening grant of the next year is posted by the caller after this.
 */
export function runYearEndClose(i) {
  const unused = round2(Math.max(0, i.closingBalance));
  if (unused === 0) return [];
  const { rule } = i;
  // BE-PAY-7: honour a fiscal leave-year window when the caller supplies it; otherwise default to
  // the calendar year (Dec 31 close, carry into year+1) — byte-identical to the previous behaviour.
  const eff = i.leaveYearEnd ?? `${i.year}-12-31`;
  const nextYear = i.nextYear ?? (i.year + 1);
  const out = [];

  if (rule.yearEnd === 'CARRY' && rule.carryForward.allowed) {
    const cap = rule.carryForward.cap ?? unused;
    const carried = round2(Math.min(unused, cap));
    const expired = round2(unused - carried);
    if (carried > 0) {
      out.push(
        mk(i, 'CARRY_FORWARD_IN', carried, eff, `Carry forward ${carried} into ${nextYear}`),
      );
    }
    if (expired > 0) {
      out.push(mk(i, 'CARRY_FORWARD_EXPIRED', -expired, eff, `Lapsed ${expired} over carry cap`));
    }
  } else if (rule.yearEnd === 'ENCASH') {
    out.push(mk(i, 'ENCASHED', -unused, eff, `Year-end encashment of ${unused}`));
  } else {
    // LAPSE (and CARRY when not allowed) → expire all.
    out.push(mk(i, 'CARRY_FORWARD_EXPIRED', -unused, eff, `Year-end lapse of ${unused}`));
  }
  return out;
}

function mk(i, type, delta, eff, reason) {
  return {
    id: `ye-${i.employeeId}-${i.leaveTypeId}-${i.year}-${type}`,
    employeeId: i.employeeId,
    leaveTypeId: i.leaveTypeId,
    policyId: i.policyId,
    policyVersion: i.policyVersion,
    type,
    delta,
    effectiveDate: eff,
    postedAt: `${eff}T23:59:59.000Z`,
    leaveYear: i.year,
    reason,
    systemGenerated: true,
  };
}
