// Ported VERBATIM from ems-frontend/src/modules/holidays/utils/applicability.ts (TS types stripped).
// Best-effort per-country holiday filter + optional-selection filter. Pure, lossy, never the
// source of truth for "is this a public holiday." See docs/holidays/HOLIDAYS_BACKEND_CONTRACT_GAP.md.

export function resolveApplicableHolidays(holidays, employeeCountryCode, opts) {
  // ── Step 1: country filter ────────────────────────────────────────────────
  let afterCountry;
  if (employeeCountryCode == null) {
    afterCountry = holidays;
  } else {
    const code = employeeCountryCode.trim().toLowerCase();

    let displayName;
    try {
      displayName =
        new Intl.DisplayNames(['en'], { type: 'region' }).of(employeeCountryCode) ??
        employeeCountryCode;
    } catch {
      displayName = employeeCountryCode;
    }
    const name = displayName.toLowerCase();

    afterCountry = holidays.filter((holiday) => {
      if (holiday.location == null) return true;
      const loc = holiday.location.trim().toLowerCase();
      return loc === code || loc === name || loc.includes(name) || name.includes(loc);
    });
  }

  // ── Step 2: optional selection filter ────────────────────────────────────
  const selectedIds = opts?.selectedOptionalIds;
  if (selectedIds === undefined) return afterCountry;

  const selectionSet = new Set(selectedIds);
  return afterCountry.filter((holiday) => {
    if (!holiday.isOptional) return true; // mandatory: always keep
    return selectionSet.has(holiday.id); // optional: keep only if selected
  });
}
