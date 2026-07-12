// BE-SEC-1: document delivery must be access-controlled. getSignedDocumentUrl
// must produce a SIGNED, EXPIRING, authenticated-type URL (never a bare public
// CDN link). Offline — builds signed strings, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';

async function loadSigner() {
  process.env.CLOUDINARY_CLOUD_NAME = 'democloud';
  process.env.CLOUDINARY_API_KEY = '111';
  process.env.CLOUDINARY_API_SECRET = 'secret';
  const mod = await import('../src/utils/cloudinary.js');
  return mod.getSignedDocumentUrl;
}

test('signed URL for a raw doc is authenticated, signed, and time-limited', async () => {
  const getSignedDocumentUrl = await loadSigner();
  const url = getSignedDocumentUrl({ storageKey: 'ems/t/employees/e/fileid', mimeType: 'application/pdf' });
  assert.match(url, /type=authenticated/);
  assert.match(url, /signature=/);
  assert.match(url, /expires_at=\d+/);
  assert.match(url, /\/raw\/download/);
  assert.doesNotMatch(url, /\/upload\//); // never a public upload URL
});

test('signed URL for an image doc carries webp format + signature', async () => {
  const getSignedDocumentUrl = await loadSigner();
  const url = getSignedDocumentUrl({ storageKey: 'ems/t/employees/e/fileid', mimeType: 'image/webp' });
  assert.match(url, /\/image\/download/);
  assert.match(url, /format=webp/);
  assert.match(url, /signature=/);
  assert.match(url, /expires_at=\d+/);
});

test('expiry advances with a longer TTL', async () => {
  const getSignedDocumentUrl = await loadSigner();
  const short = getSignedDocumentUrl({ storageKey: 'k', mimeType: 'application/pdf', expiresInSec: 60 });
  const long = getSignedDocumentUrl({ storageKey: 'k', mimeType: 'application/pdf', expiresInSec: 3600 });
  const e1 = Number(short.match(/expires_at=(\d+)/)[1]);
  const e2 = Number(long.match(/expires_at=(\d+)/)[1]);
  assert.ok(e2 > e1, 'longer TTL should expire later');
});
