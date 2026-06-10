import { chromium } from 'playwright';
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

async function clickFirstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 10000 });
      return true;
    }
  }
  return false;
}

async function login(page) {
  await page.goto(`${UI}/login`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.fill('input[type="email"], input[name="email"]', ACCOUNT.email);
  await page.fill('input[type="password"], input[name="password"]', ACCOUNT.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 60000 });
  await page.waitForLoadState('networkidle');
}

async function performLogout(page) {
  const directMenu = page.getByRole('button', { name: /open user menu/i });
  if (await directMenu.isVisible().catch(() => false)) {
    await directMenu.click({ timeout: 10000 });
    await page.waitForSelector('div[role="menuitem"]', { timeout: 10000 });
    const signOut = page.locator('div[role="menuitem"]:has-text("Sign out")').first();
    await signOut.waitFor({ state: 'attached', timeout: 10000 });
    await signOut.evaluate((el) => el.click());
    return true;
  }

  const direct = await clickFirstVisible(page, [
    'button:has-text("Logout")',
    'button:has-text("Log out")',
    'button:has-text("Sign out")',
    '[role="menuitem"]:has-text("Logout")',
    '[role="menuitem"]:has-text("Log out")',
    'a:has-text("Logout")',
    'a:has-text("Log out")',
  ]);
  if (direct) return true;

  await clickFirstVisible(page, [
    'button[aria-label*="profile" i]',
    'button[aria-label*="account" i]',
    'button[aria-label*="user" i]',
    'button[aria-label*="menu" i]',
    'button[title*="profile" i]',
    'button[title*="account" i]',
    'button:has-text("@")',
  ]);

  return clickFirstVisible(page, [
    'button:has-text("Logout")',
    'button:has-text("Log out")',
    'button:has-text("Sign out")',
    'div[role="menuitem"]:has-text("Sign out")',
    'div[role="menuitem"]:has-text("Logout")',
    '[role="menuitem"]:has-text("Logout")',
    '[role="menuitem"]:has-text("Log out")',
    'a:has-text("Logout")',
    'a:has-text("Log out")',
  ]);
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

const network = [];
const consoleLog = [];

page.on('console', (msg) => {
  consoleLog.push({ type: msg.type(), text: msg.text() });
});

page.on('response', async (response) => {
  const url = response.url();
  if (!url.includes('/api/')) return;
  let body = null;
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

let outcome = 'PASS';
let errorMessage = null;

try {
  await login(page);
  await page.screenshot({ path: path.join(SHOTS, '01-dashboard-before-logout.png'), fullPage: true });

  const clicked = await performLogout(page);
  if (!clicked) throw new Error('Could not find logout control in deployed UI');

  await page.waitForURL('**/login**', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, '02-after-logout-login-screen.png'), fullPage: true });

  await page.goBack({ waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, '03-after-back.png'), fullPage: true });

  await page.goto(`${UI}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForURL('**/login**', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, '04-dashboard-reload-after-logout.png'), fullPage: true });

  const authMeCalls = network.filter((row) => String(row.url).includes('/auth/me'));
  const authMe401 = authMeCalls.some((row) => Number(row.status) === 401);
  if (!String(page.url()).includes('/login') || !authMe401) {
    outcome = 'FAIL';
    errorMessage = 'Protected route remained accessible after logout or /auth/me did not return 401';
  }
} catch (error) {
  outcome = 'FAIL';
  errorMessage = error.message;
} finally {
  fs.writeFileSync(path.join(NET, 'logout-security.json'), JSON.stringify(network, null, 2));
  fs.writeFileSync(path.join(CONSOLE, 'logout-security.json'), JSON.stringify(consoleLog, null, 2));
  await context.close();
  await browser.close();
}

const report = {
  checkedAt: new Date().toISOString(),
  ui: UI,
  outcome,
  errorMessage,
  screenshotDir: SHOTS,
  networkLog: path.join(NET, 'logout-security.json'),
  consoleLog: path.join(CONSOLE, 'logout-security.json'),
};

console.log(JSON.stringify(report, null, 2));

if (outcome !== 'PASS') {
  process.exit(1);
}
