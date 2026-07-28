#!/usr/bin/env node
/**
 * Test runner.
 *
 * `package.json` previously had no `test` script at all, while 59 `.test.js`
 * files sat in `tests/` -- so the "run the suite before every commit" rule was
 * impossible to follow and regressions reached production. This makes the suite
 * runnable.
 *
 * Modes:
 *   offline  pure tests -- no database, no network. Safe anywhere.
 *   db       tests that boot the app / hit Prisma
 *   network  tests that fetch a deployed environment (needs BASE)
 *   all      everything (default)
 *
 * Buckets are detected rather than hand-listed, so a new test lands in the right
 * one automatically. Network tests are excluded from `offline` because they
 * silently pass or fail on whatever environment BASE happens to point at -- one
 * of them was still aimed at the retired Render host long after the move to
 * Hostinger, and nothing caught it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const mode = process.argv[2] ?? 'all';
if (!['offline', 'db', 'network', 'all'].includes(mode)) {
  console.error(`Unknown mode "${mode}". Use: offline | db | network | all`);
  process.exit(2);
}

function collect(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...collect(full));
    else if (entry.endsWith('.test.js')) found.push(full);
  }
  return found;
}

const NEEDS_DB = /createApp|plugins\/prisma|PrismaClient/;
const NEEDS_NETWORK = /process\.env\.BASE|https?:\/\/[^'"\s]*(onrender|saqibsaeed|vercel)/;

// A test that stubs the Prisma module needs no database, however much of the
// app it boots -- otherwise the RBAC HTTP tests get misfiled as db-only and
// never run in the default suite.
const MOCKS_PRISMA = /mock\.module\(\s*['"][^'"]*plugins\/prisma/;

function bucketOf(file) {
  const source = readFileSync(file, 'utf8');
  if (NEEDS_NETWORK.test(source)) return 'network';
  if (MOCKS_PRISMA.test(source)) return 'offline';
  if (NEEDS_DB.test(source)) return 'db';
  return 'offline';
}

const all = collect('tests').sort();
const files = mode === 'all' ? all : all.filter((file) => bucketOf(file) === mode);

if (files.length === 0) {
  console.error(`No tests matched mode "${mode}".`);
  process.exit(1);
}

console.log(`Running ${files.length}/${all.length} test files (mode: ${mode})\n`);

const child = spawn(
  process.execPath,
  // Module mocks are used by the RBAC enforcement E2E test to stub Prisma, so
  // the whole HTTP stack can be exercised without a database.
  ['--test', '--experimental-test-module-mocks', '--test-concurrency=1', ...files],
  { stdio: 'inherit', env: process.env },
);
child.on('exit', (code) => process.exit(code ?? 1));
