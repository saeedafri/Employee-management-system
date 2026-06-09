import { test, expect } from '@playwright/test';

const BASE = process.env.API_BASE || 'https://employee-management-system-2b9q.onrender.com/api/v1';
const TENANT = process.env.TENANT_KEY || 'acme-corp-001';

test.describe('Payroll live API contract', () => {
  test('critical payroll endpoints match frontend shape', async ({ request }) => {
    const login = await request.post(`${BASE}/auth/login`, {
      headers: { 'x-tenant-key': TENANT },
      data: { email: 'superadmin@acme.test', password: 'Password123!' },
    });
    expect(login.ok()).toBeTruthy();
    const { data: auth } = await login.json();
    const headers = { Authorization: `Bearer ${auth.accessToken}`, 'x-tenant-key': TENANT };

    const components = await request.get(`${BASE}/payroll/components`, { headers });
    expect(components.ok()).toBeTruthy();
    const compBody = await components.json();
    const comp = compBody.data?.[0];
    expect(comp).toBeTruthy();
    for (const field of ['statutoryTag', 'prorate', 'payInPeriods', 'createdAt', 'updatedAt']) {
      expect(comp, field).toHaveProperty(field);
    }

    const calendars = await request.get(`${BASE}/payroll/pay-calendars`, { headers });
    const calList = (await calendars.json()).data ?? [];
    for (const cal of calList) {
      expect(typeof cal.periodAnchor).toBe('number');
      expect(cal.periodAnchor).toBeGreaterThanOrEqual(1);
      expect(cal.periodAnchor).toBeLessThanOrEqual(28);
    }

    const entities = await request.get(`${BASE}/payroll/legal-entities`, { headers });
    const le = (await entities.json()).data?.[0];
    if (le) expect(le).toHaveProperty('active');

    for (const path of ['/payroll/employees', '/payroll/migration', '/payroll/payment-batches', '/payroll/reports', '/payroll/settings']) {
      const res = await request.get(`${BASE}${path}`, { headers });
      expect(res.status(), path).toBe(200);
    }
  });
});
