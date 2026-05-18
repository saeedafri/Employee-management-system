import { successResponse, errorResponse } from '../../utils/response.js';
import * as logsService from './logs.service.js';

export async function listLogs(request, reply) {
  try {
    const { tenantId } = request.tenant;
    const { memberType } = request.user || {};

    // Only HR_ADMIN and SUPER_ADMIN can access logs
    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(memberType)) {
      return reply.code(403).send(
        errorResponse(
          'FORBIDDEN',
          'Only HR administrators can access logs',
          {},
          request.id,
        ),
      );
    }

    const { level, module, actorUserId, from, to, limit, offset } = request.query;

    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    const result = await logsService.getLogs(tenantId, {
      level,
      module,
      actorUserId,
      from,
      to,
      limit: limitNum,
      offset: offsetNum,
    });

    const page = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(result.total / limitNum);

    return reply.send(
      successResponse(result.logs, {
        count: result.logs.length,
        page,
        limit: limitNum,
        total: result.total,
        totalPages,
      }),
    );
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getLog(request, reply) {
  try {
    const { tenantId } = request.tenant;
    const { memberType } = request.user || {};

    // Only HR_ADMIN and SUPER_ADMIN can access logs
    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(memberType)) {
      return reply.code(403).send(
        errorResponse(
          'FORBIDDEN',
          'Only HR administrators can access logs',
          {},
          request.id,
        ),
      );
    }

    const { id } = request.params;

    const log = await logsService.getLogById(tenantId, id);

    if (!log) {
      return reply.code(404).send(
        errorResponse(
          'LOG_NOT_FOUND',
          'Log entry not found',
          {},
          request.id,
        ),
      );
    }

    return reply.send(successResponse(log));
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function exportLogs(request, reply) {
  try {
    const { tenantId } = request.tenant;
    const { memberType } = request.user || {};

    // Only HR_ADMIN and SUPER_ADMIN can access logs
    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(memberType)) {
      return reply.code(403).send(
        errorResponse(
          'FORBIDDEN',
          'Only HR administrators can access logs',
          {},
          request.id,
        ),
      );
    }

    const { level, module, startDate, endDate, format } = request.query;

    const logs = await logsService.getLogsForExport(tenantId, {
      level,
      module,
      startDate,
      endDate,
    });

    if (format === 'csv') {
      const csv = convertToCSV(logs);
      reply.type('text/csv');
      reply.header('Content-Disposition', 'attachment; filename="logs.csv"');
      return reply.send(csv);
    }

    // Default to JSON
    reply.type('application/json');
    reply.header('Content-Disposition', 'attachment; filename="logs.json"');
    return reply.send(JSON.stringify(logs, null, 2));
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function streamLogs(request, reply) {
  try {
    const { tenantId } = request.tenant;
    const { memberType } = request.user || {};

    // Only HR_ADMIN and SUPER_ADMIN can access logs
    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(memberType)) {
      return reply.code(403).send(
        errorResponse(
          'FORBIDDEN',
          'Only HR administrators can access logs',
          {},
          request.id,
        ),
      );
    }

    const { level, module, startDate, endDate } = request.query;

    const logs = await logsService.getLogsForExport(tenantId, {
      level,
      module,
      startDate,
      endDate,
    });

    reply.type('application/x-ndjson');
    reply.header('Content-Disposition', 'attachment; filename="logs.ndjson"');

    for (const log of logs) {
      reply.write(JSON.stringify(log) + '\n');
    }

    return reply.send();
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

function convertToCSV(logs) {
  const headers = ['ID', 'Level', 'Module', 'Message', 'Actor', 'Request ID', 'Timestamp IST'];
  const rows = logs.map(log => [
    log.id,
    log.levelLabel,
    log.module,
    log.message,
    log.actor?.email || 'System',
    log.requestId || 'N/A',
    log.timestampIstDisplay,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}
