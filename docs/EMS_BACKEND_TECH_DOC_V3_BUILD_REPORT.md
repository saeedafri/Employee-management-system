# EMS Backend Technical Doc v3.1 — Build & Verification Report

| Metric | Value |
|--------|-------|
| Version | **v3.1** |
| PDF | `docs/EMS_BACKEND_TECHNICAL_DOCUMENTATION.pdf` |
| Pages | **82** |
| Visual blank pages | **NONE** |
| Size | ~2.91 MB |
| Verified | 2026-07-22 (5-pass audit + format writer ×5) |

## Gaps found during E2E doc audit (fixed)

1. **§10.4.5 API Surface table** — pipe characters in `csv\|excel\|…` broke HTML into extra `<td>` cells. Fixed to readable `csv | excel | json | pdf`.
2. **Jobs appendix** — `exportJob.js` said “ExcelJS only”; updated to **ExcelJS + PDFKit** (CSV/Excel/JSON/PDF).

## Five verification passes

| Pass | Scope | Result |
|------|--------|--------|
| 1 | TOC + §10.4.1–10.4.8 + §10.5 + §17.9 present in PDF text | **OK** 11/11 |
| 2 | Libraries What/Why/How vs `exportJob.js` / auth.policy (ExcelJS, PDFKit, Cloudinary, Prisma, uuid, Zod, colors, setImmediate) | **OK** |
| 3 | Live curl examples + hardening claims (68d32f4, noEmployeeRecord, ops, SSE, deny 403) | **OK** in PDF |
| 4 | Broken-table regression + flowchart PNGs (diagram-15/16/17) embedded | **OK** |
| 5 | Pixel ink blank-page scan (all 82 pages) | **NONE blank** |

## Format generation offline ×5 (ExcelJS + PDFKit)

Mirrors `src/jobs/exportJob.js` writers (no DB / no live API):

```
ROUND 1–5: csv PASS | excel PASS (ZIP/XLSX) | json PASS | pdf PASS (%PDF)
ALL_5_ROUNDS_PASS
```

## Live Hostinger / Vercel from this Mac

- Direct `https://ems-api.saqibsaeed.cloud` → **connection timeout** (known ISP path block).
- Vercel curl → **blocked by EMS safety guard** (needs explicit approval).
- Prior live proof retained in `docs/LIVE_UI_ROLE_MATRIX_VERCEL_2026-07-19.md`: HR export **202 QUEUED**, EMP **403**.

To re-run live curls: use Hostinger Browser Terminal or approve a Vercel/Hostinger probe from this machine.

## Rebuild

```bash
cd docs
pandoc EMS_BACKEND_TECHNICAL_DOCUMENTATION.pdf-ready.md \
  -f markdown+raw_html -t html5 --standalone \
  --toc --toc-depth=3 -M toc-title='Table of Contents' \
  --template pdf-template.html \
  -o EMS_BACKEND_TECHNICAL_DOCUMENTATION.print.html
node build-pdf.mjs
```
