// Ported VERBATIM from ems-frontend/src/modules/leave/engine/applicability.ts (TS types stripped).
// Pure function, no I/O. Behavioral oracle: tests/leave-engine-applicability.test.js.
import { parseISO, isBefore, isAfter } from 'date-fns';

function inWindow(p, on) {
  if (isBefore(on, parseISO(p.effectiveFrom))) return false;
  if (p.effectiveTo && isAfter(on, parseISO(p.effectiveTo))) return false;
  return true;
}

function matches(p, e) {
  if (e.country && p.country !== e.country) return false;
  const a = p.applicability;
  if (a.legalEntityId && a.legalEntityId !== e.legalEntityId) return false;
  if (a.employmentTypes.length && !a.employmentTypes.includes(e.employmentType)) return false;
  if (a.departmentIds.length && (!e.departmentId || !a.departmentIds.includes(e.departmentId)))
    return false;
  return true;
}

/** Specificity score — more constrained applicability wins. */
function specificity(p) {
  const a = p.applicability;
  return (
    (a.legalEntityId ? 1 : 0) +
    (a.employmentTypes.length ? 1 : 0) +
    (a.departmentIds.length ? 1 : 0) +
    (a.tenureTierMonths ? 1 : 0)
  );
}

/** Resolve the best-matching PUBLISHED policy for an employee on a date (spec §5 S-12). */
export function resolvePolicyForEmployee(policies, emp, on) {
  const date = parseISO(on);
  const eligible = policies.filter(
    (p) => p.status === 'PUBLISHED' && inWindow(p, date) && matches(p, emp),
  );
  if (eligible.length === 0) return null;
  return eligible.sort((x, y) => specificity(y) - specificity(x))[0];
}
