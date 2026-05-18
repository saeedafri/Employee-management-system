import * as auditLogsRepository from './auditLogs.repository.js';

class AppError extends Error {
  constructor(message, code, statusCode = 400, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function getAuditLogs(tenantId, page, limit, filters) {
  const { logs, total } = await auditLogsRepository.getAuditLogs(
    tenantId,
    page,
    limit,
    {
      userEmail: filters.user_email,
      action: filters.action,
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
      old_value: log.oldValuesJson ? JSON.parse(log.oldValuesJson) : null,
      new_value: log.newValuesJson ? JSON.parse(log.newValuesJson) : null,
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
    old_value: log.oldValuesJson ? JSON.parse(log.oldValuesJson) : null,
    new_value: log.newValuesJson ? JSON.parse(log.newValuesJson) : null,
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
