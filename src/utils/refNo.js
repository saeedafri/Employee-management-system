export function fmtRef(prefix, seqNo) {
  return `${prefix}-${String(seqNo).padStart(4, '0')}`;
}
