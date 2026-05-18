import { prisma } from '../../plugins/prisma.js';

function formatTimestampIst(date) {
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = String(istDate.getDate()).padStart(2, '0');
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const year = istDate.getFullYear();
  const hours = String(istDate.getHours()).padStart(2, '0');
  const minutes = String(istDate.getMinutes()).padStart(2, '0');
  const seconds = String(istDate.getSeconds()).padStart(2, '0');
  const ampm = istDate.getHours() >= 12 ? 'PM' : 'AM';
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} ${ampm} IST`;
}

function formatLogEntry(log) {
  return {
    id: log.id,
    level: log.level,
    levelLabel: log.levelLabel,
    levelColor: log.levelColor,
    module: log.module,
    message: log.message,
    requestId: log.requestId,
    actorUserId: log.actorUserId,
    tenantId: log.tenantId,
    metadata: log.metadataJson,
    timestampUtc: log.createdAt.toISOString(),
    timestampIstDisplay: formatTimestampIst(log.createdAt),
  };
}

export async function createLog(tenantId, level, levelLabel, levelColor, module, message, requestId, actorUserId, metadata) {
  const log = await prisma.logEntry.create({
    data: {
      tenantId,
      level,
      levelLabel,
      levelColor,
      module,
      message,
      requestId,
      actorUserId,
      metadataJson: metadata,
    },
  });
  return formatLogEntry(log);
}

export async function getLogs(tenantId, filters = {}) {
  const where = { tenantId };

  if (filters.level) {
    where.level = filters.level;
  }

  if (filters.module) {
    where.module = filters.module;
  }

  if (filters.actorUserId) {
    where.actorUserId = filters.actorUserId;
  }

  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) {
      where.createdAt.gte = new Date(filters.from);
    }
    if (filters.to) {
      where.createdAt.lte = new Date(filters.to);
    }
  }

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const [logs, total] = await Promise.all([
    prisma.logEntry.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            memberType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.logEntry.count({ where }),
  ]);

  return {
    logs: logs.map(formatLogEntry),
    total,
  };
}

export async function getLogById(tenantId, logId) {
  const log = await prisma.logEntry.findFirst({
    where: {
      id: logId,
      tenantId,
    },
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          memberType: true,
        },
      },
    },
  });
  return log ? formatLogEntry(log) : null;
}

export async function getLogsForExport(tenantId, filters = {}) {
  const where = { tenantId };

  if (filters.level) {
    where.level = filters.level;
  }

  if (filters.module) {
    where.module = filters.module;
  }

  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) {
      where.createdAt.gte = new Date(filters.from);
    }
    if (filters.to) {
      where.createdAt.lte = new Date(filters.to);
    }
  }

  const logs = await prisma.logEntry.findMany({
    where,
    include: {
      actor: {
        select: {
          email: true,
          memberType: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return logs.map(formatLogEntry);
}
