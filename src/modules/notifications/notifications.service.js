import * as repo from './notifications.repository.js';

function mapNotification(n) {
  const meta = n.metadataJson || {};
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.message,
    entityType: meta.entityType || null,
    entityId: meta.entityId || null,
    actionUrl: meta.actionUrl || null,
    isRead: n.readAt !== null,
    createdAt: n.createdAt,
  };
}

export async function listNotifications(tenantId, userId, filters = {}) {
  const { page = 1, limit = 20, unreadOnly = false, since = null } = filters;
  const offset = (page - 1) * limit;
  const { notifications, total, unreadCount } = await repo.getNotifications(tenantId, userId, {
    limit,
    offset,
    unreadOnly,
    since,
  });
  return {
    notifications: notifications.map(mapNotification),
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getUnreadCount(tenantId, userId) {
  const count = await repo.getUnreadCount(tenantId, userId);
  return { count };
}

export async function markRead(tenantId, userId, notificationId) {
  const n = await repo.markRead(tenantId, userId, notificationId);
  if (!n) return null;
  return { id: n.id, isRead: true };
}

export async function markAllRead(tenantId, userId) {
  const count = await repo.markAllRead(tenantId, userId);
  return { markedRead: count };
}
