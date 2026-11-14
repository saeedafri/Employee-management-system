// Upload content check. The client's mimetype and filename are both forgeable, so the
// extension must be on the route's allowlist AND the first bytes must match that type.
// An HTML/script file renamed or re-typed as .pdf is refused.
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // docx / xlsx are zip containers
const OLE = [0xd0, 0xcf, 0x11, 0xe0]; // legacy doc / xls
const JPEG = [0xff, 0xd8, 0xff];
const MAGIC = {
  pdf: [0x25, 0x50, 0x44, 0x46],
  jpg: JPEG,
  jpeg: JPEG,
  png: [0x89, 0x50, 0x4e, 0x47],
  gif: [0x47, 0x49, 0x46, 0x38],
  webp: [0x52, 0x49, 0x46, 0x46],
  doc: OLE,
  xls: OLE,
  docx: ZIP,
  xlsx: ZIP,
};

export const DOCUMENT_TYPES = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'doc', 'docx', 'xls', 'xlsx'];

/** Returns the verified extension, or null when the name or the bytes don't qualify. */
export function verifiedFileType(filename, buffer, allowed = DOCUMENT_TYPES) {
  const ext = String(filename ?? '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (!ext || !allowed.includes(ext)) return null;
  return MAGIC[ext].every((byte, i) => buffer[i] === byte) ? ext : null;
}
