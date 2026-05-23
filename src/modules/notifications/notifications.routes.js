import { authenticate } from '../../middleware/authenticate.js';
import { verifyToken } from '../../utils/token.js';
import { addClient, removeClient } from '../../utils/sseClients.js';
import * as controller from './notifications.controller.js';

export default async function notificationsRoutes(fastify) {
  fastify.get('/notifications', {
    schema: {
      tags: ['Notifications'],
      description: 'List notifications for the current user (newest first, expired excluded)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          unreadOnly: { type: 'boolean', default: false },
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

  fastify.patch('/notifications/:id/read', {
    schema: {
      tags: ['Notifications'],
      description: 'Mark a single notification as read',
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, controller.markRead);

  fastify.patch('/notifications/read-all', {
    schema: {
      tags: ['Notifications'],
      description: 'Mark all notifications as read',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, controller.markAllRead);

  // SSE endpoint — EventSource in browser cannot send custom headers,
  // so token is accepted as a query param.
  fastify.get('/notifications/stream', {
    schema: {
      tags: ['Notifications'],
      description: 'Server-Sent Events stream for real-time notifications and analytics refresh. Pass accessToken as query param.',
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
      'X-Accel-Buffering': 'no', // disable nginx buffering on Render
    });

    reply.raw.write(': connected\n\n');

    addClient(userId, reply);

    // Heartbeat to keep connection alive through proxies / Render idle timeout
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

    // Keep Fastify from auto-closing the response
    await new Promise(() => {});
  });
}
