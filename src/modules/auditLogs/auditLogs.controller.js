import { successResponse, errorResponse } from '../../utils/response.js';
import * as auditLogsService from './auditLogs.service.js';
import * as auditLogsValidator from './auditLogs.validator.js';

export async function getAuditLogs(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const query = auditLogsValidator.listAuditLogsSchema.parse(request.query);

    const data = await auditLogsService.getAuditLogs(tenantId, query.page, query.limit, query);

    return reply.send(successResponse({
      logs: data.logs,
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

export async function getAuditLogById(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const { id } = request.params;

    const log = await auditLogsService.getAuditLogById(id, tenantId);

    return reply.send(successResponse(log));
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

export async function generateDPIAReport(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const body = auditLogsValidator.dpiaReportSchema.parse(request.body);

    const report = await auditLogsService.generateDPIAReport(tenantId, body.from_date, body.to_date);

    await request.log.info({
      action: 'DPIA_REPORT_GENERATED',
      from_date: body.from_date,
      to_date: body.to_date,
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

export async function exportAuditLogs(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const query = auditLogsValidator.exportAuditLogsSchema.parse(request.query);

    const data = await auditLogsService.getAuditLogs(
      tenantId,
      1,
      10000,
      {
        from_date: query.from_date,
        to_date: query.to_date,
      },
    );

    if (query.format === 'csv') {
      const csvData = convertToCSV(data.logs);
      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="audit-logs.csv"')
        .send(csvData);
    }

    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', 'attachment; filename="audit-logs.json"')
      .send(JSON.stringify(data.logs, null, 2));
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

function convertToCSV(logs) {
  if (logs.length === 0) return 'id,user_email,action,entity_type,entity_id,created_at\n';

  const headers = ['id', 'user_email', 'action', 'entity_type', 'entity_id', 'created_at'];
  const rows = logs.map((log) => [
    log.id,
    log.user_email,
    log.action,
    log.entity_type,
    log.entity_id,
    log.created_at,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csvContent;
}
