import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { config } from '../../config/index.js';
import { successResponse, errorResponse } from '../../utils/response.js';
import { getSignedDocumentUrl, isCloudinaryConfigured } from '../../utils/cloudinary.js';
import { CLOUDINARY_FILE_PREFIX } from '../../jobs/exportJob.js';
import { hasPermission } from '../auth/auth.policy.js';
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
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  json: 'application/json',
  pdf: 'application/pdf',
};

function mimeForExt(ext) {
  return MIME_MAP[ext] || 'application/octet-stream';
}

/**
 * `employees-2026-08-13.csv` -- the convention the direct exports already use,
 * rather than the `export-<uuid>.csv` this endpoint produced.
 */
export function exportFilename(status, ext) {
  const when = status.completed_at ?? status.created_at ?? new Date();
  const stamp = new Date(when).toISOString().slice(0, 10);
  const type = String(status.export_type ?? 'export').toLowerCase();
  return `${type}-${stamp}.${ext}`;
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
    const filename = exportFilename(status, ext);
    const stored = status.file_url || '';

    // BE-10: this used to 302 to the Cloudinary signed URL. Cloudinary serves a
    // raw asset as `application/octet-stream` with `filename="file"` -- the
    // headers we set here never reached the browser, so an employees export
    // downloaded as a extensionless file named `file`. Proxy the bytes instead
    // so our Content-Type and filename are the ones the user gets.
    // ponytail: buffers the whole artifact; stream it if exports outgrow memory.
    if (stored.startsWith(CLOUDINARY_FILE_PREFIX) && isCloudinaryConfigured()) {
      const publicId = stored.slice(CLOUDINARY_FILE_PREFIX.length);
      try {
        const signedUrl = getSignedDocumentUrl({
          storageKey: publicId,
          mimeType: contentType,
          expiresInSec: 300,
        });
        const upstream = await fetch(signedUrl);
        if (!upstream.ok) throw new Error(`Cloudinary responded ${upstream.status}`);
        return reply
          .type(contentType)
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(Buffer.from(await upstream.arrayBuffer()));
      } catch (err) {
        request.log.warn({ err, job_id }, 'Cloudinary fetch failed; trying local disk');
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

    // BE-3: an employee saw all 7 tenant jobs, including EMPLOYEES bulk exports
    // they never requested. Only an export-permission holder sees other people's.
    const seesAll = ['employees:export', 'attendance:export', 'leave:export']
      .some((key) => hasPermission(request.user, key));

    const data = await exportService.listExports(
      tenantId, query.page, query.limit, query.status, seesAll ? null : request.user.id,
    );

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
