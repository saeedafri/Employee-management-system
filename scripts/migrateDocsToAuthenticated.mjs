/* eslint-disable no-console */
// BE-SEC-1 one-off migration: move existing EmployeeDocument objects from
// public ('upload') Cloudinary delivery to access-controlled ('authenticated').
// Keeps the same public_id, so downloads (which mint signed URLs from storageKey)
// keep working while the old public CDN link stops delivering (401/404).
//
// Usage (run inside the ems-backend container, which has DATABASE_URL + CLOUDINARY_*):
//   node scripts/migrateDocsToAuthenticated.mjs --dry-run       # preview only
//   node scripts/migrateDocsToAuthenticated.mjs --limit 1       # migrate one (canary)
//   node scripts/migrateDocsToAuthenticated.mjs                 # migrate all
//   node scripts/migrateDocsToAuthenticated.mjs --revert        # roll back to public
import { prisma } from '../src/plugins/prisma.js';
import { changeDeliveryType } from '../src/utils/cloudinary.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const revert = args.includes('--revert');
const limitFlag = args.indexOf('--limit');
const limit = limitFlag >= 0 ? parseInt(args[limitFlag + 1], 10) : Infinity;

function parse(fileUrl, storageKey) {
  // resource kind from the URL path; public_id prefer storageKey, else parse URL.
  const km = fileUrl?.match(/\/(raw|image|video)\/(?:authenticated|upload)\//);
  const kind = km ? km[1] : 'raw';
  let publicId = storageKey;
  if (!publicId && fileUrl) {
    const m = fileUrl.match(/\/(?:raw|image|video)\/(?:authenticated|upload)\/(?:v\d+\/)?(.+?)(?:\?.*)?$/);
    if (m) publicId = kind === 'image' ? m[1].replace(/\.[^./]+$/, '') : m[1];
  }
  return { resourceType: kind, publicId };
}

async function main() {
  const docs = await prisma.employeeDocument.findMany({
    where: { fileUrl: { contains: 'res.cloudinary.com' } },
    select: { id: true, fileUrl: true, storageKey: true, mimeType: true, documentType: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Found ${docs.length} document(s) with a Cloudinary URL. Mode: ${revert ? 'REVERT' : dryRun ? 'DRY-RUN' : 'MIGRATE'}${limit !== Infinity ? ` (limit ${limit})` : ''}`);

  let done = 0, skipped = 0, failed = 0;
  for (const d of docs) {
    if (done >= limit) break;
    const { resourceType, publicId } = parse(d.fileUrl, d.storageKey);
    if (!publicId) { console.log(`  SKIP ${d.id} (no public_id)`); skipped++; continue; }
    const from = revert ? 'authenticated' : 'upload';
    const to = revert ? 'upload' : 'authenticated';
    if (dryRun) { console.log(`  DRY  ${d.documentType} ${resourceType} ${publicId}  ${from}->${to}`); done++; continue; }
    try {
      await changeDeliveryType({ publicId, resourceType, from, to });
      await prisma.employeeDocument.update({ where: { id: d.id }, data: { storageKey: publicId } });
      console.log(`  OK   ${d.documentType} ${resourceType} ${publicId}  ${from}->${to}`);
      done++;
    } catch (e) {
      const msg = String(e?.message || e);
      if (/not found|resource not found/i.test(msg)) { console.log(`  SKIP ${publicId} (already ${to} or missing)`); skipped++; }
      else { console.log(`  FAIL ${publicId}: ${msg}`); failed++; }
    }
  }
  console.log(`\nDone. migrated=${done} skipped=${skipped} failed=${failed}`);
  await prisma.$disconnect();
  if (failed) process.exitCode = 1;
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
