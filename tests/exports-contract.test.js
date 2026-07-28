/**
 * Server-side exports contract — BACKEND_CONTRACT_server_side_exports.md.
 * Run: node --test tests/exports-contract.test.js
 *
 * §0 is the ground rule: "No data break... the column set, column order, field
 * formatting and filename convention given under 'current implementation' is the
 * exact output the new server endpoint must reproduce."
 *
 * These assertions pin exactly that, against dummy data, so a later refactor
 * cannot quietly change a column the frontend depends on.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REVIEW_HEADERS, GOAL_HEADERS, ASSET_HEADERS, INVOICE_HEADERS,
  reviewsCsv, goalsCsv, assetsCsv, invoicesCsv, invoicesFilename,
} from '../src/modules/export/exportRows.js';
import { buildCsv, escapeCsvValue, orDash, yesNo } from '../src/utils/csv.js';
import { exportEmployeesSchema } from '../src/modules/export/export.validator.js';

const firstLine = (csv) => csv.split('\n')[0];
const dataLines = (csv) => csv.split('\n').slice(1);

describe('CSV primitives', () => {
  it('quotes every value and doubles embedded quotes', () => {
    assert.equal(escapeCsvValue('plain'), '"plain"');
    assert.equal(escapeCsvValue('say "hi"'), '"say ""hi"""');
    assert.equal(escapeCsvValue(null), '""');
    assert.equal(escapeCsvValue(undefined), '""');
  });

  it('does not let a comma or newline break the row structure', () => {
    const csv = buildCsv(['a', 'b'], [['x,y', 'line1\nline2']]);
    // The comma stays inside its quoted cell.
    assert.ok(csv.includes('"x,y"'));
    assert.ok(csv.includes('"line1\nline2"'));
  });

  it('renders an em dash for empty values, matching the UI', () => {
    assert.equal(orDash(null), '—');
    assert.equal(orDash(''), '—');
    assert.equal(orDash(0), 0, '0 is a real value, not empty');
    assert.equal(yesNo(true), 'Yes');
    assert.equal(yesNo(false), 'No');
  });
});

describe('§2.3 Performance — reviews', () => {
  const REVIEWS = [
    {
      employeeName: 'Priya Sharma',
      department: 'Engineering',
      reviewerName: 'Aman Gupta',
      selfComplete: true,
      managerComplete: false,
      status: 'IN_PROGRESS',
      rating: 4,
    },
    {
      employeeName: 'Dev One',
      department: 'Finance',
      reviewerName: null,
      selfComplete: false,
      managerComplete: false,
      status: 'PENDING',
      rating: null,
    },
  ];

  it('matches the contract column set and order exactly', () => {
    assert.deepEqual(REVIEW_HEADERS, [
      'Employee', 'Department', 'Reviewer', 'Self Complete', 'Manager Complete', 'Status', 'Rating',
    ]);
    assert.equal(
      firstLine(reviewsCsv(REVIEWS)),
      '"Employee","Department","Reviewer","Self Complete","Manager Complete","Status","Rating"',
    );
  });

  it('renders Self/Manager Complete as Yes/No', () => {
    const [row] = dataLines(reviewsCsv(REVIEWS));
    assert.equal(row, '"Priya Sharma","Engineering","Aman Gupta","Yes","No","IN_PROGRESS","4"');
  });

  it('renders a null rating and null reviewer as an em dash', () => {
    const row = dataLines(reviewsCsv(REVIEWS))[1];
    assert.equal(row, '"Dev One","Finance","—","No","No","PENDING","—"');
  });

  it('emits a header-only file for no reviews', () => {
    assert.equal(dataLines(reviewsCsv([])).length, 0);
  });
});

describe('§2.3 Performance — goals', () => {
  const GOALS = [
    { employeeName: 'Priya Sharma', title: 'Ship payroll v2', progressPct: 60, dueDate: '2026-09-30', status: 'ON_TRACK' },
    { employeeName: 'Dev One', title: 'Reduce p95 latency, by 30%', progressPct: 0, dueDate: '2026-12-31T00:00:00.000Z', status: 'AT_RISK' },
  ];

  it('matches the contract column set and order exactly', () => {
    assert.deepEqual(GOAL_HEADERS, ['Employee', 'Goal', 'Progress %', 'Due Date', 'Status']);
  });

  it('renders rows with yyyy-MM-dd dates', () => {
    assert.equal(
      dataLines(goalsCsv(GOALS))[0],
      '"Priya Sharma","Ship payroll v2","60","2026-09-30","ON_TRACK"',
    );
  });

  it('truncates an ISO timestamp to a date and survives a comma in the title', () => {
    const row = dataLines(goalsCsv(GOALS))[1];
    assert.ok(row.includes('"2026-12-31"'), 'ISO timestamp not truncated');
    assert.ok(row.includes('"Reduce p95 latency, by 30%"'), 'comma broke the cell');
    assert.equal(row.split('","').length, GOAL_HEADERS.length, 'column count changed');
  });
});

describe('§2.4 Assets — inventory', () => {
  const ASSETS = [
    {
      tag: 'LAP-001', name: 'MacBook Pro 14', type: 'LAPTOP', status: 'ASSIGNED',
      assignedTo: { employeeId: 'e1', name: 'Priya Sharma' }, assignedSince: '2026-03-01T00:00:00.000Z',
    },
    { tag: 'MON-014', name: 'Dell U2720Q', type: 'MONITOR', status: 'AVAILABLE', assignedTo: null, assignedSince: null },
  ];

  it('matches the contract column set and order exactly', () => {
    assert.deepEqual(ASSET_HEADERS, ['Tag', 'Name', 'Type', 'Status', 'Assigned To', 'Since']);
  });

  it('renders an assigned asset with a yyyy-MM-dd since date', () => {
    assert.equal(
      dataLines(assetsCsv(ASSETS))[0],
      '"LAP-001","MacBook Pro 14","LAPTOP","ASSIGNED","Priya Sharma","2026-03-01"',
    );
  });

  it('renders em dashes for an unassigned asset', () => {
    assert.equal(
      dataLines(assetsCsv(ASSETS))[1],
      '"MON-014","Dell U2720Q","MONITOR","AVAILABLE","—","—"',
    );
  });
});

describe('§2.5 Billing — invoices', () => {
  const INVOICES = [{
    number: 'INV-2026-005',
    description: 'Professional Plan — May 2026',
    date: '2026-05-01T00:00:00.000Z',
    dueDate: '2026-05-07T00:00:00.000Z',
    period: { start: '2026-05-01T00:00:00.000Z', end: '2026-05-31T23:59:59.000Z' },
    amount: 999,
    currency: 'INR',
    status: 'paid',
  }];

  it('matches the contract column set and order exactly', () => {
    assert.deepEqual(INVOICE_HEADERS, [
      'Invoice #', 'Description', 'Date', 'Due Date', 'Period', 'Amount', 'Status',
    ]);
  });

  it('renders Period as "{start} to {end}" and Amount as "{amount} {currency}"', () => {
    assert.equal(
      dataLines(invoicesCsv(INVOICES))[0],
      '"INV-2026-005","Professional Plan — May 2026","2026-05-01","2026-05-07",'
      + '"2026-05-01 to 2026-05-31","999 INR","paid"',
    );
  });

  it('names the file invoices-{date}.csv', () => {
    assert.equal(invoicesFilename('2026-07-27T10:00:00.000Z'), 'invoices-2026-07-27.csv');
    assert.match(invoicesFilename(), /^invoices-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

describe('§2.1 Employees export — ids[] bulk selection', () => {
  it('accepts and preserves ids[] rather than stripping it', () => {
    const parsed = exportEmployeesSchema.parse({ format: 'csv', ids: ['e1', 'e2'] });
    assert.deepEqual(parsed.ids, ['e1', 'e2']);
  });

  it('stays optional so a full export is unchanged', () => {
    const parsed = exportEmployeesSchema.parse({ format: 'csv' });
    assert.equal(parsed.ids, undefined);
    assert.equal(parsed.include_archived, false);
  });

  it('rejects a non-string id', () => {
    assert.throws(() => exportEmployeesSchema.parse({ ids: [123] }));
  });
});
