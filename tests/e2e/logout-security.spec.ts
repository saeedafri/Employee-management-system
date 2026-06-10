import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const UI = process.env.DEPLOYED_UI_URL || 'https://ems-frontend-iota-ten.vercel.app';
const EVIDENCE = path.resolve('deployed-ui-logout-evidence');
const SHOTS = path.join(EVIDENCE, 'screenshots');
const NET = path.join(EVIDENCE, 'network-logs');
const CONSOLE = path.join(EVIDENCE, 'console-logs');

const ACCOUNT = {
  email: process.env.AUDIT_HR_EMAIL || 'hr@acme.test',
  password: 'Password123!',
};

for (const dir of [EVIDENCE, SHOTS, NET, CONSOLE]) fs.mkdirSync(dir, { recursive: true });

async function login(page) {
  await page.goto(`${UI}/login`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.fill('input[type="email"], input[name="email"]', ACCOUNT.email);
  await page.fill('input[type="password"], input[name="password"]', ACCOUNT.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 60000 });
  await page.waitForLoadState('networkidle');
}

async function clickFirstVisible(page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 10000 });
      return true;
    }
  }
  return false;
}

async function performLogout(page) {
  const direct = await clickFirstVisible(page, [
    'button:has-text("Logout")',
    'button:has-text("Log out")',
    'button:has-text("Sign out")',
    '[role="menuitem"]:has-text("Logout")',
    '[role="menuitem"]:has-text("Log out")',
    'a:has-text("Logout")',
    'a:has-text("Log out")',
  ]);
  if (direct) return;

  await clickFirstVisible(page, [
    'button[aria-label*="profile" i]',
    'button[aria-label*="account" i]',
    'button[aria-label*="user" i]',
    'button[aria-label*="menu" i]',
    'button[title*="profile" i]',
    'button[title*="account" i]',
    'button:has-text("@")',
  ]);

  const opened = await clickFirstVisible(page, [
    'button:has-text("Logout")',
    'button:has-text("Log out")',
    'button:has-text("Sign out")',
    '[role="menuitem"]:has-text("Logout")',
    '[role="menuitem"]:has-text("Log out")',
    'a:has-text("Logout")',
    'a:has-text("Log out")',
  ]);

  expect(opened).toBeTruthy();
}

test('logout blocks back-button and reload access', async ({ page }) => {
  const network: Array<Record<string, unknown>> = [];
  const consoleLog: Array<Record<string, unknown>> = [];

  page.on('console', (msg) => {
    consoleLog.push({ type: msg.type(), text: msg.text() });
  });

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/api/')) return;
    let body: unknown = null;
    try {
      const contentType = response.headers()['content-type'] || '';
      body = contentType.includes('json') ? await response.json() : await response.text();
    } catch {
      body = null;
    }
    network.push({
      url,
      method: response.request().method(),
      status: response.status(),
      body,
    });
  });

  await login(page);
  await page.screenshot({ path: path.join(SHOTS, '01-dashboard-before-logout.png'), fullPage: true });

  await performLogout(page);
  await page.waitForURL('**/login**', { timeout: 60000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(SHOTS, '02-after-logout-login-screen.png'), fullPage: true });

  await page.goBack({ waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, '03-after-back.png'), fullPage: true });
  expect(page.url()).toContain('/login');

  await page.goto(`${UI}/dashboard`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, '04-dashboard-reload-after-logout.png'), fullPage: true });
  expect(page.url()).toContain('/login');

  const authMeCalls = network.filter((row) => String(row.url).includes('/auth/me'));
  const authMe401 = authMeCalls.some((row) => Number(row.status) === 401);
  expect(authMe401).toBeTruthy();

  fs.writeFileSync(path.join(NET, 'logout-security.json'), JSON.stringify(network, null, 2));
  fs.writeFileSync(path.join(CONSOLE, 'logout-security.json'), JSON.stringify(consoleLog, null, 2));
});
