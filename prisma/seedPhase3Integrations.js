/**
 * Idempotent seed: pay calendars, integration settings, webhooks, payslip template normalize.
 * Run: node prisma/seedPhase3Integrations.js
 */
import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/utils/id.js';

const prisma = new PrismaClient();
const TENANT_KEY = 'acme-corp-001';

async function counts(tenantId) {
  const [runs, payslips, calendars, webhooks] = await Promise.all([
    prisma.payrollRun.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
    prisma.payslip.count({ where: { tenantId } }),
    prisma.payCalendar.count({ where: { tenantId } }),
    prisma.setting.count({ where: { tenantId, groupKey: 'integrations' } }),
  ]);
  return { runs, payslips, calendars, webhooks };
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { tenantKey: TENANT_KEY } });
  if (!tenant) throw new Error(`Tenant ${TENANT_KEY} not found`);

  console.log('Before:', await counts(tenant.id));

  const calendars = [
    { code: 'IN-MONTHLY', name: 'India Monthly', country: 'IN', paySchedule: 'MONTHLY' },
    { code: 'US-BIWEEKLY', name: 'US Bi-Weekly', country: 'US', paySchedule: 'BIWEEKLY' },
    { code: 'US-MONTHLY', name: 'US Monthly', country: 'US', paySchedule: 'MONTHLY' },
    { code: 'UK-MONTHLY', name: 'UK Monthly', country: 'GB', paySchedule: 'MONTHLY' },
    { code: 'IN-BIWEEKLY', name: 'India Bi-Weekly', country: 'IN', paySchedule: 'BIWEEKLY' },
  ];

  for (const cal of calendars) {
    const existing = await prisma.payCalendar.findFirst({ where: { tenantId: tenant.id, code: cal.code } });
    if (!existing) {
      await prisma.payCalendar.create({
        data: {
          tenantId: tenant.id,
          ...cal,
          firstPayDate: '2026-01-25',
        },
      });
    }
  }

  const template = await prisma.payslipTemplate.findUnique({ where: { tenantId: tenant.id } });
  const normalizedSections = [
    { key: 'earnings', label: 'Earnings', enabled: true, order: 1, color: '#16a34a' },
    { key: 'deductions', label: 'Deductions', enabled: true, order: 2, color: '#dc2626' },
    { key: 'employerContributions', label: 'Employer Contributions', enabled: true, order: 3, color: '#7c3aed' },
    { key: 'oneTime', label: 'One-Time Items', enabled: false, order: 4, color: '#ca8a04' },
    { key: 'ytd', label: 'Year to Date', enabled: true, order: 5, color: '#0891b2' },
    { key: 'attendance', label: 'Attendance', enabled: false, order: 6, color: '#64748b' },
    { key: 'paymentInfo', label: 'Payment Info', enabled: false, order: 7, color: '#64748b' },
  ];
  const normalizedFields = [
    { key: 'employeeCode', label: 'Employee ID', enabled: true },
    { key: 'department', label: 'Department', enabled: true },
    { key: 'designation', label: 'Designation', enabled: true },
    { key: 'pan', label: 'PAN', enabled: false },
  ];

  if (template) {
    await prisma.payslipTemplate.update({
      where: { tenantId: tenant.id },
      data: { sections: normalizedSections, fields: normalizedFields, updatedAt: new Date() },
    });
  } else {
    await prisma.payslipTemplate.create({
      data: {
        id: generateId(),
        tenantId: tenant.id,
        name: 'Acme Standard Payslip',
        locale: 'en-IN',
        sections: normalizedSections,
        fields: normalizedFields,
      },
    });
  }

  const integrationDefaults = [
    {
      settingKey: 'email',
      valueJson: {
        provider: 'resend',
        configured: true,
        enabled: true,
        fromAddress: 'onboarding@resend.dev',
        fromName: 'Acme Corp HR',
        domainVerified: true,
        updatedAt: new Date().toISOString(),
      },
    },
    {
      settingKey: 'storage',
      valueJson: {
        provider: 'cloudinary',
        configured: false,
        enabled: false,
        folder: 'ems-documents',
        photoFolder: 'ems-photos',
        metadataStore: 'postgresql',
        updatedAt: new Date().toISOString(),
      },
    },
    {
      settingKey: 'webhooks',
      valueJson: {
        webhooks: [
          {
            id: generateId(),
            name: 'HR Slack Notifications',
            url: 'https://hooks.slack.example/acme-hr',
            events: ['leave.submitted', 'timesheet.submitted', 'payroll.run.approved'],
            enabled: true,
            secretMasked: 'whsec_****demo',
            lastTriggeredAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    },
  ];

  for (const row of integrationDefaults) {
    await prisma.setting.upsert({
      where: { tenantId_groupKey_settingKey: { tenantId: tenant.id, groupKey: 'integrations', settingKey: row.settingKey } },
      create: { tenantId: tenant.id, groupKey: 'integrations', settingKey: row.settingKey, valueJson: row.valueJson },
      update: { valueJson: row.valueJson },
    });
  }

  console.log('After:', await counts(tenant.id));
  console.log('Phase 3 integrations seed complete.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
