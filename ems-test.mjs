import { chromium } from 'playwright';
import fs from 'fs';

const BASE_URL = 'https://employee-management-system-2b9q.onrender.com';
const API_URL = `${BASE_URL}/api/v1`;
const TENANT_KEY = 'test-key-123456789';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const results = [];

  // ─── 1. Screenshot: Swagger /docs ───────────────────────────────────────────
  console.log('\n📸 Step 1: Loading Swagger UI...');
  await page.goto(`${BASE_URL}/docs`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/swagger-1-initial.png', fullPage: true });

  const title = await page.title();
  const htmlLen = (await page.content()).length;
  const bodyText = await page.locator('body').innerText().catch(() => '');

  console.log(`   Title: ${title}`);
  console.log(`   HTML size: ${htmlLen} bytes`);
  console.log(`   Has "swagger-ui" in HTML: ${(await page.content()).includes('swagger-ui')}`);
  console.log(`   Has endpoints in body: ${bodyText.includes('/auth') || bodyText.includes('/employees')}`);

  // Check for swagger-ui container
  const swaggerContainer = await page.locator('#swagger-ui').count();
  console.log(`   #swagger-ui div present: ${swaggerContainer > 0}`);

  // Check for rendered content (operation blocks)
  const opCount = await page.locator('.opblock').count();
  console.log(`   Rendered API operations: ${opCount}`);

  results.push({ test: 'Swagger UI Load', status: opCount > 0 ? '✅ PASS' : '❌ FAIL - No endpoints rendered', detail: `${opCount} operations visible` });

  // ─── 2. Screenshot: Wait longer and scroll ──────────────────────────────────
  console.log('\n📸 Step 2: Waiting 5s more for JS to finish...');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/swagger-2-after-wait.png', fullPage: true });

  const opCount2 = await page.locator('.opblock').count();
  const infoBlock = await page.locator('.info').count();
  const noOps = await page.locator('.no-ops').count();
  console.log(`   Operations after wait: ${opCount2}`);
  console.log(`   .info blocks: ${infoBlock}`);
  console.log(`   "No operations defined" message: ${noOps}`);

  // ─── 3. Check /docs/json directly ────────────────────────────────────────────
  console.log('\n🔍 Step 3: Checking OpenAPI spec JSON...');
  const specPage = await context.newPage();
  await specPage.goto(`${BASE_URL}/docs/json`, { waitUntil: 'networkidle' });
  const specText = await specPage.locator('body').innerText().catch(() => '');
  let spec;
  try { spec = JSON.parse(specText); } catch(e) { spec = null; }

  const pathCount = spec ? Object.keys(spec.paths || {}).length : 0;
  const host = spec?.host;
  const schemes = spec?.schemes;
  console.log(`   Host: ${host}`);
  console.log(`   Schemes: ${JSON.stringify(schemes)}`);
  console.log(`   Paths count: ${pathCount}`);
  if (spec?.paths) console.log(`   Paths: ${JSON.stringify(Object.keys(spec.paths))}`);
  await specPage.screenshot({ path: '/tmp/swagger-3-spec-json.png', fullPage: true });

  results.push({ test: 'OpenAPI Spec JSON', status: pathCount > 0 ? '✅ PASS' : '❌ FAIL - 0 paths', detail: `${pathCount} paths, host: ${host}` });

  // ─── 4. Browser console errors ───────────────────────────────────────────────
  console.log('\n🔍 Step 4: Checking browser console for errors...');
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/swagger-4-after-reload.png', fullPage: true });
  console.log(`   Console errors: ${consoleErrors.length}`);
  consoleErrors.forEach(e => console.log(`   ERROR: ${e}`));

  // ─── 5. Network requests - what URL does Swagger UI fetch? ──────────────────
  console.log('\n🔍 Step 5: Intercepting network requests...');
  const apiPage = await context.newPage();
  const networkReqs = [];
  apiPage.on('response', async (res) => {
    const url = res.url();
    const status = res.status();
    if (url.includes('swagger') || url.includes('openapi') || url.includes('/docs') || url.includes('/api')) {
      networkReqs.push({ url, status });
    }
  });
  await apiPage.goto(`${BASE_URL}/docs`, { waitUntil: 'networkidle', timeout: 30000 });
  await apiPage.waitForTimeout(3000);
  console.log('   Network requests to API/Swagger:');
  networkReqs.forEach(r => console.log(`   [${r.status}] ${r.url}`));

  // ─── 6. Test actual API endpoints ────────────────────────────────────────────
  console.log('\n🧪 Step 6: Testing API endpoints via browser fetch...');

  const loginResult = await apiPage.evaluate(async (apiUrl) => {
    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-key': 'test-key-123456789' },
        body: JSON.stringify({ email: 'admin@testorg.com', password: 'password123' })
      });
      const data = await res.json();
      return { status: res.status, success: data.success, hasToken: !!data.data?.accessToken };
    } catch(e) { return { error: e.message }; }
  }, API_URL);

  console.log(`   POST /auth/login → status: ${loginResult.status}, success: ${loginResult.success}, hasToken: ${loginResult.hasToken}`);
  results.push({ test: 'POST /auth/login', status: loginResult.hasToken ? '✅ PASS' : '❌ FAIL', detail: JSON.stringify(loginResult) });

  const token = loginResult.hasToken ? await apiPage.evaluate(async (apiUrl) => {
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-key': 'test-key-123456789' },
      body: JSON.stringify({ email: 'admin@testorg.com', password: 'password123' })
    });
    const data = await res.json();
    return data.data?.accessToken;
  }, API_URL) : null;

  if (token) {
    const endpoints = [
      '/employees', '/departments', '/attendance/records',
      '/leave/balance', '/leave/requests', '/holidays'
    ];
    for (const ep of endpoints) {
      const result = await apiPage.evaluate(async ({ apiUrl, token, ep }) => {
        try {
          const res = await fetch(`${apiUrl}${ep}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-key': 'test-key-123456789' }
          });
          const data = await res.json();
          return { status: res.status, success: data.success, count: data.data?.length ?? data.data?.data?.length ?? 'n/a' };
        } catch(e) { return { error: e.message }; }
      }, { apiUrl: API_URL, token, ep });
      console.log(`   GET ${ep} → status: ${result.status}, count: ${result.count}`);
      results.push({ test: `GET ${ep}`, status: result.status === 200 ? '✅ PASS' : `❌ FAIL (${result.status})`, detail: `count: ${result.count}` });
    }
  }

  // ─── 7. Final screenshot ─────────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/docs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/swagger-5-final.png', fullPage: true });

  console.log('\n\n════════════════════════════════════════');
  console.log('TEST RESULTS SUMMARY');
  console.log('════════════════════════════════════════');
  results.forEach(r => console.log(`${r.status}  ${r.test}\n        ${r.detail}`));

  console.log('\nScreenshots saved:');
  console.log('  /tmp/swagger-1-initial.png');
  console.log('  /tmp/swagger-2-after-wait.png');
  console.log('  /tmp/swagger-3-spec-json.png');
  console.log('  /tmp/swagger-4-after-reload.png');
  console.log('  /tmp/swagger-5-final.png');

  await browser.close();
}

run().catch(console.error);
