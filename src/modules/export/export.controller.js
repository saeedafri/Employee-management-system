import { successResponse, errorResponse } from '../../utils/response.js';
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

export async function downloadExport(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const { job_id } = request.params;

    const status = await exportService.getExportStatus(job_id, tenantId);

    if (status.status === 'SUCCESS' && status.file_url) {
      return reply.download(status.file_url, {
        'Content-Disposition': `attachment; filename="${job_id}.${status.format}"`,
      });
    }

    return reply.send(successResponse(status));
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
