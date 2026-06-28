// EMPLOYEE_TAX_BACKEND_CONTRACT §B2 — per-country/form-type templates for the
// employee-facing tax form (Form 16 / W-2 / P60). Drives the `TaxFormDocument`
// shape the FE renders verbatim. Config-driven: the form type selects the template;
// jurisdiction/currency/identifiers/values come from the employee's legal entity +
// YTD payroll. No `if (country === ...)` branches.

// Server pre-formats money into the document (FE prints the strings as-is).
export function formatMoney(major, currency, locale) {
  const n = Number(major) || 0;
  try {
    return new Intl.NumberFormat(locale || undefined, {
      style: 'currency', currency, maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString('en-US')}`;
  }
}

// title/authority + which statutory identifiers each party shows + the section/row layout.
// `sections(vals)` receives the pre-formatted { gross, taxable, taxDeducted, net } strings.
export const TAX_FORM_TEMPLATES = {
  FORM16: {
    title: 'Form 16',
    authority: 'Income Tax Department',
    employerIdLabels: ['TAN', 'PAN'],
    employeeIdLabels: ['PAN'],
    sections: ({ gross, taxDeducted }) => [
      { title: 'Gross Salary', rows: [
        { label: 'Salary as per section 17(1)', value: gross },
        { label: 'Total', value: gross },
      ] },
      { title: 'Tax Deducted at Source', rows: [
        { label: 'Total TDS', value: taxDeducted },
      ] },
    ],
  },
  W2: {
    title: 'Form W-2 Wage and Tax Statement',
    authority: 'Internal Revenue Service',
    employerIdLabels: ['EIN'],
    employeeIdLabels: ['SSN'],
    sections: ({ gross, taxDeducted }) => [
      { title: 'Wages', rows: [
        { label: 'Box 1 — Wages, tips, other compensation', value: gross },
      ] },
      { title: 'Federal Tax', rows: [
        { label: 'Box 2 — Federal income tax withheld', value: taxDeducted },
      ] },
    ],
  },
  P60: {
    title: 'P60 End of Year Certificate',
    authority: 'HM Revenue & Customs',
    employerIdLabels: ['PAYE Reference'],
    employeeIdLabels: ['National Insurance Number'],
    sections: ({ gross, taxDeducted }) => [
      { title: 'Pay and Income Tax', rows: [
        { label: 'Total pay for year', value: gross },
        { label: 'Total tax for year', value: taxDeducted },
      ] },
    ],
  },
};

// Default form type per country (used when the caller doesn't pass ?type=).
export const DEFAULT_FORM_TYPE_BY_COUNTRY = { IN: 'FORM16', US: 'W2', GB: 'P60' };

// Map the template's identifier labels to concrete values from a key→value source
// (employer registrationIds, or the employee's tax id), tolerating case/spacing.
export function buildIdentifiers(labels, source = {}, fallback) {
  const norm = {};
  for (const [k, v] of Object.entries(source || {})) norm[String(k).toUpperCase().replace(/\s+/g, '')] = v;
  return labels.map((label) => {
    const key = String(label).toUpperCase().replace(/\s+/g, '');
    const value = norm[key] ?? fallback ?? '—';
    return { label, value: String(value) };
  });
}
