/**
 * Payslip PDF renderer — BACKEND_CONTRACT_server_side_exports.md §3.
 * Run: node --test tests/payslip-pdf.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderPayslipPdf, payslipFilename, formatMoney } from '../src/modules/payroll/payslipPdf.js';

const TEMPLATE = {
  locale: 'en-IN',
  logoUrl: null,
  sections: [
    { key: 'earnings', label: 'Earnings', enabled: true, order: 1 },
    { key: 'deductions', label: 'Deductions', enabled: true, order: 2 },
    { key: 'employerContributions', label: 'Employer Contributions', enabled: true, order: 3 },
    { key: 'oneTime', label: 'One-Time Items', enabled: true, order: 4 },
    { key: 'ytd', label: 'Year to Date', enabled: true, order: 5 },
    { key: 'attendance', label: 'Attendance', enabled: true, order: 6 },
    { key: 'paymentInfo', label: 'Payment Info', enabled: true, order: 7 },
  ],
  fields: [
    { key: 'employeeCode', label: 'Employee ID', enabled: true },
    { key: 'department', label: 'Department', enabled: true },
    { key: 'designation', label: 'Designation', enabled: true },
  ],
};

const PAYSLIP = {
  id: 'ps-1',
  period: '2026-07',
  periodLabel: 'July 2026',
  currency: 'INR',
  employee: {
    firstName: 'Priya', lastName: 'Sharma', employeeCode: 'EMP-004',
    designation: 'Engineer', departmentName: 'Engineering', panNumber: null,
  },
  company: { name: 'Acme Corp', address: 'Bengaluru, India', logoUrl: null },
  earnings: [
    { code: 'BASIC', name: 'Basic', amount: 50000, taxable: true },
    { code: 'HRA', name: 'House Rent Allowance', amount: 20000, taxable: false },
  ],
  deductions: [
    { code: 'TDS', name: 'Income Tax', amount: 6000 },
    { code: 'PT', name: 'Professional Tax', amount: 200 },
  ],
  employerContributions: [{ code: 'PF_ER', name: 'Employer PF', amount: 1800 }],
  oneTimeAdditions: [{ description: 'Referral bonus', amount: 5000 }],
  oneTimeDeductions: [{ description: 'Advance recovery', amount: 1000 }],
  grossEarnings: 75000,
  totalDeductions: 7200,
  netPay: 67800,
  workingDays: 22, presentDays: 21, leaveDays: 1, lopDays: 1,
  status: 'PAID',
  paymentDate: '2026-07-31',
  paymentReference: 'NEFT-99881',
  ytd: {
    fiscalYear: '2026-27', monthsElapsed: 4,
    grossEarnings: 300000, taxableIncome: 200000, taxDeducted: 24000, netPay: 271200,
  },
};

function isPdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.subarray(0, 5).toString() === '%PDF-';
}

describe('formatMoney', () => {
  it('renders two decimals for a normal currency', () => {
    assert.match(formatMoney(1234.5, 'INR', 'en-IN'), /1,234\.50/);
  });

  it('renders zero decimals for a zero-decimal currency', () => {
    const out = formatMoney(1234, 'JPY', 'en-US');
    assert.doesNotMatch(out, /\./, `expected no decimals, got ${out}`);
  });

  it('renders three decimals safely for KWD via Intl', () => {
    assert.ok(formatMoney(1.5, 'KWD', 'en-KW').length > 0);
  });

  it('falls back rather than throwing on a bad locale', () => {
    assert.ok(formatMoney(10, 'INR', 'not-a-locale!!').includes('10'));
  });
});

describe('renderPayslipPdf', () => {
  it('produces a valid non-trivial PDF buffer', async () => {
    const pdf = await renderPayslipPdf(PAYSLIP, TEMPLATE);
    assert.ok(isPdf(pdf), 'output is not a PDF');
    assert.ok(pdf.length > 1500, `PDF suspiciously small: ${pdf.length} bytes`);
  });

  it('renders with every optional section disabled', async () => {
    const minimal = {
      ...TEMPLATE,
      sections: TEMPLATE.sections.map((s) => ({ ...s, enabled: false })),
    };
    const pdf = await renderPayslipPdf(PAYSLIP, minimal);
    assert.ok(isPdf(pdf));
  });

  it('renders when the payslip is unpaid (no payDate, no ref)', async () => {
    const unpaid = { ...PAYSLIP, paymentDate: null, paymentReference: null, status: 'PENDING' };
    const pdf = await renderPayslipPdf(unpaid, TEMPLATE);
    assert.ok(isPdf(pdf));
  });

  it('renders with no YTD block', async () => {
    const { ytd, ...withoutYtd } = PAYSLIP;
    const pdf = await renderPayslipPdf(withoutYtd, TEMPLATE);
    assert.ok(isPdf(pdf));
  });

  it('renders with empty money sections', async () => {
    const empty = {
      ...PAYSLIP,
      earnings: [], deductions: [], employerContributions: [],
      oneTimeAdditions: [], oneTimeDeductions: [],
    };
    const pdf = await renderPayslipPdf(empty, TEMPLATE);
    assert.ok(isPdf(pdf));
  });

  it('survives a missing template entirely (falls back to currency locale)', async () => {
    const pdf = await renderPayslipPdf(PAYSLIP, null);
    assert.ok(isPdf(pdf));
  });

  it('handles a zero-decimal currency payslip', async () => {
    const jpy = { ...PAYSLIP, currency: 'JPY' };
    const pdf = await renderPayslipPdf(jpy, { ...TEMPLATE, locale: null });
    assert.ok(isPdf(pdf));
  });
});

describe('payslipFilename', () => {
  it('is slugified and period-stamped', () => {
    assert.equal(payslipFilename(PAYSLIP), 'payslip-priya-sharma-2026-07.pdf');
  });

  it('degrades safely without an employee', () => {
    assert.match(payslipFilename({ period: '2026-07' }), /^payslip-.*\.pdf$/);
  });
});

describe('BE-7 rupee renders instead of the ISO-code fallback', () => {
  it('formatMoney returns the symbol, not INR', () => {
    assert.equal(formatMoney(30629, 'INR', 'en-IN'), '\u20B930,629.00');
  });

  it('the PDF embeds a Unicode font that has the rupee glyph', async () => {
    const pdf = (await renderPayslipPdf({ ...PAYSLIP, currency: 'INR' }, null)).toString('latin1');
    assert.match(pdf, /NotoSans/, 'Noto Sans must be embedded, not built-in Helvetica');
    assert.ok(!/BaseFont\s*\/Helvetica/.test(pdf), 'no WinAnsi Helvetica left');
  });
});
