import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifiedFileType } from '../src/utils/fileSignature.js';

const pdf = Buffer.from('%PDF-1.7\n...');
const html = Buffer.from('<html><script>alert(1)</script></html>');

test('real files of an allowed type pass', () => {
  assert.equal(verifiedFileType('Offer Letter.PDF', pdf), 'pdf');
  assert.equal(verifiedFileType('photo.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpg');
  assert.equal(verifiedFileType('cv.docx', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14])), 'docx');
});

test('script content is refused whatever it is called', () => {
  assert.equal(verifiedFileType('page.html', html), null, 'extension not allowed');
  assert.equal(verifiedFileType('invoice.pdf', html), null, 'bytes are not a PDF');
  assert.equal(verifiedFileType('noextension', pdf), null);
});

test('a route can narrow the allowlist', () => {
  assert.equal(verifiedFileType('sheet.xlsx', Buffer.from([0x50, 0x4b, 0x03, 0x04]), ['pdf']), null);
});
