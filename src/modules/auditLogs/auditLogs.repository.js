import { prisma } from '../../plugins/prisma.js';

export async function getAuditLogs(tenantId, page = 1, limit = 10, filters = {}) {
  const skip = (page - 1) * limit;
  const where = { tenantId };

  if (filters.userEmail) {
    where.actor = { email: filters.userEmail };
  }
  if (filters.action) {
    where.action = filters.action;
  }
  if (filters.fromDate || filters.toDate) {
    where.createdAt = {};
    if (filters.fromDate) where.createdAt.gte = filters.fromDate;
    if (filters.toDate) where.createdAt.lte = filters.toDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: { id: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}

export async function getAuditLogById(id, tenantId) {
  return prisma.auditLog.findFirst({
    where: { id, tenantId },
    include: {
      actor: {
        select: { id: true, email: true },
      },
    },
  });
}

export async function getDataAccessAuditLogs(tenantId, fromDate, toDate) {
  const sensitiveActions = [
    'LOGIN',
    'EMPLOYEE_VIEW',
    'EMPLOYEE_DATA_ACCESS',
    'SALARY_VIEW',
    'PERSONAL_DATA_VIEW',
  ];

  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      action: {
        in: sensitiveActions,
      },
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },
    },
    include: {
      actor: {
        select: { id: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return logs;
}

export async function recordAuditLog(tenantId, actorUserId, action, entityType, entityId, oldValues = null, newValues = null, ipAddress = null, userAgent = null) {
  return prisma.auditLog.create({
    data: {
      tenantId,
      actorUserId,
      action,
      entityType,
      entityId,
      oldValuesJson: oldValues ? JSON.stringify(oldValues) : null,
      newValuesJson: newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent,
    },
  });
}
