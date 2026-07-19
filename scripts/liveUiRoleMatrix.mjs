#!/usr/bin/env node
/**
 * Live UI role matrix against Vercel FE → Hostinger API (via BFF).
 * Usage: UI_BASE=https://ems-frontend-iota-ten.vercel.app node scripts/liveUiRoleMatrix.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.UI_BASE;
if (!BASE) {
  console.error('Set UI_BASE');
  process.exit(1);
}

const OUT = path.resolve('docs/live-ui-e2e');
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
  '/announcements',
];

const ROLES = [
  { id: 'SUPER_ADMIN', email: 'superadmin@acme.test', password: 'Password123!' },
  { id: 'HR_ADMIN', email: 'hr@acme.test', password: 'Password123!' },
  { id: 'MANAGER', email: 'aman@acme.test', password: 'Password123!' },
  { id: 'EMPLOYEE', email: 'priya@acme.test', password: 'Password123!' },
];

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
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 45000 });
  const result = await page.evaluate(async ({ email: e, password: p }) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: e, password: p }),
    });
    const json = await res.json().catch(() => ({}));
    return {
      status: res.status,
      success: !!json.success,
      memberType: json?.data?.user?.memberType || json?.data?.memberType || null,
      employeeId: json?.data?.user?.employeeId ?? json?.data?.employeeId ?? null,
    };
  }, { email, password });
  if (!result.success) throw new Error(`login failed ${email}: ${JSON.stringify(result)}`);
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  return result;
}

async function logout(page) {
  await page.evaluate(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* ignore */
    }
    document.cookie.split(';').forEach((c) => {
      document.cookie = c.replace(/^ +/, '').replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });
  });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const report = { base: BASE, startedAt: new Date().toISOString(), roles: {} };

  for (const role of ROLES) {
    console.log(`\n=== ${role.id} ===`);
    const loginInfo = await login(page, role.email, role.password);
    console.log('login', loginInfo);
    const pages = {};
    for (const p of PAGES) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3500);
      const text = await page.locator('body').innerText();
      const c = classify(text, page.url());
      pages[p] = c;
      console.log(p, c.status, c.err || '');
      if (['/dashboard', '/attendance', '/payout-methods', '/permissions', '/reports'].includes(p)) {
        await page.screenshot({
          path: path.join(OUT, 'screenshots', `${role.id}${p.replace(/\//g, '_')}.png`),
          fullPage: false,
        });
      }
    }
    // nav presence sample
    const nav = await page.evaluate(() => {
      const items = [...document.querySelectorAll('nav a, aside a')].map((a) => (a.textContent || '').trim()).filter(Boolean);
      return [...new Set(items)].slice(0, 40);
    });
    report.roles[role.id] = { login: loginInfo, pages, navSample: nav };
    await logout(page);
  }

  report.finishedAt = new Date().toISOString();
  const outFile = path.join(OUT, 'ROLE_MATRIX_LIVE.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log('\nWrote', outFile);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
