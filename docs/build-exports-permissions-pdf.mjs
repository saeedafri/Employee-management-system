#!/usr/bin/env node
/** Build companion PDF: Exports & Permissions Deep Dive */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = 'EMS_EXPORTS_PERMISSIONS_DEEP_DIVE';
const mdPath = join(__dirname, `${base}.md`);
const assetsDir = join(__dirname, '.pdf-assets-exports');
const readyPath = join(__dirname, `${base}.pdf-ready.md`);
const htmlPath = join(__dirname, `${base}.print.html`);
const pdfPath = join(__dirname, `${base}.pdf`);
const template = join(__dirname, 'pdf-template-exports-permissions.html');

mkdirSync(assetsDir, { recursive: true });

const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const chromePath = chromeCandidates.find((p) => existsSync(p));
const mmdcEnv = {
  ...process.env,
  ...(chromePath ? { PUPPETEER_EXECUTABLE_PATH: chromePath } : {}),
};

let md = readFileSync(mdPath, 'utf8');
const regex = /```mermaid\n([\s\S]*?)```/g;
let match;
let index = 0;
const replacements = [];

while ((match = regex.exec(md)) !== null) {
  index += 1;
  const code = match[1].trim();
  const mmdPath = join(assetsDir, `diagram-${index}.mmd`);
  const pngPath = join(assetsDir, `diagram-${index}.png`);
  writeFileSync(mmdPath, code);
  try {
    execFileSync(
      'npx',
      ['--yes', '@mermaid-js/mermaid-cli', '-i', mmdPath, '-o', pngPath, '-b', 'transparent', '-s', '2'],
      { env: mmdcEnv, stdio: 'pipe', timeout: 120_000 },
    );
    replacements.push({ from: match[0], to: `\n\n![Diagram ${index}](.pdf-assets-exports/diagram-${index}.png)\n\n` });
    console.log(`Rendered diagram-${index}.png`);
  } catch (err) {
    console.warn(`Mermaid failed for diagram ${index}:`, err.message);
    replacements.push({ from: match[0], to: `\n\n> *(Diagram ${index} render skipped)*\n\n` });
  }
}

for (const { from, to } of replacements) {
  md = md.replace(from, to);
}
writeFileSync(readyPath, md);

execFileSync(
  'pandoc',
  [
    readyPath,
    '-f', 'markdown+raw_html',
    '-t', 'html5',
    '--standalone',
    '--toc',
    '--toc-depth=3',
    '-M', 'title=EMS Exports & Permissions Deep Dive',
    '-M', 'toc-title=Table of Contents',
    '--template', template,
    '-o', htmlPath,
  ],
  { stdio: 'inherit' },
);

let html = readFileSync(htmlPath, 'utf8');
html = html.replace(
  'src=".pdf-assets-exports/',
  'style="max-height:140mm;width:auto;max-width:100%;" src=".pdf-assets-exports/',
);
html = html.replace(/break-inside:\s*avoid-page;\s*page-break-inside:\s*avoid;/g, '');
writeFileSync(htmlPath, html);

const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle', timeout: 180_000 });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '16mm', right: '14mm', bottom: '18mm', left: '14mm' },
  });
  console.log('PDF written:', pdfPath);
} finally {
  await browser.close();
}
