import * as auditLogsRepository from './auditLogs.repository.js';

class AppError extends Error {
  constructor(message, code, statusCode = 400, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Normalize an audit-log value column for API output.
 *
 * `oldValuesJson` / `newValuesJson` are Prisma `Json?` columns, so Prisma
 * returns them already deserialized (object / array / scalar). Calling
 * JSON.parse() on an object coerces it to the string "[object Object]" and
 * throws SyntaxError — which used to 500 the whole export the moment a single
 * non-null row appeared (BE-API-1). Legacy rows written via JSON.stringify are
 * instead stored as a JSON-string scalar, so we still parse strings when we can.
 * Never throws: a value that can't be parsed is returned as-is.
 */
export function normalizeAuditJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value; // already-parsed Json column
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value; // legacy / non-JSON string — surface raw rather than crash
    }
  }
  return value; // number / boolean scalar
}

export async function getAuditLogs(tenantId, page, limit, filters) {
  const { logs, total } = await auditLogsRepository.getAuditLogs(
    tenantId,
    page,
    limit,
    {
      userEmail: filters.user_email,
      action: filters.action,
      entity: filters.entity,
      entityId: filters.entityId,
      fromDate: filters.from_date,
      toDate: filters.to_date,
    },
  );

  return {
    logs: logs.map((log) => ({
      id: log.id,
      user_email: log.actor?.email || 'System',
      action: log.action,
      entity_type: log.entityType,
      entity_id: log.entityId,
      old_value: normalizeAuditJson(log.oldValuesJson),
      new_value: normalizeAuditJson(log.newValuesJson),
      ip_address: log.ipAddress,
      user_agent: log.userAgent,
      created_at: log.createdAt,
    })),
    total,
  };
}

export async function getAuditLogById(id, tenantId) {
  const log = await auditLogsRepository.getAuditLogById(id, tenantId);

  if (!log) {
    throw new AppError('Audit log not found', 'NOT_FOUND', 404);
  }

  return {
    id: log.id,
    user_email: log.actor?.email || 'System',
    action: log.action,
    entity_type: log.entityType,
    entity_id: log.entityId,
    old_value: normalizeAuditJson(log.oldValuesJson),
    new_value: normalizeAuditJson(log.newValuesJson),
    ip_address: log.ipAddress,
    user_agent: log.userAgent,
    created_at: log.createdAt,
  };
}

export async function generateDPIAReport(tenantId, fromDate, toDate) {
  const logs = await auditLogsRepository.getDataAccessAuditLogs(
    tenantId,
    fromDate,
    toDate,
  );

  const userAccessCount = {};
  const dataCategoriesAccessed = new Set();

  logs.forEach((log) => {
    const email = log.actor?.email || 'System';
    userAccessCount[email] = (userAccessCount[email] || 0) + 1;

    if (log.action.includes('PERSONAL_DATA') || log.action.includes('SALARY')) {
      dataCategoriesAccessed.add(log.action);
    }
  });

  const highAccessUsers = Object.entries(userAccessCount)
    .filter(([, count]) => count > 10)
    .map(([email, count]) => ({
      email,
      access_count: count,
      risk_level: count > 50 ? 'HIGH' : 'MEDIUM',
    }))
    .sort((a, b) => b.access_count - a.access_count);

  return {
    report_date: new Date(),
    period: {
      from_date: fromDate,
      to_date: toDate,
    },
    high_access_users: highAccessUsers,
    data_categories_accessed: Array.from(dataCategoriesAccessed),
    total_access_events: logs.length,
    compliance_status: highAccessUsers.length === 0 ? 'COMPLIANT' : 'REVIEW_REQUIRED',
  };
}

export async function recordAuditLog(tenantId, actorUserId, action, entityType, entityId, oldValues = null, newValues = null, ipAddress = null, userAgent = null) {
  return auditLogsRepository.recordAuditLog(
    tenantId,
    actorUserId,
    action,
    entityType,
    entityId,
    oldValues,
    newValues,
    ipAddress,
    userAgent,
  );
}
