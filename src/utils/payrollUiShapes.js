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
  const sections = (template.sections ?? []).map(normalizePayslipTemplateSection);
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
