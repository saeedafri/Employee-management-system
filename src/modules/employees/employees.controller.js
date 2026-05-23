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
