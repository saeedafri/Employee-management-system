import { successResponse, errorResponse } from '../../utils/response.js';
import * as service from './recruitment.service.js';
import { sendCsv } from '../../utils/csv.js';
import { openingsCsv, candidatesCsv, recruitmentFilename } from '../export/exportRows.js';

const EXPORT_LIMIT = 10000;

export async function getSummary(request, reply) {
  try {
    const data = await service.getSummary(request.tenant.id);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function getOpenings(request, reply) {
  try {
    const data = await service.getOpenings(request.tenant.id, request.query);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function createOpening(request, reply) {
  try {
    const opening = await service.createOpening(request.tenant.id, request.body);
    return reply.code(201).send(successResponse(opening));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function updateOpening(request, reply) {
  try {
    const opening = await service.updateOpening(request.tenant.id, request.params.id, request.body);
    return reply.send(successResponse(opening));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function getCandidates(request, reply) {
  try {
    const data = await service.getCandidates(request.tenant.id, request.query);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function advanceCandidate(request, reply) {
  try {
    const data = await service.advanceCandidate(request.tenant.id, request.params.id, request.body.stage);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function updateCandidateRating(request, reply) {
  try {
    const { rating } = request.body;
    const data = await service.updateCandidateRating(request.tenant.id, request.params.id, rating);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function getRecruiters(request, reply) {
  try {
    const recruiters = await service.getRecruiters(request.tenant.id);
    return reply.send(successResponse({ recruiters }));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

/**
 * BE-11 — GET /recruitment/export?type=openings|candidates
 *
 * `departmentId` from the request in the tracker is not supported: an opening
 * stores `department` as free text, not a FK, so there is no id to filter on.
 * `status` (openings) and `stage` / `openingId` (candidates) are.
 */
export async function exportRecruitment(request, reply) {
  try {
    const type = request.query?.type ?? 'openings';
    const tenantId = request.tenant.id;

    if (type === 'candidates') {
      const { candidates } = await service.getCandidates(tenantId, {
        ...request.query, limit: EXPORT_LIMIT,
      });
      return sendCsv(reply, recruitmentFilename('candidates'), candidatesCsv(candidates));
    }

    const { openings } = await service.getOpenings(tenantId, {
      ...request.query, limit: EXPORT_LIMIT,
    });
    return sendCsv(reply, recruitmentFilename('openings'), openingsCsv(openings));
  } catch (error) {
    request.log.error(error);
    return reply.status(error.statusCode || 500).send(
      errorResponse(error.code || 'INTERNAL_ERROR', error.message, {}, request.id),
    );
  }
}
