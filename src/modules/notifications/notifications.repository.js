import { prisma } from '../../plugins/prisma.js';

const ACTIVE_FILTER = { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };

export async function getNotifications(tenantId, userId, { limit = 20, offset = 0, unreadOnly = false, since = null }) {
  const where = { tenantId, userId, ...ACTIVE_FILTER };
  if (unreadOnly) where.readAt = null;
  if (since) where.createdAt = { gt: new Date(since) };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        metadataJson: true,
        readAt: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { tenantId, userId, readAt: null, ...ACTIVE_FILTER } }),
  ]);

  return { notifications, total, unreadCount };
}

export async function getUnreadCount(tenantId, userId) {
  return prisma.notification.count({
    where: { tenantId, userId, readAt: null, ...ACTIVE_FILTER },
  });
}

export async function markRead(tenantId, userId, notificationId) {
  const n = await prisma.notification.findFirst({
    where: { id: notificationId, tenantId, userId },
  });
  if (!n) return null;
  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(tenantId, userId) {
  const result = await prisma.notification.updateMany({
    where: { tenantId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function deleteExpired() {
  return prisma.notification.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
