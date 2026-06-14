'use strict';
// EMS Safety Guard — PreToolUse hook for Bash
// Blocks commands that could mutate production DB, Render, or run tests against live data.
// Exit 2 + JSON = block. Exit 0 = allow.

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  let cmd = '';
  try { cmd = JSON.parse(data).tool_input?.command || ''; } catch {}

  const BLOCKED = [
    ['prisma migrate',        /prisma\s+migrate/i],
    ['prisma db push',        /prisma\s+db\s+push/i],
    ['prisma db seed',        /prisma\s+db\s+seed/i],
    ['prisma db reset',       /prisma\s+db\s+reset/i],
    ['prisma db pull',        /prisma\s+db\s+pull/i],
    ['prisma migrate reset',  /prisma\s+migrate\s+reset/i],
    ['prisma migrate dev',    /prisma\s+migrate\s+dev/i],
    ['prisma migrate deploy', /prisma\s+migrate\s+deploy/i],
    ['seed script',           /node\s+(prisma\/seed|prisma\/seedLargeDemo|prisma\/seedProductionData)/],
    ['seedPayroll script',    /seedPayroll/i],
    ['npm test',              /\bnpm\s+test\b/],
    ['npm run test',          /\bnpm\s+run\s+test\b/],
    ['npx mocha',             /\bnpx\s+mocha\b/],
    ['playwright test',       /\bplaywright\s+test\b/i],
    ['npx playwright test',   /\bnpx\s+playwright\s+test\b/i],
    ['DELETE FROM',           /\bDELETE\s+FROM\b/i],
    ['TRUNCATE',              /\bTRUNCATE\b/i],
    ['DROP TABLE',            /\bDROP\s+TABLE\b/i],
    ['Render prod URL',       /employee-management-system-2b9q\.onrender\.com/],
    ['Vercel prod URL',       /ems-frontend-iota-ten\.vercel\.app/],
  ];

  for (const [label, re] of BLOCKED) {
    if (re.test(cmd)) {
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: `⛔ EMS Safety Guard: blocked "${label}" — requires explicit user approval before touching production DB, deployed services, or running tests against live data.`
      }));
      process.exit(2);
    }
  }

  process.exit(0);
});
