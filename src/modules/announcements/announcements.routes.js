import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as controller from './announcements.controller.js';

export default async function announcementsRoutes(fastify) {
  const HR_MANAGER = ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'];
  const HR_ONLY = ['HR_ADMIN', 'SUPER_ADMIN'];

  fastify.get('/announcements', {
    schema: {
      tags: ['Announcements'],
      summary: 'List announcements feed with pinned item',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          channelId: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, controller.getAnnouncements);

  fastify.get('/announcements/channels', {
    schema: {
      tags: ['Announcements'],
      summary: 'List announcement channels',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, controller.getChannels);

  fastify.get('/announcements/events', {
    schema: {
      tags: ['Announcements'],
      summary: 'List upcoming events',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, controller.getEvents);

  fastify.post('/announcements/events', {
    schema: {
      tags: ['Announcements'],
      summary: 'Create an event',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['date', 'title', 'meta'],
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          title: { type: 'string' },
          meta: { type: 'string' },
        },
      },
      response: { 201: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_ONLY)],
  }, controller.createEvent);

  fastify.post('/announcements', {
    schema: {
      tags: ['Announcements'],
      summary: 'Post an announcement',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['title', 'body', 'category'],
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          category: { type: 'string' },
          channelId: { type: 'string' },
          audience: { type: 'string' },
          isPinned: { type: 'boolean' },
          authorName: { type: 'string' },
          authorRole: { type: 'string' },
        },
      },
      response: { 201: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_MANAGER)],
  }, controller.createAnnouncement);

  fastify.patch('/announcements/:id/pin', {
    schema: {
      tags: ['Announcements'],
      summary: 'Pin an announcement (demotes existing pinned)',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_ONLY)],
  }, controller.pinAnnouncement);

  fastify.patch('/announcements/:id/unpin', {
    schema: {
      tags: ['Announcements'],
      summary: 'Unpin an announcement',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_ONLY)],
  }, controller.unpinAnnouncement);
}
