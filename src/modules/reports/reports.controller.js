import { successResponse, errorResponse } from '../../utils/response.js';
import * as reportsService from './reports.service.js';
import * as reportsValidator from './reports.validator.js';

export async function getAttendanceReport(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const query = reportsValidator.attendanceReportSchema.parse(request.query);

    const report = await reportsService.getAttendanceReport(tenantId, query);

    return reply.send(successResponse(report));
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

export async function getLeavesReport(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const query = reportsValidator.leavesReportSchema.parse(request.query);

    const report = await reportsService.getLeavesReport(tenantId, query);

    return reply.send(successResponse(report));
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

export async function getPayrollReport(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const query = reportsValidator.payrollReportSchema.parse(request.query);

    const report = await reportsService.getPayrollReport(tenantId, query);

    return reply.send(successResponse(report));
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

export async function scheduleReport(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const userId = request.user.id;

    const body = reportsValidator.scheduleReportSchema.parse(request.body);

    const report = await reportsService.createScheduledReport(tenantId, userId, body);

    await request.log.info({
      action: 'REPORT_SCHEDULED',
      reportType: body.report_type,
      frequency: body.frequency,
    });

    return reply.status(201).send(successResponse(report));
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

export async function getScheduledReports(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const query = reportsValidator.listScheduledReportsSchema.parse(request.query);

    const data = await reportsService.getScheduledReports(tenantId, query.page, query.limit);

    return reply.send(successResponse({
      reports: data.reports,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: data.total,
        pages: Math.ceil(data.total / query.limit),
      },
    }));
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

export async function updateScheduledReport(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const { id } = request.params;

    const body = reportsValidator.updateScheduledReportSchema.parse(request.body);

    const report = await reportsService.updateScheduledReport(id, tenantId, body);

    await request.log.info({
      action: 'REPORT_SCHEDULED_UPDATED',
      reportId: id,
    });

    return reply.send(successResponse(report));
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

export async function deleteScheduledReport(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const { id } = request.params;

    const result = await reportsService.deleteScheduledReport(id, tenantId);

    await request.log.info({
      action: 'REPORT_SCHEDULED_DELETED',
      reportId: id,
    });

    return reply.send(successResponse(result));
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

export async function getExportHistory(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const query = reportsValidator.exportHistorySchema.parse(request.query);

    const data = await reportsService.getExportHistory(tenantId, query.page, query.limit, query.status);

    return reply.send(successResponse({
      exports: data.exports,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: data.total,
        pages: Math.ceil(data.total / query.limit),
      },
    }));
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
