// Billing (Phase 8.4) — subscription, plan catalog, invoices. Mirrors the FE MSW handlers
// (ems-frontend/src/mocks/handlers/billing.ts). Read-only (no write path in the contract).
// Plan catalog + invoices are config data; subscription seat usage is enriched LIVE from the
// real active-employee count. Persisted defaults live in a tenant Setting blob (groupKey 'billing').
import { prisma } from '../../plugins/prisma.js';

const GROUP = 'billing';

export const PLANS = [
  {
    code: 'starter',
    name: 'Starter',
    price: 499,
    currency: 'INR',
    interval: 'monthly',
    seatsIncluded: 10,
    recommended: false,
    features: [
      'Core HR modules',
      'Employee directory',
      'Attendance & Leave',
      'Holidays management',
      '10 seats included',
      'Email support',
    ],
    modules: { payroll: false, recruitment: false, performance: false },
  },
  {
    code: 'professional',
    name: 'Professional',
    price: 999,
    currency: 'INR',
    interval: 'monthly',
    seatsIncluded: 50,
    recommended: true,
    features: [
      'Everything in Starter',
      'Payroll module',
      'Reports & Analytics',
      'Webhooks & Integrations',
      '50 seats included',
      'Priority support',
    ],
    modules: { payroll: true, recruitment: false, performance: false },
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    price: null,
    currency: 'INR',
    interval: 'monthly',
    seatsIncluded: null,
    recommended: false,
    features: [
      'Everything in Professional',
      'Recruitment module',
      'Performance management',
      'Unlimited seats',
      'Dedicated CSM',
      'Custom integrations',
      'SLA guarantee',
    ],
    modules: { payroll: true, recruitment: true, performance: true },
  },
];

const DEFAULT_SUBSCRIPTION = {
  plan: { code: 'professional', name: 'Professional', price: 999, currency: 'INR', interval: 'monthly' },
  status: 'active',
  seats: { total: 50, used: 25, available: 25 },
  usage: {
    apiCalls: { used: 12450, limit: 50000 },
    storage: { usedBytes: 4509715456, limitBytes: 21474836480 },
  },
  modules: { payroll: true, recruitment: false, performance: false },
  currentPeriod: { start: '2026-05-01T00:00:00.000Z', end: '2026-05-31T23:59:59.000Z' },
  nextRenewalDate: '2026-06-01T00:00:00.000Z',
  trialEndsAt: null,
};

const INVOICES = [
  { id: 'inv_01JA2B3C4D', number: 'INV-2026-005', description: 'Professional Plan — May 2026', date: '2026-05-01T00:00:00.000Z', dueDate: '2026-05-07T00:00:00.000Z', period: { start: '2026-05-01T00:00:00.000Z', end: '2026-05-31T23:59:59.000Z' }, amount: 999, currency: 'INR', status: 'paid', downloadUrl: '#' },
  { id: 'inv_01JA1A2B3C', number: 'INV-2026-004', description: 'Professional Plan — April 2026', date: '2026-04-01T00:00:00.000Z', dueDate: '2026-04-07T00:00:00.000Z', period: { start: '2026-04-01T00:00:00.000Z', end: '2026-04-30T23:59:59.000Z' }, amount: 999, currency: 'INR', status: 'paid', downloadUrl: '#' },
  { id: 'inv_01JA0Z1A2B', number: 'INV-2026-003', description: 'Professional Plan — March 2026', date: '2026-03-01T00:00:00.000Z', dueDate: '2026-03-07T00:00:00.000Z', period: { start: '2026-03-01T00:00:00.000Z', end: '2026-03-31T23:59:59.000Z' }, amount: 999, currency: 'INR', status: 'paid', downloadUrl: '#' },
  { id: 'inv_01JZ9Y0Z1A', number: 'INV-2026-002', description: 'Professional Plan — February 2026', date: '2026-02-01T00:00:00.000Z', dueDate: '2026-02-07T00:00:00.000Z', period: { start: '2026-02-01T00:00:00.000Z', end: '2026-02-28T23:59:59.000Z' }, amount: 999, currency: 'INR', status: 'paid', downloadUrl: '#' },
  { id: 'inv_01JZ8X9Y0Z', number: 'INV-2026-001', description: 'Professional Plan — January 2026', date: '2026-01-01T00:00:00.000Z', dueDate: '2026-01-07T00:00:00.000Z', period: { start: '2026-01-01T00:00:00.000Z', end: '2026-01-31T23:59:59.000Z' }, amount: 999, currency: 'INR', status: 'paid', downloadUrl: '#' },
];

async function getBlob(tenantId, key, fallback) {
  const row = await prisma.setting.findUnique({
    where: { tenantId_groupKey_settingKey: { tenantId, groupKey: GROUP, settingKey: key } },
  });
  return row ? row.valueJson : fallback;
}

export async function getSubscription(tenantId) {
  const stored = await getBlob(tenantId, 'subscription', DEFAULT_SUBSCRIPTION);
  // Enrich seat usage from the live roster (best-in-class — real data, not a fixed fixture).
  const used = await prisma.employee.count({
    where: { tenantId, employmentStatus: 'ACTIVE', deletedAt: null },
  });
  const total = stored.seats?.total ?? 50;
  return {
    ...stored,
    seats: { total, used, available: Math.max(0, total - used) },
  };
}

export function getPlans() {
  return PLANS;
}

export async function getInvoices(tenantId, page = 1, limit = 20) {
  const stored = await getBlob(tenantId, 'invoices', INVOICES);
  const start = (page - 1) * limit;
  const pageItems = stored.slice(start, start + limit);
  return {
    invoices: pageItems,
    pagination: { page, limit, total: stored.length, totalPages: Math.ceil(stored.length / limit) },
  };
}
