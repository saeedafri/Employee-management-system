import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import PDFDocument from 'pdfkit';

/**
 * BE-5 — server-side tax-form PDF renderer.
 *
 * The payslip contract shipped a real PDF; the tax form never did, so
 * `TaxFormDrawer.tsx` still calls `window.print()`. This renders the same
 * `TaxFormDocument` the JSON endpoint already returns
 * (`payroll.service.js::getTaxForm`), so the drawer and the file cannot drift:
 * the document is built once, server-side, and printed two ways.
 *
 * Layout is deliberately plain — a statutory certificate is a header, two party
 * blocks and a list of titled label/value sections. Same embedded Noto Sans as
 * the payslip (BE-7) so `₹` and other non-Latin-1 symbols draw.
 */

const FONTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');
const BODY = 'Body';
const BOLD = 'BodyBold';
const PAGE_MARGIN = 48;

const COLORS = {
  text: '#111827',
  muted: '#6B7280',
  rule: '#E5E7EB',
  boxFill: '#F9FAFB',
};

function contentWidth(doc) {
  return doc.page.width - PAGE_MARGIN * 2;
}

function horizontalRule(doc, y) {
  doc.save()
    .strokeColor(COLORS.rule).lineWidth(1)
    .moveTo(PAGE_MARGIN, y).lineTo(doc.page.width - PAGE_MARGIN, y)
    .stroke().restore();
}

function renderHeader(doc, form) {
  doc.font(BOLD).fontSize(18).fillColor(COLORS.text)
    .text(form.title ?? 'Tax Form', PAGE_MARGIN, PAGE_MARGIN, { width: contentWidth(doc) });

  const subtitle = [form.authority, form.jurisdiction].filter(Boolean).join(' · ');
  if (subtitle) {
    doc.font(BODY).fontSize(9).fillColor(COLORS.muted)
      .text(subtitle, PAGE_MARGIN, doc.y + 2, { width: contentWidth(doc) });
  }
  if (form.fiscalYear) {
    doc.font(BODY).fontSize(9).fillColor(COLORS.muted)
      .text(`Financial year ${form.fiscalYear}`, PAGE_MARGIN, doc.y + 2, { width: contentWidth(doc) });
  }

  doc.moveDown(0.8);
  horizontalRule(doc, doc.y);
}

/** Employer / employee: a name, an optional subtitle, then their identifiers. */
function renderParty(doc, heading, party, x, width) {
  if (!party) return;
  doc.font(BODY).fontSize(8).fillColor(COLORS.muted)
    .text(heading.toUpperCase(), x, doc.y, { width });
  doc.font(BOLD).fontSize(11).fillColor(COLORS.text)
    .text(party.name ?? '—', x, doc.y + 1, { width });
  if (party.subtitle) {
    doc.font(BODY).fontSize(9).fillColor(COLORS.muted).text(party.subtitle, x, doc.y, { width });
  }
  for (const identifier of party.identifiers ?? []) {
    doc.font(BODY).fontSize(9).fillColor(COLORS.text)
      .text(`${identifier.label}: ${identifier.value ?? '—'}`, x, doc.y, { width });
  }
}

function renderParties(doc, form) {
  const width = contentWidth(doc);
  doc.moveDown(0.8);

  const top = doc.y;
  renderParty(doc, 'Employer', form.employer, PAGE_MARGIN, width);
  const afterEmployer = doc.y;

  doc.y = afterEmployer + 10;
  renderParty(doc, 'Employee', form.employee, PAGE_MARGIN, width);

  if (doc.y === top) doc.moveDown(0.5);
  doc.moveDown(0.6);
  horizontalRule(doc, doc.y);
}

function renderSection(doc, section) {
  const width = contentWidth(doc);
  doc.moveDown(0.9);
  doc.font(BOLD).fontSize(11).fillColor(COLORS.text)
    .text(section.title ?? '', PAGE_MARGIN, doc.y, { width });
  doc.moveDown(0.3);

  for (const row of section.rows ?? []) {
    const y = doc.y;
    doc.font(BODY).fontSize(10).fillColor(COLORS.text)
      .text(row.label ?? '', PAGE_MARGIN, y, { width: width * 0.65, continued: false });
    doc.font(BODY).fontSize(10).fillColor(COLORS.text)
      .text(String(row.value ?? '—'), PAGE_MARGIN + width * 0.65, y, {
        width: width * 0.35, align: 'right',
      });
    doc.y = Math.max(doc.y, y + 14);
  }
}

function renderFooter(doc, form) {
  doc.moveDown(1.2);
  horizontalRule(doc, doc.y);
  doc.moveDown(0.4);
  doc.font(BODY).fontSize(8).fillColor(COLORS.muted).text(
    `Generated ${String(form.generatedAt ?? new Date().toISOString()).slice(0, 10)}. `
    + 'Computer-generated document.',
    PAGE_MARGIN, doc.y, { width: contentWidth(doc) },
  );
}

/** @returns {Promise<Buffer>} */
export function renderTaxFormPdf(form) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
  doc.registerFont(BODY, join(FONTS_DIR, 'NotoSans-Regular.ttf'));
  doc.registerFont(BOLD, join(FONTS_DIR, 'NotoSans-Bold.ttf'));

  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  renderHeader(doc, form);
  renderParties(doc, form);
  for (const section of form.sections ?? []) renderSection(doc, section);
  renderFooter(doc, form);

  doc.end();
  return done;
}

function slug(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** `tax-form-priya-sharma-fy2026-27.pdf` — the name the tracker asked for. */
export function taxFormFilename(form) {
  const name = slug(form?.employee?.name) || 'employee';
  const fy = slug(form?.fiscalYear);
  return fy ? `tax-form-${name}-fy${fy}.pdf` : `tax-form-${name}.pdf`;
}
