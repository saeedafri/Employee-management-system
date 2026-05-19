/**
 * Full Swagger UI click-through test — every endpoint via Try it out → Execute
 * Uses route interception to inject auth headers (same effect as manual authorization)
 */
import { chromium } from 'playwright';
import fs from 'fs';

const SWAGGER  = 'https://employee-management-system-2b9q.onrender.com/docs/static/index.html';
const API_V1   = 'https://employee-management-system-2b9q.onrender.com/api/v1';
const TENANT   = 'test-key-123456789';
const OUT      = '/tmp/swagger-tests';
fs.mkdirSync(OUT, { recursive: true });

// Bodies for POST/PATCH endpoints
const BODIES = {
  'POST /auth/login':                '{"email":"admin@testorg.com","password":"password123"}',
  'POST /auth/refresh':              '{}',
  'POST /auth/logout':               '{}',
  'POST /auth/logout-all':           '{}',
  'POST /auth/forgot-password':      '{"email":"admin@testorg.com"}',
  'POST /auth/verify-otp':           '{"email":"admin@testorg.com","otp":"123456"}',
  'POST /auth/resend-otp':           '{"email":"admin@testorg.com"}',
  'POST /auth/reset-password':       '{"token":"dummy","password":"NewPass123!"}',
  'POST /employees':                 '{"employeeCode":"EMP-SW-T2","firstName":"SwTest","lastName":"User","workEmail":"swtest02@testorg.com","designation":"Engineer","joinedOn":"2026-01-01","employmentType":"FULL_TIME"}',
  'POST /departments':               '{"name":"SW Dept","description":"playwright"}',
  'POST /holidays':                  '{"name":"SW Holiday","date":"2026-12-31","description":"test"}',
  'POST /attendance/check-in':       '{"note":"playwright"}',
  'POST /attendance/check-out':      '{"note":"playwright"}',
  'POST /attendance/regularization': '{"attendanceDate":"2026-05-01","reason":"test","requestedCheckIn":"09:00","requestedCheckOut":"18:00"}',
  'POST /leave/requests':            '{"leaveTypeId":"dummy","startDate":"2026-07-01","endDate":"2026-07-02","reason":"test"}',
  'POST /export/employees':          '{"format":"csv"}',
  'POST /export/attendance':         '{"format":"csv","from_date":"2026-01-01T00:00:00Z","to_date":"2026-05-19T23:59:59Z"}',
  'POST /export/leave':              '{"format":"csv","from_date":"2026-01-01T00:00:00Z","to_date":"2026-05-19T23:59:59Z"}',
  'POST /reports/schedule':          '{"name":"test","reportType":"ATTENDANCE","schedule":"DAILY","recipients":["admin@testorg.com"]}',
  'POST /audit-logs/dpia-report':    '{"from_date":"2026-01-01","to_date":"2026-05-19"}',
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // ── Get token ──────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(72));
  console.log('  EMS — SWAGGER UI FULL CLICK-THROUGH TEST');
  console.log('  ' + SWAGGER);
  console.log('═'.repeat(72));
  console.log('\n🔑 Getting token...');
  const loginResp = await fetch(`${API_V1}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-key': TENANT },
    body: JSON.stringify({ email: 'admin@testorg.com', password: 'password123' }),
  });
  const token = (await loginResp.json())?.data?.accessToken;
  if (!token) { console.error('❌ Login failed'); await browser.close(); process.exit(1); }
  console.log(`   ${token.slice(0, 50)}...`);

  // ── Inject auth headers on all API requests ────────────────────────────────
  await ctx.route('**/*.onrender.com/api/**', async route => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        'authorization': `Bearer ${token}`,
        'x-tenant-key':  TENANT,
      },
    });
  });

  // ── Load Swagger ───────────────────────────────────────────────────────────
  console.log('\n📂 Loading Swagger UI...');
  const page = await ctx.newPage();
  await page.goto(SWAGGER, { waitUntil: 'networkidle', timeout: 40000 });
  await page.waitForTimeout(4000);

  const totalOps  = await page.locator('.opblock').count();
  const totalTags = await page.locator('.opblock-tag').count();
  console.log(`   ${totalOps} operations across ${totalTags} tag groups`);
  await page.screenshot({ path: `${OUT}/00-swagger-loaded.png`, fullPage: true });

  // ── Collect block metadata ─────────────────────────────────────────────────
  const blocks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.opblock')).map((el, i) => ({
      index: i,
      method: el.querySelector('.opblock-summary-method')?.textContent?.trim() || '?',
      path:   el.querySelector('[data-path]')?.getAttribute('data-path') ||
              el.querySelector('.opblock-summary-path span')?.textContent?.trim() || '?',
      tag:    el.closest('.opblock-tag-section')
                 ?.querySelector('.opblock-tag span')
                 ?.textContent?.trim() ||
              el.closest('.opblock-tag-section')
                 ?.querySelector('.opblock-tag')
                 ?.childNodes[0]?.textContent?.trim() || '',
    }))
  );

  // ── Test every endpoint ────────────────────────────────────────────────────
  console.log(`\n🧪 Testing ${blocks.length} endpoints...\n`);
  let pass = 0, warn = 0, fail = 0;
  const failures = [];
  let currentTag = '';

  for (const { index, method, path, tag } of blocks) {
    if (tag !== currentTag) {
      console.log(`\n  ── ${tag} ${'─'.repeat(Math.max(0, 50 - tag.length))}`);
      currentTag = tag;
    }

    const key  = `${method} ${path}`;
    const slug = `${String(index + 1).padStart(2, '0')}-${method}-${path.replace(/\//g, '_').replace(/[{}?=&]/g, '').slice(0, 45)}`;
    process.stdout.write(`  ${method.padEnd(7)} ${path.padEnd(46)}`);

    try {
      const block = page.locator('.opblock').nth(index);
      await block.scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);

      // Expand block
      const isOpen = await block.evaluate(el => el.classList.contains('is-open'));
      if (!isOpen) { await block.locator('.opblock-summary').click(); await page.waitForTimeout(300); }

      // Cancel if already in try-it-out mode
      const cancelBtn = block.locator('button:has-text("Cancel")');
      if (await cancelBtn.count() > 0) await cancelBtn.click();

      // Try it out
      const tryBtn = block.locator('button:has-text("Try it out")');
      if (await tryBtn.count() > 0) { await tryBtn.first().click({ timeout: 5000 }); await page.waitForTimeout(350); }

      // Fill body
      const body = BODIES[key];
      if (body) {
        const ta = block.locator('textarea.body-param__text');
        if (await ta.count() > 0) { await ta.first().selectText(); await ta.first().fill(body); await page.waitForTimeout(150); }
      }

      // Execute
      const execBtn = block.locator('button:has-text("Execute")');
      if (await execBtn.count() > 0) { await execBtn.first().click({ timeout: 5000 }); await page.waitForTimeout(3000); }

      // Read response — nth(1) skips the "Code" header cell, gets the actual status
      const codeText = await block.locator('.response-col_status').nth(1).textContent().catch(() => '');
      const code = parseInt(codeText.trim()) || 0;

      await block.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${slug}.png`, fullPage: false });

      let ic;
      if      (code >= 200 && code < 300)  { ic = '✅'; pass++; }
      else if ([400, 401, 403].includes(code)) { ic = '⚠️ '; warn++; }
      else                                  { ic = '❌'; fail++; failures.push({ key, code }); }

      console.log(` → ${ic} ${code}`);

      // Close block
      await block.locator('.opblock-summary').click().catch(() => {});
      await page.waitForTimeout(100);

    } catch (err) {
      console.log(` → ❌ ${err.message.slice(0, 55)}`);
      await page.screenshot({ path: `${OUT}/${slug}-err.png`, fullPage: false }).catch(() => {});
      fail++;
      failures.push({ key, code: 'ERR' });
    }
  }

  // ── Final screenshot of full page ──────────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/99-final.png`, fullPage: true });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(72));
  console.log(`  SWAGGER UI : ${totalOps} operations, ${totalTags} tag groups`);
  console.log(`  ✅ PASS    : ${pass}`);
  console.log(`  ⚠️  WARN    : ${warn}  (400/401/403 — permission / no-employee-profile)`);
  console.log(`  ❌ FAIL    : ${fail}`);
  console.log('═'.repeat(72));

  if (failures.length) {
    console.log('\n  Failing:');
    failures.forEach(({ key, code }) => console.log(`    ❌ ${key} → ${code}`));
  }

  console.log(`\n📁 Screenshots: ${OUT}/  (${totalOps} files)\n`);
  await browser.close();
})();
