/**
 * BE-5 — tax-form PDF renderer. Run: node --test tests/tax-form-pdf.test.js
 *
 * The renderer takes the exact `TaxFormDocument` the JSON endpoint already
 * returns, so these fixtures are that shape verbatim.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderTaxFormPdf, taxFormFilename } from '../src/modules/payroll/taxFormPdf.js';

const FORM = {
  type: 'FORM16',
  title: 'Form 16',
  fiscalYear: '2026-27',
  jurisdiction: 'IN',
  authority: 'Income Tax Department',
  currency: 'INR',
  employer: {
    name: 'Acme Corp',
    identifiers: [{ label: 'TAN', value: 'BLRA12345B' }, { label: 'PAN', value: 'AAACA1234A' }],
  },
  employee: {
    name: 'Priya Sharma',
    subtitle: 'Senior Engineer',
    identifiers: [{ label: 'PAN', value: 'ABCPS1234Q' }, { label: 'Employee Code', value: 'EMP-014' }],
  },
  sections: [
    { title: 'Gross Salary', rows: [{ label: 'Salary as per section 17(1)', value: '₹9,60,000.00' }] },
    { title: 'Tax Deducted at Source', rows: [{ label: 'Total TDS', value: '₹72,400.00' }] },
  ],
  generatedAt: '2026-08-13T10:00:00.000Z',
};

describe('renderTaxFormPdf', () => {
  it('produces a real, non-trivial PDF', async () => {
    const pdf = await renderTaxFormPdf(FORM);
    assert.ok(Buffer.isBuffer(pdf));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 1000, 'not a stub');
  });

  it('embeds the Unicode font so the rupee amounts draw (BE-7)', async () => {
    const pdf = (await renderTaxFormPdf(FORM)).toString('latin1');
    assert.match(pdf, /NotoSans/);
    assert.ok(!/BaseFont\s*\/Helvetica/.test(pdf));
  });

  it('survives a sparse document rather than throwing', async () => {
    for (const sparse of [{}, { title: 'W-2' }, { ...FORM, sections: [], employer: null, employee: null }]) {
      const pdf = await renderTaxFormPdf(sparse);
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    }
  });
});

describe('taxFormFilename', () => {
  it('is the name the tracker asked for', () => {
    assert.equal(taxFormFilename(FORM), 'tax-form-priya-sharma-fy2026-27.pdf');
  });

  it('degrades without a name or fiscal year', () => {
    assert.equal(taxFormFilename({}), 'tax-form-employee.pdf');
    assert.equal(taxFormFilename({ employee: { name: 'Dev One' } }), 'tax-form-dev-one.pdf');
  });
});
