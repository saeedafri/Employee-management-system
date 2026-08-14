/**
 * Column definitions for the exports migrated from the browser to the server.
 *
 * BACKEND_CONTRACT_server_side_exports.md §0 is explicit: "this is a move, not a
 * redesign". The column set, order, formatting and filename below reproduce what
 * the frontend built client-side, byte for byte. Changing a column here is a
 * product decision, not a refactor.
 *
 * Pure functions on purpose -- they take plain objects, so every column can be
 * asserted without a database.
 */
import { buildCsv, orDash, yesNo } from '../../utils/csv.js';

const isoDate = (value) => (value ? String(value).slice(0, 10) : '');

// §2.3 PerformanceScreen.tsx downloadCSV() -> performance-reviews.csv
export const REVIEW_HEADERS = [
  'Employee', 'Department', 'Reviewer', 'Self Complete', 'Manager Complete', 'Status', 'Rating',
];

export function reviewRows(reviews = []) {
  return reviews.map((r) => [
    r.employeeName,
    r.department,
    orDash(r.reviewerName),
    yesNo(r.selfComplete),
    yesNo(r.managerComplete),
    r.status,
    orDash(r.rating),
  ]);
}

// §2.3 -> performance-goals.csv
export const GOAL_HEADERS = ['Employee', 'Goal', 'Progress %', 'Due Date', 'Status'];

export function goalRows(goals = []) {
  return goals.map((g) => [
    g.employeeName,
    g.title,
    g.progressPct,
    isoDate(g.dueDate),
    g.status,
  ]);
}

// §2.4 AssetsScreen.tsx handleExport() -> assets-inventory.csv
export const ASSET_HEADERS = ['Tag', 'Name', 'Type', 'Status', 'Assigned To', 'Since'];

export function assetRows(assets = []) {
  return assets.map((a) => [
    a.tag,
    a.name,
    a.type,
    a.status,
    orDash(a.assignedTo?.name),
    orDash(isoDate(a.assignedSince) || null),
  ]);
}

// §2.5 BillingInvoicesPanel.tsx exportCsv() -> invoices-{date}.csv
export const INVOICE_HEADERS = [
  'Invoice #', 'Description', 'Date', 'Due Date', 'Period', 'Amount', 'Status',
];

export function invoiceRows(invoices = []) {
  return invoices.map((i) => [
    i.number,
    i.description,
    isoDate(i.date),
    isoDate(i.dueDate),
    // Rendered by the UI as "{start} to {end}".
    `${isoDate(i.period?.start)} to ${isoDate(i.period?.end)}`,
    // Rendered by the UI as "{amount} {currency}".
    `${i.amount} ${i.currency}`,
    i.status,
  ]);
}

export function reviewsCsv(reviews) {
  return buildCsv(REVIEW_HEADERS, reviewRows(reviews));
}

export function goalsCsv(goals) {
  return buildCsv(GOAL_HEADERS, goalRows(goals));
}

export function assetsCsv(assets) {
  return buildCsv(ASSET_HEADERS, assetRows(assets));
}

export function invoicesCsv(invoices) {
  return buildCsv(INVOICE_HEADERS, invoiceRows(invoices));
}

/** UI names the invoice file with the export date. */
export function invoicesFilename(today) {
  return `invoices-${isoDate(today ?? new Date().toISOString())}.csv`;
}

// BE-11 RecruitmentScreen.tsx — the Export button had no endpoint behind it, it
// only fired a toast. Columns mirror the two tables on the screen.
export const OPENING_HEADERS = [
  'Title', 'Department', 'Location', 'Employment Type', 'Applicants', 'Current Stage', 'Status', 'Posted',
];

export function openingRows(openings = []) {
  return openings.map((opening) => [
    opening.title,
    opening.department,
    opening.location,
    opening.employmentType,
    opening.applicantCount ?? 0,
    orDash(opening.currentStage),
    opening.status,
    orDash(isoDate(opening.createdAt) || null),
  ]);
}

export const CANDIDATE_HEADERS = [
  'Name', 'Email', 'Role', 'Stage', 'Rating', 'Days In Stage', 'Referral', 'Applied',
];

export function candidateRows(candidates = []) {
  return candidates.map((candidate) => [
    candidate.name,
    candidate.email,
    candidate.role,
    candidate.stage,
    orDash(candidate.rating),
    candidate.daysInStage ?? 0,
    yesNo(candidate.isReferral),
    orDash(isoDate(candidate.appliedAt) || null),
  ]);
}

export function openingsCsv(openings) {
  return buildCsv(OPENING_HEADERS, openingRows(openings));
}

export function candidatesCsv(candidates) {
  return buildCsv(CANDIDATE_HEADERS, candidateRows(candidates));
}

/** `recruitment-openings-2026-08-13.csv` — same shape as invoicesFilename. */
export function recruitmentFilename(type, today) {
  return `recruitment-${type}-${isoDate(today ?? new Date().toISOString())}.csv`;
}
