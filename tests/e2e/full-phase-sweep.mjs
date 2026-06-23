// Full-phase E2E sweep — drives the REAL frontend (MSW off) against the local backend (:4000 → Render DB).
// Logs in via UI, visits every module/settings/payroll screen, records: redirect-to-login (session/auth fail),
// visible error-boundary text, console errors, and per-screen API statuses (4xx/5xx). Screenshots to scratchpad.
// Run: node tests/e2e/full-phase-sweep.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const SHOT = process.env.SHOT_DIR || '/private/tmp/claude-501/-Users-mohdsaeedafri-All-Code-Base-EMS/f4116097-c21d-419a-8e0e-cfe1428d623b/scratchpad/e2e';
fs.mkdirSync(SHOT, { recursive: true });

const USER = process.env.QA_EMAIL || 'hr@acme.test';
const PASS = process.env.QA_PASS || 'Password123!';

// route → phase mapping (per BACKEND_BUILD_PLAN phases)
const ROUTES = [
  ['/dashboard', 'P0/P1 shell+auth'],
  ['/employees', 'P2 directory'],
  ['/employees/new', 'P2 create'],
  ['/departments', 'P2 departments'],
  ['/attendance', 'P3 attendance'],
  ['/leave', 'P4 leave'],
  ['/timesheets', 'P5 timesheets'],
  ['/payroll', 'P6 payroll runs'],
  ['/payroll/global', 'P6 global/multi-country'],
  ['/payroll/my-payslips', 'P6 payslips'],
  ['/payroll/migration', 'P6 migration'],
  ['/holidays', 'P7 holidays'],
  ['/reports', 'P9 reports'],
  ['/analytics', 'P9 analytics'],
  ['/permissions', 'P10 permissions'],
  ['/announcements', 'P11 announcements'],
  ['/assets', 'P11 assets'],
  ['/recruitment', 'recruitment'],
  ['/performance', 'performance'],
  // settings (P8)
  ['/settings', 'P8 settings'],
  ['/settings/company-profile', 'P8 company'],
  ['/settings/locale', 'P8 locale/currency'],
  ['/settings/working-hours', 'P8 work-week'],
  ['/settings/attendance-rules', 'P8 attendance-rules'],
  ['/settings/notifications', 'P8 notifications'],
  ['/settings/authentication', 'P8 auth-policy'],
  ['/settings/sessions', 'P8 sessions'],
  ['/settings/audit-log', 'P8/P11 audit'],
  ['/settings/email-templates', 'P8 email'],
  ['/settings/integration-email', 'P8 integ-email'],
  ['/settings/integration-storage', 'P8 integ-storage'],
  ['/settings/integration-webhooks', 'P8 integ-webhooks'],
  ['/settings/billing-plan', 'P8 billing'],
  ['/settings/billing-invoices', 'P8 invoices'],
  ['/settings/branding', 'P8 branding'],
  ['/settings/leave-types', 'P4 leave-types'],
  ['/settings/leave-policies', 'P4 leave-policies'],
  ['/settings/leave-packs', 'P4 leave-packs'],
  ['/settings/leave-assignments', 'P4 leave-assign'],
  ['/settings/timesheets', 'P5 ts-config'],
  ['/settings/pay/components', 'P6 components'],
  ['/settings/pay/groups', 'P6 groups'],
  ['/settings/pay/schedules', 'P6 schedules'],
  ['/settings/pay/legal-entities', 'P6 legal-entities'],
  ['/settings/pay/statutory-packs', 'P6 statutory'],
  ['/settings/pay/payslip-template', 'P6 payslip-tmpl'],
  ['/settings/pay/data-policy', 'P6 data-policy'],
];

const ONLY = (process.env.ONLY_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
const ROUTES_USED = ONLY.length ? ROUTES.filter(([r]) => ONLY.includes(r)) : ROUTES;

const ERR_PATTERNS = [/something went wrong/i, /unexpected error/i, /failed to load/i, /failed to fetch/i,
  /internal server error/i, /500\b/, /error boundary/i, /application error/i, /try again later/i];

const results = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(90000); // Next dev first-compile per route can be slow
page.setDefaultTimeout(60000);

// per-page collectors (reset each route)
let apiCalls = [];
let consoleErrors = [];
let swServed = [];
page.on('response', (res) => {
  const u = res.url();
  if (u.includes('/api/')) {
    apiCalls.push({ url: u.replace(/https?:\/\/[^/]+/, ''), status: res.status(), sw: res.fromServiceWorker() });
    if (res.fromServiceWorker()) swServed.push(u);
  }
});
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 160)));

function reset() { apiCalls = []; consoleErrors = []; swServed = []; }

// ---- LOGIN ----
reset();
await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' });
await page.fill('#email', USER);
await page.fill('#password', PASS);
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 45000 }).catch(() => {}),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(2500);
const loggedIn = !page.url().includes('/login');
const swRegs = await page.evaluate(() => navigator.serviceWorker
  ? navigator.serviceWorker.getRegistrations().then((r) => r.length) : 0);
console.log(`LOGIN: ${loggedIn ? 'OK' : 'FAIL'} url=${page.url()} | serviceWorkers=${swRegs} | loginApi=${JSON.stringify(apiCalls.slice(0,3))}`);
await page.screenshot({ path: `${SHOT}/00-login-${loggedIn ? 'ok' : 'fail'}.png` });
if (!loggedIn) { console.log('ABORT: login failed'); await browser.close(); process.exit(1); }

// ---- ROUTE SWEEP ----
let idx = 0;
for (const [route, phase] of ROUTES_USED) {
  idx++;
  reset();
  let nav = 'ok';
  try {
    await page.goto(`${FE}${route}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  } catch (e) { nav = 'nav-timeout'; }
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);

  const url = page.url();
  const redirectedToLogin = url.includes('/login');
  const bodyText = (await page.evaluate(() => document.body.innerText).catch(() => '')) || '';
  const errHit = ERR_PATTERNS.find((re) => re.test(bodyText));
  const api5xx = apiCalls.filter((c) => c.status >= 500);
  const api4xx = apiCalls.filter((c) => c.status >= 400 && c.status < 500);
  const ok = nav === 'ok' && !redirectedToLogin && !errHit && api5xx.length === 0;

  const slug = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
  await page.screenshot({ path: `${SHOT}/${String(idx).padStart(2, '0')}-${slug}.png` }).catch(() => {});

  const rec = { route, phase, ok, nav, redirectedToLogin, errText: errHit ? errHit.source : null,
    apiTotal: apiCalls.length, api4xx: api4xx.map((c) => `${c.status} ${c.url}`),
    api5xx: api5xx.map((c) => `${c.status} ${c.url}`), swServed: swServed.length, consoleErrors: consoleErrors.slice(0, 3),
    bodyLen: bodyText.length };
  results.push(rec);
  console.log(`${ok ? 'PASS' : 'FAIL'} [${phase}] ${route} | api=${apiCalls.length} 4xx=${api4xx.length} 5xx=${api5xx.length} sw=${swServed.length} ${errHit ? '| ERR:' + errHit.source : ''}${redirectedToLogin ? ' | REDIR-LOGIN' : ''}`);
}

fs.writeFileSync(`${SHOT}/sweep-results.json`, JSON.stringify(results, null, 2));
const pass = results.filter((r) => r.ok).length;
console.log(`\n==== SWEEP DONE: ${pass}/${results.length} PASS ==== (screens + json in ${SHOT})`);
const fails = results.filter((r) => !r.ok);
if (fails.length) console.log('FAILS:', JSON.stringify(fails.map((f) => ({ route: f.route, why: f.errText || (f.redirectedToLogin ? 'redir-login' : '') || f.nav || f.api5xx[0] })), null, 2));
await browser.close();
