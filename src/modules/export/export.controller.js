import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { config } from '../../config/index.js';
import { successResponse, errorResponse } from '../../utils/response.js';
import { getSignedDocumentUrl, isCloudinaryConfigured } from '../../utils/cloudinary.js';
import { CLOUDINARY_FILE_PREFIX } from '../../jobs/exportJob.js';
import * as exportService from './export.service.js';
import * as exportValidator from './export.validator.js';

export async function exportEmployees(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const userId = request.user.id;
    const body = exportValidator.exportEmployeesSchema.parse(request.body);

    const result = await exportService.queueEmployeeExport(tenantId, userId, body);

    await request.log.info({
      action: 'EXPORT_EMPLOYEES_QUEUED',
      jobId: result.job_id,
    });

    return reply.status(202).send(successResponse(result));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function exportAttendance(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const userId = request.user.id;
    const body = exportValidator.exportAttendanceSchema.parse(request.body);

    const result = await exportService.queueAttendanceExport(tenantId, userId, body);

    await request.log.info({
      action: 'EXPORT_ATTENDANCE_QUEUED',
      jobId: result.job_id,
    });

    return reply.status(202).send(successResponse(result));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function exportLeave(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const userId = request.user.id;
    const body = exportValidator.exportLeaveSchema.parse(request.body);

    const result = await exportService.queueLeaveExport(tenantId, userId, body);

    await request.log.info({
      action: 'EXPORT_LEAVE_QUEUED',
      jobId: result.job_id,
    });

    return reply.status(202).send(successResponse(result));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

const MIME_MAP = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  json: 'application/json',
  pdf: 'application/pdf',
};

function mimeForExt(ext) {
  return MIME_MAP[ext] || 'application/octet-stream';
}

export async function downloadExport(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const { job_id } = request.params;

    const status = await exportService.getExportStatus(job_id, tenantId);

    if (status.status !== 'SUCCESS') {
      return reply.send(successResponse(status));
    }

    const ext = status.format === 'excel' ? 'xlsx' : status.format;
    const contentType = mimeForExt(ext);
    const filename = `export-${job_id}.${ext}`;
    const stored = status.file_url || '';

    // Prefer Cloudinary signed redirect when the job stored a cloudinary:// key.
    if (stored.startsWith(CLOUDINARY_FILE_PREFIX) && isCloudinaryConfigured()) {
      const publicId = stored.slice(CLOUDINARY_FILE_PREFIX.length);
      try {
        const signedUrl = getSignedDocumentUrl({
          storageKey: publicId,
          mimeType: contentType,
          expiresInSec: 300,
        });
        return reply.redirect(signedUrl);
      } catch (err) {
        request.log.warn({ err, job_id }, 'Cloudinary signed URL failed; trying local disk');
      }
    }

    const exportsDir = config.exportsDir || '/tmp/exports';
    const filepath = join(exportsDir, `${job_id}.${ext}`);

    if (!existsSync(filepath)) {
      return reply.status(404).send(
        errorResponse('FILE_NOT_FOUND', 'Export file not found or has expired', {}, request.id),
      );
    }

    reply
      .type(contentType)
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(createReadStream(filepath));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function listExports(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const query = exportValidator.listExportsSchema.parse(request.query);

    const data = await exportService.listExports(tenantId, query.page, query.limit, query.status);

    return reply.send(successResponse(data));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}
