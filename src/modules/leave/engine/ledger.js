// Leave balance engine — ported VERBATIM from the frontend reference
// (ems-frontend/src/modules/leave/engine/ledger.ts). Pure function, no I/O.
// Behavioral oracle: tests/leave-engine-ledger.test.js (ported from the FE Vitest test).
//
// LedgerTxnType (from leave-engine.types.ts):
//   OPENING_GRANT | ACCRUAL | CARRY_FORWARD_IN | COMP_OFF_EARNED
//   | LEAVE_TAKEN | ENCASHED | LOP_CONVERSION | CARRY_FORWARD_EXPIRED
//   | ADJUSTMENT | REVERSAL | LEAVE_PENDING_HOLD | LEAVE_PENDING_RELEASE

const POSITIVE_GRANTS = new Set([
  'OPENING_GRANT',
  'ACCRUAL',
  'CARRY_FORWARD_IN',
  'COMP_OFF_EARNED',
]);
const SETTLED_NEGATIVES = new Set([
  'LEAVE_TAKEN',
  'ENCASHED',
  'LOP_CONVERSION',
  'CARRY_FORWARD_EXPIRED',
]);

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Balance = fold over the append-only ledger (spec §4.1).
 *
 * Active holds are tracked per sourceRef: a HOLD followed by a RELEASE/TAKEN for the
 * same sourceRef cancels the hold (spec §4.2, S-7/S-8).
 *
 * @param {Array<{id:string,leaveTypeId:string,type:string,delta:number,sourceRef?:string}>} txns
 * @param {string} leaveTypeId
 * @returns {{leaveTypeId:string,granted:number,used:number,pending:number,available:number}}
 */
export function foldBalance(txns, leaveTypeId) {
  const rows = txns.filter((x) => x.leaveTypeId === leaveTypeId);
  let granted = 0;
  let used = 0;
  const holdByRef = new Map();

  for (const x of rows) {
    if (POSITIVE_GRANTS.has(x.type)) {
      granted += x.delta;
    } else if (SETTLED_NEGATIVES.has(x.type)) {
      used += Math.abs(x.delta);
    } else if (x.type === 'ADJUSTMENT' || x.type === 'REVERSAL') {
      if (x.delta >= 0) granted += x.delta;
      else used += Math.abs(x.delta);
    } else if (x.type === 'LEAVE_PENDING_HOLD') {
      const k = x.sourceRef ?? x.id;
      holdByRef.set(k, (holdByRef.get(k) ?? 0) + Math.abs(x.delta));
    } else if (x.type === 'LEAVE_PENDING_RELEASE') {
      const k = x.sourceRef ?? x.id;
      holdByRef.set(k, (holdByRef.get(k) ?? 0) - Math.abs(x.delta));
    }
  }

  let pending = 0;
  for (const v of holdByRef.values()) if (v > 0) pending += v;

  return {
    leaveTypeId,
    granted: round2(granted),
    used: round2(used),
    pending: round2(pending),
    available: round2(granted - used - pending),
  };
}
