import * as service from './employees.service.js';
import * as repo from './employees.repository.js';
import * as validator from './employees.validator.js';
import { errorResponse } from '../../utils/response.js';
import { canAccessEmployeeRecord, hasPermission } from '../auth/auth.policy.js';
import { uploadToCloudinary, deleteFromCloudinary, isCloudinaryConfigured, getSignedDocumentUrl } from '../../utils/cloudinary.js';
import { prisma } from '../../plugins/prisma.js';
import { generateId } from '../../utils/id.js';
import { recordAuditLog } from '../auditLogs/auditLogs.service.js';
import { assertCanViewEmployee } from '../../utils/approvalGuard.js';
import sharp from 'sharp';

const CONFLICT_CODES = new Set(['DUPLICATE_EMPLOYEE_CODE', 'DUPLICATE_WORK_EMAIL', 'EMPLOYEE_HAS_DEPENDENTS', 'ALREADY_ACTIVE', 'EMPLOYEE_TERMINATED']);
const NOT_FOUND_CODES = new Set(['NOT_FOUND', 'EMPLOYEE_NOT_FOUND']);
const UNPROCESSABLE_CODES = new Set(['VALIDATION_ERROR', 'NO_DELIVERY_EMAIL']);
const RATE_LIMIT_CODES = new Set(['RATE_LIMITED']);

function errorStatus(code) {
  if (CONFLICT_CODES.has(code)) return 409;
  if (NOT_FOUND_CODES.has(code)) return 404;
  if (UNPROCESSABLE_CODES.has(code)) return 422;
  if (RATE_LIMIT_CODES.has(code)) return 429;
  return 400;
}

// A user may act on an employee's documents only if it is their own record or
// they are HR/Admin. Shared by upload/list/presign/confirm/download so no
// document handler can be left unguarded (BE-SEC-5).
function canAccessEmployeeDocs(user, employeeId) {
  return user.employeeId === employeeId || hasPermission(user, 'employees:read-any');
}

export async function listEmployees(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  try {
    const query = await validator.listQuerySchema.parseAsync(request.query);

    // Server-side row-level filtering per wireframe Page 07:
    //   HR_ADMIN / SUPER_ADMIN → see everyone
    //   MANAGER                → see their direct reports + themselves
    //   EMPLOYEE               → see only themselves
    if (user.memberType === 'MANAGER' && user.employeeId) {
      query.managerOrSelf = user.employeeId;
    } else if (user.memberType === 'EMPLOYEE' && user.employeeId) {
      query.selfId = user.employeeId;
    }

    const result = await service.listEmployees(tenantId, query, user.id);
    reply.code(result.error ? 400 : 200).send(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      const details = error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
      return reply.code(422).send(errorResponse('VALIDATION_ERROR', 'Request validation failed', details, request.id));
    }
    throw error;
  }
}

export async function getEmployeeActivity(request, reply) {
  const { user } = request;
  const tenantId = request.tenant.id;
  try {
    const { id } = await validator.idParamSchema.parseAsync(request.params);
    // BE-SEC-4: self, HR/SA, or the subject's DIRECT manager only (was: any manager).
    try {
      await assertCanViewEmployee(prisma, tenantId, user, id);
    } catch (e) {
      return reply.code(e.statusCode || 403).send(errorResponse(e.code || 'FORBIDDEN', e.message, {}, request.id));
    }
    const result = await service.getEmployeeActivity(id, tenantId, { limit: Number(request.query.limit) || 50 });
    reply.code(result.error ? (result.error.code === 'NOT_FOUND' ? 404 : 400) : 200).send(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      const details = error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
      return reply.code(422).send(errorResponse('VALIDATION_ERROR', 'Request validation failed', details, request.id));
    }
    throw error;
  }
}

export async function getEmployee(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  try {
    const { id } = await validator.idParamSchema.parseAsync(request.params);

    if (!canAccessEmployeeRecord(user, id)) {
      return reply.code(403).send(errorResponse('FORBIDDEN', 'Cannot view other employee data', {}, request.id));
    }

    const includeTerminated = request.query.includeTerminated === 'true' && hasPermission(user, 'employees:read-any');
    const result = await service.getEmployee(id, tenantId, { includeTerminated });
    reply.code(result.error ? errorStatus(result.error.code) : 200).send(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      const details = error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
      return reply.code(422).send(errorResponse('VALIDATION_ERROR', 'Request validation failed', details, request.id));
    }
    throw error;
  }
}

export async function createEmployee(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!hasPermission(user, 'employees:read-any')) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can create employees', request.requestId));
  }

  try {
    const data = await validator.createEmployeeSchema.parseAsync(request.body);
    const result = await service.createEmployee(tenantId, data, user.id);
    reply.code(result.error ? errorStatus(result.error.code) : 201).send(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      const details = error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
      return reply.code(422).send(errorResponse('VALIDATION_ERROR', 'Request validation failed', details, request.id));
    }
    throw error;
  }
}

export async function updateEmployee(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  try {
    const { id } = await validator.idParamSchema.parseAsync(request.params);

    if (!canAccessEmployeeRecord(user, id)) {
      return reply.code(403).send(errorResponse('FORBIDDEN', 'Cannot update other employee data', {}, request.id));
    }

    const data = await validator.updateEmployeeSchema.parseAsync(request.body);
    const result = await service.updateEmployee(id, tenantId, data, user.id);
    reply.code(result.error ? errorStatus(result.error.code) : 200).send(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      const details = error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
      return reply.code(422).send(errorResponse('VALIDATION_ERROR', 'Request validation failed', details, request.id));
    }
    throw error;
  }
}

export async function deleteEmployee(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!hasPermission(user, 'employees:read-any')) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can delete employees', request.requestId));
  }

  try {
    const { id } = await validator.idParamSchema.parseAsync(request.params);
    const result = await service.deleteEmployee(id, tenantId);
    reply.code(result.error ? errorStatus(result.error.code) : 200).send(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      const details = error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
      return reply.code(422).send(errorResponse('VALIDATION_ERROR', 'Request validation failed', details, request.id));
    }
    throw error;
  }
}

export async function uploadDocument(request, reply) {
  const { user } = request;
  const tenantId = request.tenant.id;
  const { id: employeeId } = request.params;

  // HR_ADMIN and SUPER_ADMIN can upload for anyone; employee can upload their own
  if (!canAccessEmployeeRecord(user, employeeId)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Cannot upload documents for other employees', request.requestId));
  }

  if (!isCloudinaryConfigured()) {
    return reply.code(503).send(errorResponse('STORAGE_NOT_CONFIGURED', 'File storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET env vars.', request.requestId));
  }

  try {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send(errorResponse('NO_FILE', 'No file provided', request.requestId));
    }

    const { documentType = 'OTHER' } = request.query;
    const rawBuffer = await data.toBuffer();
    const fileId = generateId();

    const isImage = data.mimetype?.startsWith('image/');
    let uploadBuffer = rawBuffer;
    let uploadMimeType = data.mimetype;
    let uploadFileName = data.filename;
    let cloudinaryResourceType = 'raw';

    if (isImage) {
      uploadBuffer = await sharp(rawBuffer)
        .webp({ quality: 85 })
        .toBuffer();
      uploadMimeType = 'image/webp';
      uploadFileName = data.filename.replace(/\.[^.]+$/, '') + '.webp';
      cloudinaryResourceType = 'image';
    }

    const uploaded = await uploadToCloudinary(uploadBuffer, {
      folder: `ems/${tenantId}/employees/${employeeId}`,
      publicId: fileId,
      resourceType: cloudinaryResourceType,
      type: 'authenticated', // PII: not publicly deliverable — download via signed URL only (BE-SEC-1)
    });

    const doc = await prisma.employeeDocument.create({
      data: {
        tenant: { connect: { id: tenantId } },
        employee: { connect: { id: employeeId } },
        documentType,
        fileName: uploadFileName,
        // Do NOT persist a working delivery URL: an authenticated upload's
        // secure_url is signed but non-expiring, so storing it would re-create a
        // permanent link (BE-SEC-1). Downloads mint a short-lived signed URL from
        // storageKey at request time instead.
        fileUrl: '',
        storageKey: uploaded.publicId,
        mimeType: uploadMimeType,
        sizeBytes: uploaded.bytes,
        uploadedBy: { connect: { id: user.sub } },
        verificationStatus: 'PENDING',
      },
    });

    await recordAuditLog(
      tenantId,
      user.sub,
      'DOCUMENT_UPLOADED',
      'Employee',
      employeeId,
      null,
      { documentId: doc.id, fileName: doc.fileName, documentType },
    ).catch(() => {});

    // Tell the employee a document landed on their profile. Best-effort: never
    // fail an upload that already succeeded.
    try {
      const { notifyDocumentUploaded } = await import('../../utils/notifier.js');
      await notifyDocumentUploaded(tenantId, employeeId, doc);
    } catch { /* non-fatal */ }

    reply.code(201).send({ success: true, data: doc });
  } catch (err) {
    reply.code(500).send(errorResponse('UPLOAD_ERROR', err.message, request.requestId));
  }
}

export async function listDocuments(request, reply) {
  const { user } = request;
  const tenantId = request.tenant.id;
  const { id: employeeId } = request.params;

  if (!canAccessEmployeeRecord(user, employeeId)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Cannot view documents for other employees', request.requestId));
  }

  try {
    const docs = await prisma.employeeDocument.findMany({
      where: { tenantId, employeeId },
      orderBy: { createdAt: 'desc' },
    });
    // fileUrl is intentionally not a working link (BE-SEC-1); expose the
    // request-time signed download endpoint the FE should use instead.
    const withDownload = docs.map((d) => ({
      ...d,
      downloadUrl: `/api/v1/employees/${employeeId}/documents/${d.id}/download`,
    }));
    reply.code(200).send({ success: true, data: withDownload });
  } catch (err) {
    reply.code(500).send(errorResponse('QUERY_ERROR', err.message, request.requestId));
  }
}

export async function deleteDocument(request, reply) {
  const { user } = request;
  const tenantId = request.tenant.id;
  const { id: employeeId, docId } = request.params;

  if (!hasPermission(user, 'employees:read-any')) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can delete documents', request.requestId));
  }

  try {
    const doc = await prisma.employeeDocument.findFirst({ where: { id: docId, tenantId, employeeId } });
    if (!doc) return reply.code(404).send(errorResponse('NOT_FOUND', 'Document not found', request.requestId));

    if (doc.storageKey && isCloudinaryConfigured()) {
      const resourceType = doc.mimeType?.startsWith('image/') ? 'image' : 'raw';
      await deleteFromCloudinary(doc.storageKey, resourceType);
    }

    await prisma.employeeDocument.delete({ where: { id: docId } });
    await recordAuditLog(
      tenantId,
      user.sub,
      'DOCUMENT_DELETED',
      'Employee',
      employeeId,
      { documentId: docId, fileName: doc.fileName },
      null,
    ).catch(() => {});

    reply.code(200).send({ success: true, message: 'Document deleted' });
  } catch (err) {
    reply.code(500).send(errorResponse('DELETE_ERROR', err.message, request.requestId));
  }
}

export async function exportEmployees(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!hasPermission(user, 'employees:read-any')) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can export employees', request.requestId));
  }

  try {
    const employees = await repo.exportEmployeesCsv(tenantId);
    const headers = ['employeeCode', 'firstName', 'lastName', 'workEmail', 'designation', 'department', 'manager', 'employmentType', 'employmentStatus', 'joinedOn'];
    const rows = employees.map(e => [
      e.employeeCode, e.firstName, e.lastName, e.workEmail,
      e.designation || '',
      e.department?.name || '',
      e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : '',
      e.employmentType, e.employmentStatus,
      e.joinedOn ? new Date(e.joinedOn).toISOString().split('T')[0] : '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    reply.type('text/csv').header('Content-Disposition', 'attachment; filename="employees.csv"').send(csv);
  } catch (error) {
    reply.code(400).send(errorResponse('EXPORT_ERROR', error.message, request.requestId));
  }
}

export async function bulkDeactivate(request, reply) {
  const tenantId = request.tenant.id;
  const { ids } = request.body;
  const succeeded = [];
  const failed = [];
  for (const id of ids) {
    try {
      const emp = await prisma.employee.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!emp) { failed.push({ id, code: 'NOT_FOUND', message: 'Employee not found' }); continue; }
      // Check direct reports
      const directReports = await prisma.employee.count({ where: { managerId: id, tenantId, deletedAt: null } });
      if (directReports > 0) {
        failed.push({ id, code: 'EMPLOYEE_HAS_DEPENDENTS', message: `Has ${directReports} direct reports.` });
        continue;
      }
      await prisma.employee.update({ where: { id }, data: { employmentStatus: 'INACTIVE' } });
      succeeded.push(id);
    } catch (err) {
      failed.push({ id, code: 'ERROR', message: err.message });
    }
  }
  reply.code(200).send({ success: true, data: { succeeded, failed }, meta: {} });
}

export async function bulkExport(request, reply) {
  const tenantId = request.tenant.id;
  const { ids, format = 'csv' } = request.body || {};
  try {
    const where = { tenantId, deletedAt: null };
    if (ids && ids.length > 0) where.id = { in: ids };
    const employees = await prisma.employee.findMany({
      where,
      include: { department: { select: { name: true } }, manager: { select: { firstName: true, lastName: true } } },
      orderBy: { employeeCode: 'asc' },
    });
    const jobId = generateId();
    reply.code(200).send({ success: true, data: { jobId, status: 'PENDING', format, count: employees.length }, meta: {} });
  } catch (err) {
    reply.code(500).send(errorResponse('EXPORT_ERROR', err.message, request.requestId));
  }
}

export async function presignDocument(request, reply) {
  const { user } = request;
  const tenantId = request.tenant.id;
  const { id: employeeId } = request.params;
  const { filename, contentType, category = 'OTHER' } = request.body;

  if (!canAccessEmployeeDocs(user, employeeId)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Cannot create documents for other employees', request.requestId));
  }

  if (!isCloudinaryConfigured()) {
    return reply.code(503).send(errorResponse('STORAGE_NOT_CONFIGURED', 'Set CLOUDINARY env vars to enable document uploads', request.requestId));
  }

  try {
    const doc = await prisma.employeeDocument.create({
      data: {
        tenantId, employeeId,
        fileName: filename, mimeType: contentType, documentType: category,
        verificationStatus: 'PENDING', fileUrl: '', storageKey: '',
      },
    });
    // Return our own multipart endpoint as the upload URL (Cloudinary direct upload not yet configured)
    const uploadUrl = `/api/v1/employees/${employeeId}/documents`;
    reply.code(200).send({ success: true, data: { uploadUrl, method: 'POST', headers: { 'Content-Type': 'multipart/form-data' }, documentId: doc.id }, meta: {} });
  } catch (err) {
    reply.code(500).send(errorResponse('PRESIGN_ERROR', err.message, request.requestId));
  }
}

export async function confirmDocument(request, reply) {
  const { user } = request;
  const tenantId = request.tenant.id;
  const { id: employeeId, documentId } = request.params;
  if (!canAccessEmployeeDocs(user, employeeId)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Cannot confirm documents for other employees', request.requestId));
  }
  try {
    const doc = await prisma.employeeDocument.findFirst({ where: { id: documentId, tenantId, employeeId } });
    if (!doc) return reply.code(404).send(errorResponse('NOT_FOUND', 'Document not found', request.requestId));
    const updated = await prisma.employeeDocument.update({
      where: { id: documentId },
      data: { verificationStatus: 'PENDING' },
    });
    reply.code(201).send({
      success: true,
      data: {
        id: updated.id, employeeId, filename: updated.fileName, category: updated.documentType,
        contentType: updated.mimeType, status: updated.verificationStatus,
        uploadedAt: updated.createdAt,
        downloadUrl: `/api/v1/employees/${employeeId}/documents/${documentId}/download`,
      },
      meta: {},
    });
  } catch (err) {
    reply.code(500).send(errorResponse('CONFIRM_ERROR', err.message, request.requestId));
  }
}

export async function downloadDocument(request, reply) {
  const { user } = request;
  const tenantId = request.tenant.id;
  const { id: employeeId, documentId } = request.params;
  if (!canAccessEmployeeDocs(user, employeeId)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Cannot download documents for other employees', request.requestId));
  }
  try {
    const doc = await prisma.employeeDocument.findFirst({ where: { id: documentId, tenantId, employeeId } });
    if (!doc) return reply.code(404).send(errorResponse('NOT_FOUND', 'Document not found', request.requestId));
    // Mint a short-lived signed URL at request time instead of exposing a
    // permanent public CDN link (BE-SEC-1). storageKey is the Cloudinary
    // public_id; fall back to parsing it from a legacy fileUrl.
    const storageKey = doc.storageKey || parseCloudinaryPublicId(doc.fileUrl);
    if (!storageKey) return reply.code(404).send(errorResponse('NOT_FOUND', 'File not available', request.requestId));
    if (!isCloudinaryConfigured()) {
      return reply.code(503).send(errorResponse('STORAGE_NOT_CONFIGURED', 'File storage is not configured', request.requestId));
    }
    const signedUrl = getSignedDocumentUrl({ storageKey, mimeType: doc.mimeType });
    reply.redirect(302, signedUrl);
  } catch (err) {
    reply.code(500).send(errorResponse('DOWNLOAD_ERROR', err.message, request.requestId));
  }
}

// Extract the Cloudinary public_id from a legacy delivery URL, e.g.
// https://res.cloudinary.com/<cloud>/image/upload/v123/ems/a/b/c.webp -> ems/a/b/c
// Only images carry a delivery extension; raw public_ids keep theirs verbatim.
function parseCloudinaryPublicId(fileUrl) {
  if (!fileUrl) return null;
  const m = fileUrl.match(/\/(raw|image|video)\/(?:authenticated|upload)\/(?:v\d+\/)?(.+?)(?:\?.*)?$/);
  if (!m) return null;
  const [, kind, publicId] = m;
  return kind === 'image' ? publicId.replace(/\.[^./]+$/, '') : publicId;
}

export async function uploadPhoto(request, reply) {
  const { user } = request;
  const tenantId = request.tenant.id;
  const { id: employeeId } = request.params;

  if (!canAccessEmployeeRecord(user, employeeId)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Cannot upload photo for other employees', request.requestId));
  }

  if (!isCloudinaryConfigured()) {
    return reply.code(503).send(errorResponse('STORAGE_NOT_CONFIGURED', 'Set CLOUDINARY env vars to enable photo uploads', request.requestId));
  }

  const emp = await prisma.employee.findFirst({ where: { id: employeeId, tenantId, deletedAt: null } });
  if (!emp) return reply.code(404).send(errorResponse('NOT_FOUND', 'Employee not found', request.requestId));

  try {
    const data = await request.file();
    if (!data) return reply.code(400).send(errorResponse('NO_FILE', 'No file provided', request.requestId));

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(data.mimetype)) {
      return reply.code(400).send(errorResponse('INVALID_FILE_TYPE', 'Only JPEG, PNG, WebP, GIF allowed', request.requestId));
    }

    const raw = await data.toBuffer();

    // Convert any image format to WebP (800×800 max, quality 85)
    const webpBuffer = await sharp(raw)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    // Delete old photo from Cloudinary if exists
    if (emp.profilePhotoUrl) {
      const oldKey = emp.profilePhotoUrl.match(/\/ems\/[^?]+/)?.[0]?.slice(1);
      if (oldKey) await deleteFromCloudinary(oldKey, 'image').catch(() => {});
    }

    const fileId = generateId();
    const uploaded = await uploadToCloudinary(webpBuffer, {
      folder: `ems/${tenantId}/photos`,
      publicId: fileId,
      resourceType: 'image',
    });

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: { profilePhotoUrl: uploaded.url },
      select: { id: true, profilePhotoUrl: true },
    });

    reply.code(200).send({ success: true, data: updated });
  } catch (err) {
    reply.code(500).send(errorResponse('UPLOAD_ERROR', err.message, request.requestId));
  }
}

export async function deletePhoto(request, reply) {
  const { user } = request;
  const tenantId = request.tenant.id;
  const { id: employeeId } = request.params;

  if (!canAccessEmployeeRecord(user, employeeId)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Cannot delete photo for other employees', request.requestId));
  }

  const emp = await prisma.employee.findFirst({ where: { id: employeeId, tenantId, deletedAt: null } });
  if (!emp) return reply.code(404).send(errorResponse('NOT_FOUND', 'Employee not found', request.requestId));
  if (!emp.profilePhotoUrl) return reply.code(404).send(errorResponse('NOT_FOUND', 'No profile photo to delete', request.requestId));

  try {
    const oldKey = emp.profilePhotoUrl.match(/\/ems\/[^?]+/)?.[0]?.slice(1);
    if (oldKey && isCloudinaryConfigured()) await deleteFromCloudinary(oldKey, 'image').catch(() => {});

    await prisma.employee.update({ where: { id: employeeId }, data: { profilePhotoUrl: null } });
    reply.code(200).send({ success: true, message: 'Profile photo deleted' });
  } catch (err) {
    reply.code(500).send(errorResponse('DELETE_ERROR', err.message, request.requestId));
  }
}

export async function sendInvite(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!hasPermission(user, 'employees:read-any')) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can send invites', {}, request.id));
  }

  try {
    const { id: employeeId } = request.params;
    const { emailTarget } = await validator.sendInviteSchema.parseAsync(request.body ?? {});
    const result = await service.sendEmployeeInvite(employeeId, tenantId, emailTarget, user.id);
    reply.code(result.error ? errorStatus(result.error.code) : 200).send(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      const details = error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
      return reply.code(422).send(errorResponse('VALIDATION_ERROR', 'Request validation failed', details, request.id));
    }
    throw error;
  }
}
