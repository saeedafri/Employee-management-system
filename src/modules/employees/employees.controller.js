import * as service from './employees.service.js';
import * as repo from './employees.repository.js';
import * as validator from './employees.validator.js';
import { errorResponse } from '../../utils/response.js';
import { uploadToCloudinary, deleteFromCloudinary, isCloudinaryConfigured } from '../../utils/cloudinary.js';
import { prisma } from '../../plugins/prisma.js';
import { generateId } from '../../utils/id.js';

const CONFLICT_CODES = new Set(['DUPLICATE_EMPLOYEE_CODE', 'DUPLICATE_WORK_EMAIL', 'EMPLOYEE_HAS_DEPENDENTS']);
const NOT_FOUND_CODES = new Set(['NOT_FOUND']);

function errorStatus(code) {
  if (CONFLICT_CODES.has(code)) return 409;
  if (NOT_FOUND_CODES.has(code)) return 404;
  return 400;
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
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function getEmployee(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  try {
    const { id } = await validator.idParamSchema.parseAsync(request.params);

    if (user.employeeId !== id && !['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
      return reply.code(403).send(errorResponse('FORBIDDEN', 'Cannot view other employee data', request.requestId));
    }

    const result = await service.getEmployee(id, tenantId);
    reply.code(result.error ? errorStatus(result.error.code) : 200).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function createEmployee(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can create employees', request.requestId));
  }

  try {
    const data = await validator.createEmployeeSchema.parseAsync(request.body);
    const result = await service.createEmployee(tenantId, data, user.id);
    reply.code(result.error ? errorStatus(result.error.code) : 201).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function updateEmployee(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  try {
    const { id } = await validator.idParamSchema.parseAsync(request.params);

    if (user.employeeId !== id && !['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
      return reply.code(403).send(errorResponse('FORBIDDEN', 'Cannot update other employee data', request.requestId));
    }

    const data = await validator.updateEmployeeSchema.parseAsync(request.body);
    const result = await service.updateEmployee(id, tenantId, data, user.id);
    reply.code(result.error ? errorStatus(result.error.code) : 200).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function deleteEmployee(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can delete employees', request.requestId));
  }

  try {
    const { id } = await validator.idParamSchema.parseAsync(request.params);
    const result = await service.deleteEmployee(id, tenantId);
    reply.code(result.error ? errorStatus(result.error.code) : 200).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function uploadDocument(request, reply) {
  const { user } = request;
  const tenantId = request.tenant.id;
  const { id: employeeId } = request.params;

  // HR_ADMIN and SUPER_ADMIN can upload for anyone; employee can upload their own
  if (user.employeeId !== employeeId && !['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
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
    const buffer = await data.toBuffer();
    const publicId = `ems/${tenantId}/employees/${employeeId}/${generateId()}`;

    const uploaded = await uploadToCloudinary(buffer, {
      folder: `ems/${tenantId}/employees/${employeeId}`,
      publicId,
      resourceType: 'auto',
    });

    const doc = await prisma.employeeDocument.create({
      data: {
        tenantId,
        employeeId,
        documentType,
        fileName: data.filename,
        fileUrl: uploaded.url,
        storageKey: uploaded.publicId,
        mimeType: data.mimetype,
        sizeBytes: uploaded.bytes,
        uploadedById: user.id,
        verificationStatus: 'PENDING',
      },
    });

    reply.code(201).send({ success: true, data: doc });
  } catch (err) {
    reply.code(500).send(errorResponse('UPLOAD_ERROR', err.message, request.requestId));
  }
}

export async function listDocuments(request, reply) {
  const { user } = request;
  const tenantId = request.tenant.id;
  const { id: employeeId } = request.params;

  if (user.employeeId !== employeeId && !['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Cannot view documents for other employees', request.requestId));
  }

  try {
    const docs = await prisma.employeeDocument.findMany({
      where: { tenantId, employeeId },
      orderBy: { createdAt: 'desc' },
    });
    reply.code(200).send({ success: true, data: docs });
  } catch (err) {
    reply.code(500).send(errorResponse('QUERY_ERROR', err.message, request.requestId));
  }
}

export async function deleteDocument(request, reply) {
  const { user } = request;
  const tenantId = request.tenant.id;
  const { id: employeeId, docId } = request.params;

  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can delete documents', request.requestId));
  }

  try {
    const doc = await prisma.employeeDocument.findFirst({ where: { id: docId, tenantId, employeeId } });
    if (!doc) return reply.code(404).send(errorResponse('NOT_FOUND', 'Document not found', request.requestId));

    if (doc.storageKey && isCloudinaryConfigured()) {
      await deleteFromCloudinary(doc.storageKey);
    }

    await prisma.employeeDocument.delete({ where: { id: docId } });
    reply.code(200).send({ success: true, message: 'Document deleted' });
  } catch (err) {
    reply.code(500).send(errorResponse('DELETE_ERROR', err.message, request.requestId));
  }
}

export async function exportEmployees(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
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
  const tenantId = request.tenant.id;
  const { id: employeeId } = request.params;
  const { filename, contentType, category = 'OTHER' } = request.body;

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
  const tenantId = request.tenant.id;
  const { id: employeeId, documentId } = request.params;
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
  const tenantId = request.tenant.id;
  const { id: employeeId, documentId } = request.params;
  try {
    const doc = await prisma.employeeDocument.findFirst({ where: { id: documentId, tenantId, employeeId } });
    if (!doc) return reply.code(404).send(errorResponse('NOT_FOUND', 'Document not found', request.requestId));
    if (!doc.fileUrl) return reply.code(404).send(errorResponse('NOT_FOUND', 'File URL not available', request.requestId));
    reply.redirect(302, doc.fileUrl);
  } catch (err) {
    reply.code(500).send(errorResponse('DOWNLOAD_ERROR', err.message, request.requestId));
  }
}
