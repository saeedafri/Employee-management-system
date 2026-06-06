import { successResponse, errorResponse } from '../../utils/response.js';
import * as service from './announcements.service.js';

export async function getAnnouncements(request, reply) {
  try {
    const data = await service.getAnnouncements(request.tenant.id, request.query);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function getChannels(request, reply) {
  try {
    const channels = await service.getChannels(request.tenant.id);
    return reply.send(successResponse({ channels }));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function getEvents(request, reply) {
  try {
    const events = await service.getEvents(request.tenant.id);
    return reply.send(successResponse({ events }));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function createEvent(request, reply) {
  try {
    const event = await service.createEvent(request.tenant.id, request.body);
    return reply.code(201).send(successResponse(event));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function createAnnouncement(request, reply) {
  try {
    const ann = await service.createAnnouncement(
      request.tenant.id,
      request.user.memberType,
      request.body,
    );
    return reply.code(201).send(successResponse(ann));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function pinAnnouncement(request, reply) {
  try {
    const ann = await service.pinAnnouncement(request.tenant.id, request.params.id);
    return reply.send(successResponse(ann));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function unpinAnnouncement(request, reply) {
  try {
    const result = await service.unpinAnnouncement(request.tenant.id, request.params.id);
    return reply.send(successResponse(result));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}
