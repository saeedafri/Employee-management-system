#!/usr/bin/env node
/** Print PDF via Playwright — preserves internal TOC anchor links (v3.1). */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

/** Keep heading + optional note + diagram on one page; collapse duplicate HRs. */
function polishHtml(html) {
  let out = html;
  // Collapse consecutive decorative HRs that create sparse gaps
  out = out.replace(/(<hr\b[^>]*>\s*){2,}/gi, '<hr class="section-divider" />\n');
  // Wrap h3 (+ optional blockquote/p) + figure.diagram so they stay together
  out = out.replace(
    /(<h3\b[^>]*>[\s\S]*?<\/h3>)(\s*(?:<(?:blockquote|p)\b[^>]*>[\s\S]*?<\/(?:blockquote|p)>\s*){0,2})(<figure\s+class="diagram">[\s\S]*?<\/figure>)/gi,
    '<div class="flow-block">$1$2$3</div>',
  );
  return out;
}

const polished = polishHtml(readFileSync(htmlPath, 'utf8'));
writeFileSync(htmlPath, polished);

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
