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
  OPENING_HEADERS, CANDIDATE_HEADERS, openingsCsv, candidatesCsv, recruitmentFilename,
} from '../src/modules/export/exportRows.js';
import { buildCsv, escapeCsvValue, orDash, yesNo } from '../src/utils/csv.js';
import { exportEmployeesSchema } from '../src/modules/export/export.validator.js';
import { buildJobCsv } from '../src/jobs/exportJob.js';
import { exportFilename } from '../src/modules/export/export.controller.js';
import { convertToCSV } from '../src/modules/auditLogs/auditLogs.controller.js';

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

describe('BE-10(a) job-based exports match the direct-export CSV conventions', () => {
  const EMPLOYEES = [
    {
      id: 'cmqjpyds0001',
      firstName: 'Aman',
      lastName: 'Kumar',
      designation: 'Senior Engineer, Platform', // the comma is the whole point
      joinedOn: new Date('2020-01-15T00:00:00Z'),
      departmentId: 'dept-1',
      department: { id: 'dept-1', name: 'Engineering' },
      manager: null,
      createdAt: new Date('2026-06-18T09:30:00Z'),
    },
    // The all-empty row that used to land at EOF as `,,,,,,,,,,,,,`.
    { id: '', firstName: '', lastName: '', designation: '', joinedOn: null },
  ];

  const csv = buildJobCsv(EMPLOYEES);

  it('quotes every value, header row included', () => {
    for (const cell of firstLine(csv).split(',')) {
      assert.match(cell, /^".*"$/, `unquoted header cell: ${cell}`);
    }
    assert.ok(csv.includes('"Senior Engineer, Platform"'), 'a comma must not break the row');
  });

  it('emits dates as YYYY-MM-DD, not Date.prototype.toString()', () => {
    assert.ok(csv.includes('"2020-01-15"'));
    assert.ok(!csv.includes('GMT'), 'no JS toString() date form');
    assert.ok(!csv.includes('Coordinated Universal Time'));
  });

  it('drops department.id, which duplicated departmentId', () => {
    const headers = firstLine(csv);
    assert.ok(headers.includes('"departmentId"'));
    assert.ok(!headers.includes('"department.id"'));
    assert.ok(headers.includes('"department.name"'), 'other nested fields still flatten');
  });

  it('has no trailing empty row', () => {
    const lines = csv.split('\n');
    assert.equal(dataLines(csv).length, 1, 'the all-empty row is dropped');
    assert.ok(!/^,*$/.test(lines[lines.length - 1]));
    assert.ok(!csv.endsWith('\n'));
  });

  it('an empty result set produces an empty file, not a header-only lie', () => {
    assert.equal(buildJobCsv([]), '');
  });
});

describe('BE-10(a) download filename convention', () => {
  it('names the file <type>-<date>.<ext>, not export-<uuid>', () => {
    const status = { export_type: 'EMPLOYEES', completed_at: '2026-08-13T11:00:00.000Z' };
    assert.equal(exportFilename(status, 'csv'), 'employees-2026-08-13.csv');
    assert.equal(exportFilename({ export_type: 'LEAVE', created_at: '2026-08-13T11:00:00.000Z' }, 'xlsx'),
      'leave-2026-08-13.xlsx');
  });
});

describe('BE-10(b) audit-log CSV export', () => {
  const LOGS = [
    {
      id: 'log-1',
      user_email: 'priya@acme.test',
      action: 'UPDATE',
      entity_type: 'Employee',
      entity_id: 'emp-1',
      created_at: new Date('2026-08-13T11:00:00Z'),
    },
  ];

  it('quotes the header row too', () => {
    for (const cell of firstLine(convertToCSV(LOGS)).split(',')) {
      assert.match(cell, /^".*"$/, `unquoted header cell: ${cell}`);
    }
  });

  it('emits an ISO date, not Date.prototype.toString()', () => {
    const csv = convertToCSV(LOGS);
    assert.ok(csv.includes('"2026-08-13T11:00:00.000Z"'));
    assert.ok(!csv.includes('GMT'));
  });

  it('an empty export is header-only and still quoted', () => {
    assert.equal(convertToCSV([]), '"id","user_email","action","entity_type","entity_id","created_at"');
  });
});

describe('BE-11 recruitment export', () => {
  const OPENINGS = [
    {
      title: 'Senior Engineer, Platform',
      department: 'Engineering',
      location: 'Bengaluru',
      employmentType: 'FULL_TIME',
      applicantCount: 12,
      currentStage: 'interview',
      status: 'Open',
      createdAt: '2026-07-01T00:00:00.000Z',
    },
  ];

  const CANDIDATES = [
    {
      name: 'Priya Sharma',
      email: 'priya@acme.test',
      role: 'Engineer',
      stage: 'offer',
      rating: 4,
      daysInStage: 3,
      isReferral: true,
      appliedAt: '2026-07-20T00:00:00.000Z',
    },
    { name: 'Dev One', email: 'dev1@acme.test', role: 'Engineer', stage: 'applied', rating: null, daysInStage: 0, isReferral: false, appliedAt: null },
  ];

  it('openings: column set, order, quoting and yyyy-MM-dd dates', () => {
    const csv = openingsCsv(OPENINGS);
    assert.equal(firstLine(csv), OPENING_HEADERS.map((h) => `"${h}"`).join(','));
    assert.ok(csv.includes('"Senior Engineer, Platform"'), 'comma stays inside its cell');
    assert.ok(csv.includes('"2026-07-01"'));
  });

  it('candidates: column set, em dash for a missing rating, Yes/No referral', () => {
    const csv = candidatesCsv(CANDIDATES);
    assert.equal(firstLine(csv), CANDIDATE_HEADERS.map((h) => `"${h}"`).join(','));
    const [first, second] = dataLines(csv);
    assert.ok(first.includes('"Yes"'));
    assert.ok(second.includes('"No"'));
    assert.ok(second.includes('"—"'), 'missing rating renders as an em dash, like the UI');
  });

  it('names the file recruitment-{type}-{date}.csv', () => {
    assert.equal(recruitmentFilename('openings', '2026-08-13T10:00:00.000Z'), 'recruitment-openings-2026-08-13.csv');
    assert.match(recruitmentFilename('candidates'), /^recruitment-candidates-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
