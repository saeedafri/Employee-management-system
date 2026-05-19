import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  console.log('📸 Loading local Swagger UI...');
  await page.goto(`${BASE}/docs`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(4000);

  const ops = await page.locator('.opblock').count();
  const tags = await page.locator('.opblock-tag').count();
  const html = (await page.content()).length;
  console.log(`   Operations rendered: ${ops}`);
  console.log(`   Tags rendered:       ${tags}`);
  console.log(`   HTML size:           ${html} bytes`);

  await page.screenshot({ path: '/tmp/local-swagger.png', fullPage: true });
  console.log('   Screenshot: /tmp/local-swagger.png');

  if (ops > 0) {
    console.log('\n✅ SUCCESS - Swagger UI renders endpoints locally!');
  } else {
    console.log('\n❌ STILL BROKEN - No operations visible');
    // dump console errors
    const errors = [];
    page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    errors.forEach(e => console.log('  console error:', e));
  }

  await browser.close();
})();
