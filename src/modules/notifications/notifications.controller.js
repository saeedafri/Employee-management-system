import * as service from './notifications.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export async function listNotifications(request, reply) {
  const tenantId = request.tenant.id;
  const { sub: userId } = request.user;
  const { page, limit, unreadOnly } = request.query;

  const { since } = request.query;
  const result = await service.listNotifications(tenantId, userId, {
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 20,
    unreadOnly: unreadOnly === 'true' || unreadOnly === true,
    since: since || null,
  });

  return reply.send(successResponse(result));
}

export async function getUnreadCount(request, reply) {
  const tenantId = request.tenant.id;
  const { sub: userId } = request.user;
  const result = await service.getUnreadCount(tenantId, userId);
  return reply.send(successResponse(result));
}

export async function markRead(request, reply) {
  const tenantId = request.tenant.id;
  const { sub: userId } = request.user;
  const { id } = request.params;

  const n = await service.markRead(tenantId, userId, id);
  if (!n) return reply.status(404).send(errorResponse('NOT_FOUND', 'Notification not found'));
  return reply.send(successResponse(n));
}

export async function markAllRead(request, reply) {
  const tenantId = request.tenant.id;
  const { sub: userId } = request.user;
  const result = await service.markAllRead(tenantId, userId);
  return reply.send(successResponse(result));
}
