/**
 * Refuse to run destructive tests against a production database.
 *
 * The previous per-file guard checked only the *host* ("localhost" or
 * "127.0.0.1"). An SSH tunnel to a production Postgres presents exactly that
 * host, so the guard silently passed and destructive tests were one command
 * away from running against live data — the same failure mode that wiped the
 * Render database on 2026-05-27.
 *
 * So: judge the database NAME, which a tunnel cannot disguise.
 */
const PRODUCTION_DB_NAMES = new Set(['ems', 'employee_management_database_ibyc', 'employee_m2e9']);

export function assertTestDatabase(label = 'these tests') {
  const url = process.env.DATABASE_URL || '';
  if (!url) {
    throw new Error(`Refusing to run ${label}: DATABASE_URL is not set.`);
  }

  let name;
  try {
    name = new URL(url).pathname.replace(/^\//, '').split('?')[0];
  } catch {
    throw new Error(`Refusing to run ${label}: DATABASE_URL is not a valid URL.`);
  }

  if (PRODUCTION_DB_NAMES.has(name)) {
    throw new Error(
      `Refusing to run ${label} against production database "${name}". `
      + 'A tunnel to 127.0.0.1 does not make it a test database. '
      + 'Point DATABASE_URL at a database whose name contains "test".',
    );
  }

  if (!/test/i.test(name)) {
    throw new Error(
      `Refusing to run ${label}: database "${name}" is not recognisably a test database. `
      + 'Its name must contain "test".',
    );
  }

  return name;
}
