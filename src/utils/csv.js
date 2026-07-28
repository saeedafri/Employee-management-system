/**
 * CSV building, shared.
 *
 * Escaping logic previously existed in three places (`jobs/exportJob.js`,
 * `reports.service.js`, and inline in `employees.controller.js`), which is how
 * they drifted. New exports use this.
 */

/** RFC 4180: quote always, double any embedded quote. */
export function escapeCsvValue(value) {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

/**
 * @param {string[]} headers column headers, in order
 * @param {Array<Array<unknown>>} rows values per row, same order as headers
 */
export function buildCsv(headers, rows) {
  const lines = [headers.map(escapeCsvValue).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(','));
  }
  return lines.join('\n');
}

/** Sets the headers that make a browser download rather than render the file. */
export function sendCsv(reply, filename, csv) {
  return reply
    .type('text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .send(csv);
}

/** `—` is what the UI renders for an absent value; exports must match. */
export const EM_DASH = '—';

export function orDash(value) {
  return value === null || value === undefined || value === '' ? EM_DASH : value;
}

export function yesNo(value) {
  return value ? 'Yes' : 'No';
}
