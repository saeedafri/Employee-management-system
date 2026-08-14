import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import PDFDocument from 'pdfkit';

/**
 * Server-side payslip PDF renderer.
 *
 * Implements BACKEND_CONTRACT_server_side_exports.md §3.3 — a faithful
 * reproduction of what `PayslipDrawer.tsx` draws on screen, so a tenant's
 * payslip-template edits apply identically whether the payslip is viewed or
 * downloaded. Previously "Download PDF" was just `window.print()`.
 *
 * The generic tabular writer in `jobs/exportJob.js` cannot express this: a
 * payslip is a laid-out document (header, info grid, ordered money sections,
 * highlighted net-pay box), not rows x columns.
 */

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG',
  'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

// §3.3: income-tax line detection across countries. Deliberately excludes
// local/non-income taxes such as professional tax.
const INCOME_TAX_CODES = new Set(['TDS', 'WITHHOLDING_TAX', 'WHT', 'PAYE', 'INCOME_TAX', 'IT']);

const LOCALE_BY_CURRENCY = {
  INR: 'en-IN', USD: 'en-US', GBP: 'en-GB', EUR: 'en-IE',
  AED: 'en-AE', SAR: 'en-SA', KWD: 'en-KW', ZAR: 'en-ZA', PHP: 'en-PH',
};

const COLORS = {
  text: '#111827',
  muted: '#6B7280',
  rule: '#E5E7EB',
  negative: '#B91C1C',
  positive: '#047857',
  boxFill: '#F9FAFB',
};

const PAGE_MARGIN = 48;

/**
 * BE-7. PDFKit's built-in Helvetica is WinAnsi (Latin-1), so the rupee sign has
 * no glyph and the payslip fell back to `INR 30,629.00` where the UI shows the
 * symbol. This is the document employees keep and forward, so the ISO code
 * reads as broken rather than deliberate. Noto Sans covers the rupee and the
 * other non-Latin-1 currency symbols, and is embedded so rendering does not
 * depend on fonts installed on the host.
 */
const FONTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');
const BODY = 'Body';
const BOLD = 'BodyBold';

function registerFonts(doc) {
  doc.registerFont(BODY, join(FONTS_DIR, 'NotoSans-Regular.ttf'));
  doc.registerFont(BOLD, join(FONTS_DIR, 'NotoSans-Bold.ttf'));
}

function resolveLocale(template, currency) {
  return template?.locale || LOCALE_BY_CURRENCY[currency] || 'en-US';
}

export function formatMoney(amount, currency, locale) {
  const value = Number(amount ?? 0);
  const digits = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : undefined;

  const format = (currencyDisplay) => new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay,
    ...(digits === 0 ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  }).format(value);

  try {
    // The embedded Noto Sans draws every currency symbol Intl produces, so the
    // ISO-code fallback this used to apply (BE-7) is gone.
    return format('symbol');
  } catch {
    return `${currency} ${value.toFixed(digits ?? 2)}`;
  }
}

/** U+2212 MINUS SIGN is also outside WinAnsi; use an ASCII hyphen. */
const MINUS = '-';

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function enabledSectionsInOrder(template) {
  const sections = Array.isArray(template?.sections) ? template.sections : [];
  return sections
    .filter((section) => section.enabled)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function enabledFieldsInOrder(template) {
  const fields = Array.isArray(template?.fields) ? template.fields : [];
  return fields.filter((field) => field.enabled);
}

/** §3.3 YTD: period taxable income is the sum of earnings lines flagged taxable. */
function periodTaxableIncome(payslip) {
  return (payslip.earnings ?? [])
    .filter((line) => line.taxable)
    .reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
}

/** §3.3 YTD: period tax deducted — prefer an explicit tag, else match known codes. */
function periodTaxDeducted(payslip) {
  const lines = payslip.deductions ?? [];
  const tagged = lines.filter((line) => line.isIncomeTax);
  const matched = tagged.length
    ? tagged
    : lines.filter((line) => INCOME_TAX_CODES.has(String(line.code ?? '').toUpperCase()));
  return matched.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
}

function contentWidth(doc) {
  return doc.page.width - PAGE_MARGIN * 2;
}

function horizontalRule(doc, y) {
  doc.save()
    .strokeColor(COLORS.rule).lineWidth(1)
    .moveTo(PAGE_MARGIN, y).lineTo(doc.page.width - PAGE_MARGIN, y)
    .stroke().restore();
}

function sectionHeading(doc, label, subtitle) {
  doc.moveDown(0.9);
  doc.font(BOLD).fontSize(11).fillColor(COLORS.text)
    .text(label, PAGE_MARGIN, doc.y, { width: contentWidth(doc), align: 'left' });
  if (subtitle) {
    doc.font(BODY).fontSize(8).fillColor(COLORS.muted)
      .text(subtitle, PAGE_MARGIN, doc.y, { width: contentWidth(doc), align: 'left' });
  }
  doc.moveDown(0.3);
  horizontalRule(doc, doc.y);
  doc.moveDown(0.35);
}

/**
 * One money row. `columns` renders right-aligned amount cells; the earnings
 * section adds a taxable Yes/No column, which is unique to it (§3.3).
 */
function moneyRow(doc, label, cells, options = {}) {
  const width = contentWidth(doc);
  const cellWidth = 92;
  const labelWidth = width - cellWidth * cells.length;
  const y = doc.y;

  doc.font(options.bold ? BOLD : BODY).fontSize(9.5)
    .fillColor(options.labelColor ?? COLORS.text)
    .text(label, PAGE_MARGIN, y, { width: labelWidth, ellipsis: true });

  cells.forEach((cell, index) => {
    doc.font(options.bold ? BOLD : BODY).fontSize(9.5)
      .fillColor(cell.color ?? options.valueColor ?? COLORS.text)
      .text(cell.text, PAGE_MARGIN + labelWidth + cellWidth * index, y, {
        width: cellWidth, align: 'right',
      });
  });

  doc.y = y + 14;
}

function renderCompanyHeader(doc, payslip, template, logo) {
  const company = payslip.company ?? {};

  // §3.3 item 1: logo when the template sets one. The buffer is supplied by the
  // caller (fetched through the SSRF guard) rather than fetched here, so this
  // module stays pure and testable.
  if (logo && (template?.logoUrl || company.logoUrl)) {
    try {
      doc.image(logo, PAGE_MARGIN, doc.y, { fit: [120, 40] });
      doc.moveDown(2.6);
    } catch {
      // A corrupt logo must never cost the employee their payslip.
    }
  }

  doc.font(BOLD).fontSize(16).fillColor(COLORS.text)
    .text(company.name ?? 'Payslip', PAGE_MARGIN, doc.y, { align: 'left' });

  if (company.address) {
    doc.font(BODY).fontSize(9).fillColor(COLORS.muted).text(company.address);
  }

  doc.moveDown(0.35);
  doc.font(BOLD).fontSize(11).fillColor(COLORS.text)
    .text(`Payslip for ${payslip.periodLabel ?? payslip.period ?? ''}`);
  doc.moveDown(0.5);
  horizontalRule(doc, doc.y);
}

/**
 * BE-8. The template can enable any field key, but the renderer only knows
 * these. An enabled key that is not here resolves to undefined and is skipped
 * silently -- which is what happened to `uan`, and is indistinguishable from a
 * bug from the outside. The template response flags unsupported keys using this
 * list so the settings UI can say so instead of showing them as enabled.
 */
export const RENDERABLE_FIELD_KEYS = Object.freeze([
  'employeeCode', 'designation', 'department', 'pan', 'payDate', 'paymentRef',
]);

function renderEmployeeGrid(doc, payslip, template) {
  const employee = payslip.employee ?? {};
  const rows = [['Name', [employee.firstName, employee.lastName].filter(Boolean).join(' ')]];

  const valueByField = {
    employeeCode: employee.employeeCode,
    designation: employee.designation,
    department: employee.departmentName,
    // Country-agnostic optional statutory ID; omitted entirely when absent.
    pan: employee.panNumber,
    payDate: formatDate(payslip.paymentDate),
    paymentRef: payslip.paymentReference,
  };

  for (const field of enabledFieldsInOrder(template)) {
    const value = valueByField[field.key];
    if (value === null || value === undefined || value === '') continue;
    rows.push([field.label ?? field.key, String(value)]);
  }

  doc.moveDown(0.6);
  const columnWidth = contentWidth(doc) / 2;
  rows.forEach(([label, value], index) => {
    const column = index % 2;
    const y = doc.y;
    doc.font(BODY).fontSize(8.5).fillColor(COLORS.muted)
      .text(label, PAGE_MARGIN + column * columnWidth, y, { width: columnWidth - 12 });
    doc.font(BOLD).fontSize(9.5).fillColor(COLORS.text)
      .text(value, PAGE_MARGIN + column * columnWidth, y + 11, { width: columnWidth - 12 });
    if (column === 1 || index === rows.length - 1) doc.y = y + 28;
    else doc.y = y;
  });
}

function renderEarnings(doc, payslip, money, label) {
  const lines = payslip.earnings ?? [];
  if (!lines.length) return;
  sectionHeading(doc, label);
  moneyRow(doc, 'Component', [{ text: 'Amount' }, { text: 'Taxable' }], {
    bold: true, labelColor: COLORS.muted, valueColor: COLORS.muted,
  });
  for (const line of lines) {
    moneyRow(doc, line.name ?? line.code ?? '—', [
      { text: money(line.amount) },
      { text: line.taxable ? 'Yes' : 'No' },
    ]);
  }
}

function renderOneTime(doc, payslip, money, label) {
  const additions = payslip.oneTimeAdditions ?? [];
  const deductions = payslip.oneTimeDeductions ?? [];
  if (!additions.length && !deductions.length) return;

  sectionHeading(doc, label);
  for (const line of additions) {
    moneyRow(doc, line.description ?? line.name ?? '—',
      [{ text: `+${money(line.amount)}`, color: COLORS.positive }]);
  }
  for (const line of deductions) {
    moneyRow(doc, line.description ?? line.name ?? '—',
      [{ text: `${MINUS}${money(line.amount)}`, color: COLORS.negative }]);
  }
}

function renderDeductions(doc, payslip, money, label) {
  const lines = payslip.deductions ?? [];
  if (!lines.length) return;
  sectionHeading(doc, label);
  for (const line of lines) {
    moneyRow(doc, line.name ?? line.code ?? '—',
      [{ text: `${MINUS}${money(line.amount)}`, color: COLORS.negative }]);
  }
}

function renderEmployerContributions(doc, payslip, money, label) {
  const lines = payslip.employerContributions ?? [];
  if (!lines.length) return;
  sectionHeading(doc, label);
  for (const line of lines) {
    moneyRow(doc, line.name ?? line.code ?? '—', [{ text: money(line.amount) }]);
  }
}

/** Always shown, never template-gated (§3.3 item 4). */
function renderNetPayBox(doc, payslip, money) {
  doc.moveDown(0.8);
  const boxTop = doc.y;
  const height = 74;
  doc.save().rect(PAGE_MARGIN, boxTop, contentWidth(doc), height)
    .fillAndStroke(COLORS.boxFill, COLORS.rule).restore();

  doc.y = boxTop + 10;
  moneyRow(doc, 'Gross Earnings', [{ text: money(payslip.grossEarnings) }]);
  moneyRow(doc, 'Total Deductions',
    [{ text: `${MINUS}${money(payslip.totalDeductions)}`, color: COLORS.negative }]);
  horizontalRule(doc, doc.y + 2);
  doc.y += 6;
  moneyRow(doc, 'Net Pay', [{ text: money(payslip.netPay) }], { bold: true });
  doc.y = boxTop + height + 6;
}

function renderYtd(doc, payslip, money, label) {
  const ytd = payslip.ytd;
  if (!ytd) return;

  const heading = ytd.fiscalYear ? `${label} — FY ${ytd.fiscalYear}` : label;
  const subtitle = ytd.monthsElapsed ? `${ytd.monthsElapsed} month(s)` : null;
  sectionHeading(doc, heading, subtitle);

  moneyRow(doc, '', [{ text: 'This period' }, { text: 'YTD' }], {
    bold: true, valueColor: COLORS.muted,
  });

  const rows = [
    ['Gross earnings', payslip.grossEarnings, ytd.grossEarnings],
    ['Taxable income', periodTaxableIncome(payslip), ytd.taxableIncome],
    ['Tax deducted', periodTaxDeducted(payslip), ytd.taxDeducted],
    ['Net pay', payslip.netPay, ytd.netPay],
  ];
  for (const [label_, period, cumulative] of rows) {
    moneyRow(doc, label_, [{ text: money(period) }, { text: money(cumulative) }]);
  }
}

function renderAttendance(doc, payslip, label) {
  sectionHeading(doc, label);
  const stats = [
    ['Working Days', payslip.workingDays],
    ['Present Days', payslip.presentDays],
    ['LOP Days', payslip.lopDays],
  ];
  for (const [name, value] of stats) {
    const isLop = name === 'LOP Days' && Number(value ?? 0) > 0;
    moneyRow(doc, name, [{
      text: String(value ?? 0),
      color: isLop ? COLORS.negative : COLORS.text,
    }], { bold: isLop });
  }
}

function renderPaymentInfo(doc, payslip, label) {
  const paidOn = formatDate(payslip.paymentDate);
  if (!paidOn) return; // omitted entirely if unpaid
  sectionHeading(doc, label);
  const reference = payslip.paymentReference ? ` · Ref: ${payslip.paymentReference}` : '';
  doc.font(BODY).fontSize(9.5).fillColor(COLORS.text)
    .text(`Paid on ${paidOn}${reference}`, PAGE_MARGIN);
}

/**
 * Render a payslip to a PDF Buffer.
 *
 * @param {object} payslip  shape of GET /payroll/employees/:id/payslips/:id
 * @param {object} template shape of GET /payroll/payslip-templates
 * @param {object} [options] `logo` = optional pre-fetched image Buffer
 */
export function renderPayslipPdf(payslip, template, options = {}) {
  const currency = payslip.currency ?? 'INR';
  const locale = resolveLocale(template, currency);
  const money = (amount) => formatMoney(amount, currency, locale);

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
  registerFonts(doc);
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  renderCompanyHeader(doc, payslip, template, options.logo);
  renderEmployeeGrid(doc, payslip, template);

  const renderers = {
    earnings: (label) => renderEarnings(doc, payslip, money, label),
    oneTime: (label) => renderOneTime(doc, payslip, money, label),
    deductions: (label) => renderDeductions(doc, payslip, money, label),
    employerContributions: (label) => renderEmployerContributions(doc, payslip, money, label),
  };
  const informational = {
    ytd: (label) => renderYtd(doc, payslip, money, label),
    attendance: (label) => renderAttendance(doc, payslip, label),
    paymentInfo: (label) => renderPaymentInfo(doc, payslip, label),
  };

  const ordered = enabledSectionsInOrder(template);

  for (const section of ordered) {
    renderers[section.key]?.(section.label ?? section.key);
  }

  renderNetPayBox(doc, payslip, money);

  for (const section of ordered) {
    informational[section.key]?.(section.label ?? section.key);
  }

  doc.end();
  return done;
}

export function payslipFilename(payslip) {
  const employee = payslip.employee ?? {};
  const name = [employee.firstName, employee.lastName].filter(Boolean).join('-') || 'payslip';
  const period = payslip.period ?? 'period';
  return `payslip-${name}-${period}.pdf`.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
}
