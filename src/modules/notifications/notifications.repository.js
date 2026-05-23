import { prisma } from '../../plugins/prisma.js';

const ACTIVE_FILTER = { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };

export async function getNotifications(tenantId, userId, { limit = 20, offset = 0, unreadOnly = false }) {
  const where = { tenantId, userId, ...ACTIVE_FILTER };
  if (unreadOnly) where.readAt = null;

  const [notifications, total] = await Promise.all([
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
  ]);

  return { notifications, total };
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
  return prisma.notification.updateMany({
    where: { tenantId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function deleteExpired() {
  return prisma.notification.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
