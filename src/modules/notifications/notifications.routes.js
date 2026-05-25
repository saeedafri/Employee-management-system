import { authenticate } from '../../middleware/authenticate.js';
import { verifyToken } from '../../utils/token.js';
import { addClient, removeClient } from '../../utils/sseClients.js';
import * as controller from './notifications.controller.js';

export default async function notificationsRoutes(fastify) {
  fastify.get('/notifications', {
    schema: {
      tags: ['Notifications'],
      description: 'List notifications for the current user (newest first, expired excluded). Supports ?since=ISO for poll-based updates.',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          unreadOnly: { type: 'boolean', default: false },
          since: { type: 'string', description: 'ISO timestamp — return only notifications created after this time' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, controller.listNotifications);

  fastify.get('/notifications/unread-count', {
    schema: {
      tags: ['Notifications'],
      description: 'Get unread notification count (for bell icon badge)',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, controller.getUnreadCount);

  // PATCH (original) + POST alias (UI team uses POST)
  fastify.patch('/notifications/:id/read', {
    schema: {
      tags: ['Notifications'],
      description: 'Mark a single notification as read (PATCH)',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, controller.markRead);

  fastify.post('/notifications/:id/read', {
    schema: {
      tags: ['Notifications'],
      description: 'Mark a single notification as read (POST alias)',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, controller.markRead);

  // PATCH (original) + POST alias
  fastify.patch('/notifications/read-all', {
    schema: {
      tags: ['Notifications'],
      description: 'Mark all notifications as read (PATCH)',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, controller.markAllRead);

  fastify.post('/notifications/read-all', {
    schema: {
      tags: ['Notifications'],
      description: 'Mark all notifications as read (POST alias)',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, controller.markAllRead);

  // SSE endpoint
  fastify.get('/notifications/stream', {
    schema: {
      tags: ['Notifications'],
      description: 'Server-Sent Events stream for real-time notifications. Pass accessToken as query param.',
      querystring: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'Access token (Bearer without the word Bearer)' },
        },
      },
    },
  }, async (request, reply) => {
    const rawToken = request.query.token || request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || '';
    if (!rawToken) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Missing token' });
    }

    let userId;
    try {
      const payload = await verifyToken(rawToken);
      userId = payload.sub;
    } catch {
      return reply.status(401).send({ error: 'INVALID_TOKEN', message: 'Token invalid or expired' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    reply.raw.write(': connected\n\n');

    addClient(userId, reply);

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 25000);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      removeClient(userId, reply);
    });

    await new Promise(() => {});
  });
}
