#!/usr/bin/env node
/**
 * Local-only bootstrap: runs prisma/seed.js against DATABASE_URL.
 * Hard-refuses non-local URLs (Render/Hostinger/etc).
 *
 *   DATABASE_URL='postgresql://ems:ems_local_dev@127.0.0.1:5432/ems_dev?sslmode=disable' \
 *     node scripts/bootstrapLocalDev.mjs
 */
const url = process.env.DATABASE_URL || '';
if (!/(127\.0\.0\.1|localhost)/.test(url)) {
  console.error('BLOCKED: DATABASE_URL must be localhost/127.0.0.1');
  process.exit(1);
}
if (/(render\.com|dpg-|hostinger|ondigitalocean|saqibsaeed\.cloud)/i.test(url)) {
  console.error('BLOCKED: remote host detected in DATABASE_URL');
  process.exit(1);
}
console.log('Bootstrapping local DB via prisma/seed.js …');
await import('../prisma/seed.js');
