/**
 * Seed profile photos for all employees.
 * Generates a unique colored avatar (initials on colored background) in WebP,
 * uploads to Cloudinary, and updates Employee.profilePhotoUrl.
 *
 * Run: node prisma/seedPhotos.js
 */

import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import 'dotenv/config';

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// 20 distinct background colors for variety
const PALETTE = [
  '#4F46E5', '#7C3AED', '#DB2777', '#DC2626', '#D97706',
  '#16A34A', '#0891B2', '#0284C7', '#6D28D9', '#BE185D',
  '#065F46', '#1E40AF', '#92400E', '#1F2937', '#374151',
  '#7E22CE', '#0F766E', '#B45309', '#166534', '#9D174D',
];

function colorForIndex(i) {
  return PALETTE[i % PALETTE.length];
}

function initials(firstName, lastName) {
  return `${(firstName?.[0] ?? '').toUpperCase()}${(lastName?.[0] ?? '').toUpperCase()}`;
}

// Build an SVG with colored background + initials text, convert to WebP
async function generateAvatar(firstName, lastName, colorHex) {
  const init = initials(firstName, lastName);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
  <rect width="400" height="400" fill="${colorHex}" rx="200"/>
  <text x="200" y="265" font-family="Arial,sans-serif" font-size="170" font-weight="700"
        fill="white" text-anchor="middle" dominant-baseline="auto">${init}</text>
</svg>`.trim();

  return sharp(Buffer.from(svg))
    .resize(400, 400)
    .webp({ quality: 85 })
    .toBuffer();
}

async function uploadBuffer(buffer, tenantId, employeeId) {
  return new Promise((resolve, reject) => {
    const publicId = `${employeeId}_photo`;
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `ems/${tenantId}/photos`,
        public_id: publicId,
        resource_type: 'image',
        overwrite: true,
        format: 'webp',
      },
      (err, result) => (err ? reject(err) : resolve(result.secure_url)),
    );
    stream.end(buffer);
  });
}

async function main() {
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null },
    select: { id: true, tenantId: true, firstName: true, lastName: true, profilePhotoUrl: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${employees.length} employees. Generating WebP avatars…`);

  let done = 0;
  let skipped = 0;

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];

    // Skip if already has a photo (re-run safety)
    if (emp.profilePhotoUrl) {
      skipped++;
      continue;
    }

    try {
      const color = colorForIndex(i);
      const buffer = await generateAvatar(emp.firstName, emp.lastName, color);
      const url = await uploadBuffer(buffer, emp.tenantId, emp.id);
      await prisma.employee.update({ where: { id: emp.id }, data: { profilePhotoUrl: url } });
      done++;
      process.stdout.write(`  [${done + skipped}/${employees.length}] ${emp.firstName} ${emp.lastName} → ${url.split('/').slice(-1)[0]}\n`);
    } catch (err) {
      console.error(`  ERROR ${emp.firstName} ${emp.lastName}: ${err.message}`);
    }
  }

  console.log(`\nDone. ${done} uploaded, ${skipped} already had photos.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
