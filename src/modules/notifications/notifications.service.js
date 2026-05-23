import * as repo from './notifications.repository.js';

export async function listNotifications(tenantId, userId, filters = {}) {
  const { page = 1, limit = 20, unreadOnly = false } = filters;
  const offset = (page - 1) * limit;
  const { notifications, total } = await repo.getNotifications(tenantId, userId, {
    limit,
    offset,
    unreadOnly,
  });
  return {
    notifications,
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
  return n;
}

export async function markAllRead(tenantId, userId) {
  await repo.markAllRead(tenantId, userId);
  return { success: true };
}
