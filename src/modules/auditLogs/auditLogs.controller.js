import { successResponse, errorResponse } from '../../utils/response.js';
import * as auditLogsService from './auditLogs.service.js';
import * as auditLogsValidator from './auditLogs.validator.js';
import { buildCsv } from '../../utils/csv.js';

/**
 * BE-10(b). The export is capped rather than streamed -- on a tenant with
 * 501,538 rows that is 10k of 501k. Streaming the lot would buffer ~100MB, so
 * the cap stays and the response now *says* it was truncated instead of
 * silently handing back a partial file.
 */
const AUDIT_EXPORT_CAP = 10000;

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
      AUDIT_EXPORT_CAP,
      {
        from_date: query.from_date,
        to_date: query.to_date,
      },
    );

    // getAuditLogs returns a FLAT `total` (a real COUNT), not `pagination.total`.
    // Reading the wrong key fell back to logs.length, so a 501,538-row tenant
    // reported total=10000 truncated=false -- the exact silence BE-10(b) is about.
    const total = data.total ?? data.logs.length;
    const truncated = total > data.logs.length;
    const stamp = new Date().toISOString().slice(0, 10);

    reply
      .header('X-Export-Total', String(total))
      .header('X-Export-Returned', String(data.logs.length))
      .header('X-Export-Truncated', String(truncated));

    if (query.format === 'csv') {
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="audit-logs-${stamp}.csv"`)
        .send(convertToCSV(data.logs));
    }

    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="audit-logs-${stamp}.json"`)
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

const AUDIT_CSV_HEADERS = ['id', 'user_email', 'action', 'entity_type', 'entity_id', 'created_at'];

/** Exported for the contract test. */
export function convertToCSV(logs) {
  // The header row used to go out unquoted while the data rows were quoted, and
  // created_at was a JS Date toString(). buildCsv quotes both; dates go as ISO.
  const rows = logs.map((log) => [
    log.id,
    log.user_email,
    log.action,
    log.entity_type,
    log.entity_id,
    log.created_at instanceof Date ? log.created_at.toISOString() : log.created_at,
  ]);

  return buildCsv(AUDIT_CSV_HEADERS, rows);
}
