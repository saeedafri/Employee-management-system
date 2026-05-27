import { expect } from 'chai';
import sinon from 'sinon';

global.expect = expect;
global.sinon = sinon;

// Hard block: abort the entire test run if DATABASE_URL points to a production host.
// This prevents accidentally wiping or polluting the Render/Supabase DB when
// a developer runs `npm test` locally without setting up a local test DB.
const dbUrl = process.env.DATABASE_URL || '';
const productionHosts = ['render.com', 'supabase.co', 'railway.app', 'neon.tech', 'planetscale'];
const isProductionDb = productionHosts.some((h) => dbUrl.includes(h));
if (isProductionDb) {
  const host = dbUrl.split('@')[1]?.split('/')[0] || 'unknown host';
  console.error(`\n⛔  BLOCKED: DATABASE_URL points to production (${host}).\n    npm test must run against a local test DB.\n    Set DATABASE_URL=postgresql://localhost:5432/ems_test and NODE_ENV=test.\n`);
  process.exit(1);
}
