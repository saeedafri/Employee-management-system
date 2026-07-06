#!/usr/bin/env node
/**
 * Pre-render Mermaid blocks in markdown to PNG for PDF generation (v3).
 * Usage: node docs/render-mermaid-for-pdf.mjs [input.md]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputFile = process.argv[2] || 'EMS_BACKEND_TECHNICAL_DOCUMENTATION.md';
const inputPath = join(__dirname, inputFile);
const outDir = join(__dirname, '.pdf-assets');
const outputPath = join(__dirname, inputFile.replace(/\.md$/, '.pdf-ready.md'));
const themeCss = join(__dirname, 'mermaid-pdf-theme.css');

const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];
const chromePath = chromeCandidates.find((p) => existsSync(p));
const mmdcEnv = {
  ...process.env,
  ...(chromePath ? { PUPPETEER_EXECUTABLE_PATH: chromePath } : {}),
};

mkdirSync(outDir, { recursive: true });

/** Strip manual TOC / cover — pandoc --toc + pdf-template provide these. */
function prepareMarkdownForPdf(source) {
  let text = source;
  text = text.replace(/<!-- Cover page is rendered by pdf-template\.html \(v3\) -->\s*/g, '');
  text = text.replace(/<div class="title-page"[\s\S]*?<\/div>\s*/i, '');
  text = text.replace(
    /^## Table of Contents\s*\r?\n[\s\S]*?(?=\r?\n(?:## |<div class="page-break-before"))/m,
    '',
  );
  text = text.replace(/\\newpage/g, '');
  text = text.replace(
    /<div class="page-break-before"><\/div>/g,
    '\n\n<div class="page-break-before"></div>\n\n',
  );
  return text;
}

let md = prepareMarkdownForPdf(readFileSync(inputPath, 'utf8'));
const regex = /```mermaid\n([\s\S]*?)```/g;
let match;
let index = 0;
const replacements = [];

while ((match = regex.exec(md)) !== null) {
  index += 1;
  let code = match[1].trim();

  // Ensure every flowchart has classDef definitions
  if (!code.includes('classDef client') && (code.includes('flowchart') || code.startsWith('graph '))) {
    code += `

%% EMS v3 colors: blue=client, green=api, orange=db, purple=external
classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1,stroke-width:2px
classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20,stroke-width:2px
classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100,stroke-width:2px
classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c,stroke-width:2px
classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c,stroke-width:2px`;
  }

  const mmdPath = join(outDir, `diagram-${index}.mmd`);
  const pngPath = join(outDir, `diagram-${index}.png`);
  writeFileSync(mmdPath, code, 'utf8');

  try {
    execFileSync(
      'npx',
      [
        '--yes',
        '@mermaid-js/mermaid-cli',
        '-i',
        mmdPath,
        '-o',
        pngPath,
        '-b',
        'white',
        '-w',
        '1400',
        '-C',
        themeCss,
      ],
      { cwd: __dirname, stdio: 'pipe', timeout: 180000, env: mmdcEnv },
    );
    const relPng = `.pdf-assets/diagram-${index}.png`;
    replacements.push({
      original: match[0],
      replacement: `\n<figure class="diagram">\n<img src="${relPng}" alt="Diagram ${index}" />\n</figure>\n`,
    });
    console.log(`Rendered diagram ${index} → PNG`);
  } catch (err) {
    const msg = err.stderr?.toString() || err.message || 'unknown error';
    console.error(`Failed diagram ${index}:`, msg.slice(0, 300));
    replacements.push({
      original: match[0],
      replacement: `\n> **Diagram ${index}** — render failed; see source markdown for Mermaid code.\n`,
    });
  }
}

for (const { original, replacement } of replacements) {
  md = md.replace(original, replacement);
}

// Page breaks normalized in prepareMarkdownForPdf
writeFileSync(outputPath, md, 'utf8');
console.log(`Wrote ${basename(outputPath)} (${replacements.length} diagrams)`);
