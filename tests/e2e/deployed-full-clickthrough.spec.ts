import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const UI = process.env.DEPLOYED_UI_URL || 'https://ems-frontend-iota-ten.vercel.app';
const EVIDENCE = path.resolve('deployed-ui-full-audit-evidence');
const SHOTS = path.join(EVIDENCE, 'screenshots');

const HR = { email: 'mohammadsaeedafri9@gmail.com', password: 'Password123!' };

async function login(page) {
  await page.goto(`${UI}/login`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.fill('input[type="email"], input[name="email"]', HR.email);
  await page.fill('input[type="password"], input[name="password"]', HR.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 60000 });
}

test.describe.serial('Deployed UI full audit — HR_ADMIN', () => {
  test.beforeAll(() => {
    for (const d of [SHOTS, path.join(EVIDENCE, 'network-logs'), path.join(EVIDENCE, 'traces')]) {
      fs.mkdirSync(d, { recursive: true });
    }
  });

  test('settings and dashboard load without error boundary', async ({ page }) => {
    const apiFailures: string[] = [];
    page.on('response', async (res) => {
      if (!res.url().includes('/api/')) return;
      if (res.status() >= 400) apiFailures.push(`${res.status()} ${res.url()}`);
      if (res.url().includes('/api/')) {
        const fromSw = await res.fromServiceWorker().catch(() => false);
        expect(fromSw, `MSW intercepted ${res.url()}`).toBe(false);
      }
    });

    await login(page);

    const pages = [
      { path: '/dashboard', shot: 'dashboard_pending_approvals_loaded' },
      { path: '/settings/pay/payslip-template', shot: 'settings_payslip_template_loaded' },
      { path: '/settings/pay/schedules', shot: 'settings_pay_schedules_loaded_with_data' },
      { path: '/settings/integration-email', shot: 'settings_email_resend_loaded' },
      { path: '/settings/integration-storage', shot: 'settings_storage_cloudinary_loaded' },
      { path: '/settings/integration-webhooks', shot: 'settings_webhooks_loaded' },
      { path: '/departments', shot: 'departments_loaded' },
      { path: '/payroll', shot: 'payroll_list_loaded' },
      { path: '/timesheets', shot: 'timesheets_hr_loaded' },
    ];

    for (const p of pages) {
      await page.goto(`${UI}${p.path}`, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SHOTS, `${p.shot}.png`), fullPage: true });
      const errCount = await page.locator('text=/something went wrong|failed to load/i').count();
      expect(errCount, `Error boundary on ${p.path}. API failures: ${apiFailures.join('; ')}`).toBe(0);
    }
  });
});
