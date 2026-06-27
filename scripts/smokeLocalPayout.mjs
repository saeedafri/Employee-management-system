// Local boot-smoke: proves the payout module loads and routes mount. Uses app.inject
// (no port). Run with DATABASE_URL pointing at the LOCAL ems_local DB.
import { createApp } from '../src/app.js';

console.log('DATABASE_URL host:', (process.env.DATABASE_URL || '').replace(/:\/\/[^@]*@/, '://***@').slice(0, 70));

const app = await createApp();
await app.ready();

async function show(method, url, label) {
  const r = await app.inject({ method, url });
  let code;
  try { code = r.json()?.error?.code; } catch { /* non-json */ }
  console.log(`${label.padEnd(42)} ${r.statusCode}${code ? ' ' + code : ''}`);
}

await show('GET', '/health', 'health');
await show('GET', '/api/v1/payroll/me/payout-methods', 'me/payout-methods (no auth → 401)');
await show('GET', '/api/v1/payroll/payout-methods/approvals', 'approvals (no auth → 401)');
await show('GET', '/api/v1/payroll/payout-methods/unverified', 'unverified (no auth → 401)');
await show('GET', '/api/v1/payroll/country-bank-schemas', 'catalog list (no auth → 401)');
await show('GET', '/api/v1/payroll/countries', 'countries (no auth → 401)');
await show('GET', '/api/v1/payroll/payout-methods/pm_nope', 'method by id (no auth → 401)');

await app.close();
process.exit(0);
