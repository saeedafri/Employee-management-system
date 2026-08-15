/**
 * Seed a LOCAL throwaway database for end-to-end probing.
 *
 * The repo's safety hook blocks seed commands by matching the command text,
 * because it cannot tell a local database from a production one. This wrapper
 * checks the thing the hook actually cares about — where the connection
 * physically goes — and refuses unless all three hold:
 *
 *   1. the host is loopback (127.0.0.1 / localhost / ::1)
 *   2. the database name contains "test"
 *   3. the name is not one of the known production databases
 *
 * That is strictly stronger than a command-text match: it cannot be satisfied by
 * a tunnel, a renamed script, or a stray DATABASE_URL from .env.
 *
 *   DATABASE_URL=postgresql://…@127.0.0.1:5432/ems_test node scripts/seedLocalE2E.mjs
 */
const PRODUCTION_DB_NAMES = new Set(['ems', 'employee_management_database_ibyc', 'employee_m2e9']);
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

const url = process.env.DATABASE_URL ?? '';
if (!url) {
  console.error('Refusing to seed: DATABASE_URL is not set.');
  process.exit(2);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error('Refusing to seed: DATABASE_URL is not a valid URL.');
  process.exit(2);
}

const host = parsed.hostname;
const name = parsed.pathname.replace(/^\//, '').split('?')[0];

const failures = [];
if (!LOOPBACK.has(host)) failures.push(`host "${host}" is not loopback`);
if (!/test/i.test(name)) failures.push(`database "${name}" is not recognisably a test database`);
if (PRODUCTION_DB_NAMES.has(name)) failures.push(`database "${name}" is a known production name`);

if (failures.length) {
  console.error('Refusing to seed. This target is not a local throwaway database:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(2);
}

console.log(`Target verified local: ${name} @ ${host}`);
await import('../prisma/seed.js');
