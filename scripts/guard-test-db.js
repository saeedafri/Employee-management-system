#!/usr/bin/env node
// Blocks `npm test` from running against production databases.
// Reads .env directly and checks DATABASE_URL before mocha starts.
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env');
let envContent = '';
try {
  envContent = readFileSync(envPath, 'utf8');
} catch {
  // No .env file — shell env is the source of truth
}

function getEnvVar(content, key) {
  const match = content.match(new RegExp(`^${key}=["']?([^"'\n]+)["']?`, 'm'));
  return match?.[1]?.trim() || process.env[key] || '';
}

const dbUrl = getEnvVar(envContent, 'DATABASE_URL');
const productionHosts = ['render.com', 'supabase.co', 'railway.app', 'neon.tech', 'planetscale'];

if (productionHosts.some((h) => dbUrl.includes(h))) {
  const host = dbUrl.split('@')[1]?.split('/')[0] || 'unknown host';
  console.error(`\n⛔  BLOCKED: DATABASE_URL points to production (${host}).\n`);
  console.error('    npm test must run against a local test DB.\n');
  console.error('    Example: DATABASE_URL=postgresql://localhost:5432/ems_test NODE_ENV=test npm test\n');
  process.exit(1);
}
