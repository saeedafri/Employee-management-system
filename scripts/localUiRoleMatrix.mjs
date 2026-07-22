#!/usr/bin/env node
/**
 * Strict local UI role matrix against http://localhost:3001 (MSW off → local BE :4000).
 * Usage: node scripts/localUiRoleMatrix.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

// Use localhost (not 127.0.0.1) — Next.js 15 blocks cross-origin HMR/dev from 127.0.0.1.
const BASE = process.env.UI_BASE || 'http://localhost:3001';
const OUT = path.resolve('docs/local-ui-e2e');
const PAGES = [
  '/dashboard',
  '/employees',
  '/departments',
  '/attendance',
  '/timesheets',
  '/leave',
  '/holidays',
  '/payroll',
  '/payout-methods',
  '/reports',
  '/analytics',
  '/permissions',
  '/settings',
  '/recruitment',
  '/performance',
  '/assets',
  '/announcements',
];

const ROLES = [
  { id: 'SUPER_ADMIN', email: 'superadmin@acme.test', password: 'Password123!' },
  { id: 'HR_ADMIN', email: 'hr@acme.test', password: 'Password123!' },
  { id: 'MANAGER', email: 'aman@acme.test', password: 'Password123!' },
  { id: 'EMPLOYEE', email: 'priya@acme.test', password: 'Password123!' },
];

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true });

function classify(text, url) {
  const t = text || '';
  if (/Access restricted/i.test(t)) return { ok: false, status: 'DENY', err: 'Access restricted' };
  if (/Something went wrong|Failed to load/i.test(t)) {
    const m = t.match(/Failed to load[^\n.]{0,80}|Something went wrong[^\n.]{0,80}/i);
    return { ok: false, status: 'FAIL', err: (m && m[0]) || 'Something went wrong' };
  }
  if (/Sign in/i.test(t) && /Work email/i.test(t) && !/dashboard|Welcome|Hi,/i.test(t)) {
    return { ok: false, status: 'FAIL', err: 'redirected to login' };
  }
  return { ok: true, status: 'OK', err: null, url };
}

async function login(page, email, password) {
  // Prefer BFF fetch login (sets httpOnly cookies) — avoids LoginForm hydration flakiness.
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  const result = await page.evaluate(async ({ email: e, password: p }) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: e, password: p }),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, success: !!json.success, memberType: json?.data?.user?.memberType || null };
  }, { email, password });
  if (!result.success) {
    throw new Error(`BFF login failed for ${email}: ${JSON.stringify(result)}`);
  }
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  if (page.url().includes('/login')) {
    // Fallback: UI form click
    await page.locator('input[placeholder="you@company.com"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForTimeout(4000);
  }
  if (page.url().includes('/login')) {
    throw new Error(`Login failed for ${email} after BFF+form`);
  }
}

async function signOut(page) {
  try {
    await page.getByRole('button', { name: /open user menu/i }).click({ timeout: 5000 });
    await page.getByRole('menuitem', { name: /sign out/i }).click({ timeout: 5000 });
    await page.waitForURL(/\/login/, { timeout: 15000 });
  } catch {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  }
}

async function probePage(page, roleId, route) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);
  const text = await page.locator('body').innerText();
  const h1 = await page.locator('h1').first().textContent().catch(() => null);
  const result = classify(text, page.url());
  const shot = path.join(OUT, 'screenshots', `${roleId}${route.replace(/\//g, '_') || '_root'}.png`);
  await page.screenshot({ path: shot, fullPage: false });
  const nav = await page.locator('nav a, aside a').allTextContents().catch(() => []);
  return {
    path: route,
    finalUrl: page.url(),
    h1: h1?.trim() || null,
    ...result,
    screenshot: path.relative(process.cwd(), shot),
    nav: [...new Set(nav.map((n) => n.trim()).filter(Boolean))],
  };
}

const report = {
  base: BASE,
  startedAt: new Date().toISOString(),
  roles: {},
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

for (const role of ROLES) {
  console.log(`\n=== ${role.id} ${role.email} ===`);
  await login(page, role.email, role.password);
  const pages = [];
  for (const route of PAGES) {
    const r = await probePage(page, role.id, route);
    pages.push(r);
    console.log(`${r.status.padEnd(4)} ${route} → ${r.finalUrl} ${r.err || r.h1 || ''}`);
  }
  // notifications bell on dashboard
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  let notifications = { ok: false, err: 'not opened' };
  try {
    await page.getByRole('button', { name: /notifications/i }).click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    const shot = path.join(OUT, 'screenshots', `${role.id}_notifications.png`);
    await page.screenshot({ path: shot, fullPage: false });
    notifications = { ok: true, status: 'OK', screenshot: path.relative(process.cwd(), shot) };
  } catch (e) {
    notifications = { ok: false, status: 'FAIL', err: String(e.message || e) };
  }
  report.roles[role.id] = { email: role.email, pages, notifications };
  await signOut(page);
}

report.finishedAt = new Date().toISOString();

// Summary matrix
const summary = {};
for (const [role, data] of Object.entries(report.roles)) {
  summary[role] = Object.fromEntries(data.pages.map((p) => [p.path, p.status]));
}
report.summary = summary;

const fails = [];
for (const [role, data] of Object.entries(report.roles)) {
  for (const p of data.pages) {
    if (p.status === 'FAIL') fails.push({ role, path: p.path, err: p.err });
  }
}
report.hardFails = fails;
report.verdict = fails.length === 0 ? 'LOCAL_UI_PASS' : 'LOCAL_UI_PARTIAL';

fs.writeFileSync(path.join(OUT, 'ROLE_MATRIX.json'), JSON.stringify(report, null, 2));
console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
console.log('hardFails', fails.length, fails);
console.log('verdict', report.verdict);
console.log('wrote', path.join(OUT, 'ROLE_MATRIX.json'));

await browser.close();
process.exit(fails.length ? 2 : 0);
