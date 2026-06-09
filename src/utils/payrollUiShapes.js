/** UI contract helpers — normalize backend data to Phase 3 frontend shapes. */

export const COMPONENT_TYPE_COLORS = {
  EARNING: '#16a34a',
  DEDUCTION: '#dc2626',
  BENEFIT: '#2563eb',
  EMPLOYER_CONTRIBUTION: '#7c3aed',
};

export const PAYSLIP_SECTION_COLORS = {
  earnings: '#16a34a',
  deductions: '#dc2626',
  employerContributions: '#7c3aed',
  oneTime: '#ca8a04',
  ytd: '#0891b2',
  attendance: '#64748b',
  paymentInfo: '#64748b',
  reimbursements: '#0d9488',
};

const SECTION_ID_TO_KEY = {
  employer: 'employerContributions',
  employer_contributions: 'employerContributions',
};

/** Full section catalogue the Phase 3 payslip-template UI iterates (missing keys crash). */
export const ALL_PAYSLIP_SECTION_DEFS = [
  { key: 'earnings', label: 'Earnings', enabled: true, order: 1 },
  { key: 'deductions', label: 'Deductions', enabled: true, order: 2 },
  { key: 'employerContributions', label: 'Employer Contributions', enabled: true, order: 3 },
  { key: 'oneTime', label: 'One-Time Items', enabled: false, order: 4 },
  { key: 'ytd', label: 'Year to Date', enabled: false, order: 5 },
  { key: 'attendance', label: 'Attendance', enabled: false, order: 6 },
  { key: 'paymentInfo', label: 'Payment Info', enabled: false, order: 7 },
];

export const EVENT_CATEGORY_COLORS = {
  Run: '#6366f1',
  Payslip: '#3b82f6',
  Payment: '#ef4444',
  Employee: '#10b981',
  Claims: '#f59e0b',
};

export function componentColor(type) {
  return COMPONENT_TYPE_COLORS[type] ?? COMPONENT_TYPE_COLORS.EARNING;
}

export function withComponentColor(item) {
  const uiType = item.type === 'BENEFIT' ? 'EARNING' : item.type;
  return {
    ...item,
    type: uiType,
    color: item.color ?? componentColor(item.type),
    amount: item.amount ?? item.monthlyAmount ?? 0,
  };
}

export function normalizePayslipTemplateSection(section, index = 0) {
  const rawKey = section.key ?? section.id ?? `section-${index}`;
  const key = SECTION_ID_TO_KEY[rawKey] ?? rawKey;
  const enabled = section.enabled ?? section.visible ?? true;
  const order = section.order ?? index + 1;
  return {
    key,
    label: section.label ?? key,
    enabled,
    order,
    color: section.color ?? PAYSLIP_SECTION_COLORS[key] ?? '#64748b',
  };
}

export function normalizePayslipTemplateField(field) {
  const key = field.key ?? field.id;
  const enabled = field.enabled ?? field.visible ?? true;
  return { key, label: field.label ?? key, enabled };
}

export function fmtPayslipTemplateForUi(template) {
  if (!template) return null;
  const byKey = Object.fromEntries(
    (template.sections ?? []).map((s, i) => {
      const normalized = normalizePayslipTemplateSection(s, i);
      return [normalized.key, normalized];
    }),
  );
  const sections = ALL_PAYSLIP_SECTION_DEFS.map((def, index) =>
    normalizePayslipTemplateSection(byKey[def.key] ?? def, index),
  );
  const fields = (template.fields ?? []).map(normalizePayslipTemplateField);
  return {
    id: template.id,
    name: template.name,
    locale: template.locale,
    logoUrl: template.logoUrl ?? null,
    sections,
    fields,
    updatedAt: template.updatedAt,
  };
}

export const APPROVAL_TYPE_COLORS = {
  leave: '#3b82f6',
  regularization: '#f97316',
  timesheet: '#8b5cf6',
  asset: '#10b981',
  payroll: '#6366f1',
};

export function fmtGarnishmentForUi(row) {
  const kind = row.amount?.kind ?? row.amountKind ?? 'FLAT';
  const rawValue = row.amount?.value ?? row.amountValue ?? 0;
  const value = typeof rawValue === 'string' ? Number(rawValue) : Number(rawValue);
  return {
    id: row.id,
    employeeId: row.employeeId,
    type: row.type,
    priority: row.priority,
    amount: { kind, value: Number.isFinite(value) ? value : 0 },
    protectedEarningsFloor: row.protectedEarningsFloor != null
      ? Number(row.protectedEarningsFloor)
      : null,
    cap: row.cap != null ? Number(row.cap) : null,
    reference: row.reference ?? null,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
