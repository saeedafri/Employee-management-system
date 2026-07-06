#!/usr/bin/env node
/** Print PDF via Playwright — preserves internal TOC anchor links (v3). */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docBase = 'EMS_BACKEND_TECHNICAL_DOCUMENTATION';
const htmlPath = join(__dirname, `${docBase}.print.html`);
const pdfPath = join(__dirname, `${docBase}.pdf`);

if (!existsSync(htmlPath)) {
  console.error(`Missing ${htmlPath} — run pandoc step first (with --toc).`);
  process.exit(1);
}

async function loadChromium() {
  try {
    return await import('playwright');
  } catch {
    console.error('playwright not found — run: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }
}

const { chromium } = await loadChromium();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle', timeout: 300_000 });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', right: '14mm', bottom: '20mm', left: '14mm' },
  });
  console.log('PDF written:', pdfPath);
} finally {
  await browser.close();
}
