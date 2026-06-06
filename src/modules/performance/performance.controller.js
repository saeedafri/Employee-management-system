import { successResponse, errorResponse } from '../../utils/response.js';
import * as service from './performance.service.js';

export async function getActiveCycle(request, reply) {
  try {
    const data = await service.getActiveCycle(request.tenant.id);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function getSummary(request, reply) {
  try {
    const data = await service.getSummary(request.tenant.id);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function getReviews(request, reply) {
  try {
    const data = await service.getReviews(request.tenant.id, request.query);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function getGoals(request, reply) {
  try {
    const data = await service.getGoals(request.tenant.id, request.query);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function getCalibration(request, reply) {
  try {
    const data = await service.getCalibration(request.tenant.id);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function getEmployees(request, reply) {
  try {
    const employees = await service.getEmployees(request.tenant.id);
    return reply.send(successResponse({ employees }));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function updateReview(request, reply) {
  try {
    const review = await service.updateReview(
      request.tenant.id,
      request.params.employeeId,
      request.body,
    );
    return reply.send(successResponse(review));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function createGoal(request, reply) {
  try {
    const goal = await service.createGoal(request.tenant.id, request.body);
    return reply.code(201).send(successResponse(goal));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}
