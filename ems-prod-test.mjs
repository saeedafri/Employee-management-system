import { chromium } from 'playwright';

const BASE = 'https://employee-management-system-2b9q.onrender.com';
const API  = `${BASE}/api/v1`;
const TENANT = 'test-key-123456789';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // ── 1. Swagger UI screenshot ────────────────────────────────────────────────
  const page = await ctx.newPage();
  console.log('\n📸 Loading production Swagger UI...');
  await page.goto(`${BASE}/docs`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/prod-swagger.png', fullPage: true });

  const ops   = await page.locator('.opblock').count();
  const tags  = await page.locator('.opblock-tag').count();
  const html  = (await page.content()).length;
  console.log(`   Operations rendered : ${ops}`);
  console.log(`   Tags rendered       : ${tags}`);
  console.log(`   HTML size           : ${html} bytes`);
  console.log(`   Screenshot saved    : /tmp/prod-swagger.png`);

  // ── 2. API endpoint tests ────────────────────────────────────────────────────
  console.log('\n🧪 Testing API endpoints...');
  const api = await ctx.newPage();

  // Login
  const login = await api.evaluate(async ({ API, TENANT }) => {
    const r = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-key': TENANT },
      body: JSON.stringify({ email: 'admin@testorg.com', password: 'password123' })
    });
    return r.json();
  }, { API, TENANT });

  const token = login?.data?.accessToken;
  console.log(`   POST /auth/login       → ${token ? '✅ 200 (token obtained)' : '❌ FAIL'}`);

  const endpoints = [
    ['GET', '/employees'],
    ['GET', '/departments'],
    ['GET', '/attendance/records'],
    ['GET', '/leave/balance'],
    ['GET', '/leave/requests'],
    ['GET', '/holidays'],
    ['GET', '/audit-logs'],
    ['GET', '/settings/tenant'],
  ];

  for (const [method, path] of endpoints) {
    const result = await api.evaluate(async ({ API, token, TENANT, path }) => {
      const r = await fetch(`${API}${path}`, {
        headers: { Authorization: `Bearer ${token}`, 'x-tenant-key': TENANT }
      });
      const d = await r.json().catch(() => ({}));
      const count = d?.data?.length ?? d?.data?.data?.length ?? 'n/a';
      return { status: r.status, count };
    }, { API, token, TENANT, path });
    const icon = result.status === 200 ? '✅' : result.status === 403 ? '⚠️ ' : '❌';
    console.log(`   ${method} ${path.padEnd(25)} → ${icon} ${result.status}  (count: ${result.count})`);
  }

  // ── 3. Summary ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  if (ops > 0) {
    console.log(`✅ SWAGGER UI: WORKING — ${ops} operations across ${tags} tags`);
  } else {
    console.log('❌ SWAGGER UI: BLANK — still not rendering');
  }
  console.log('════════════════════════════════════════');

  await browser.close();
})();
