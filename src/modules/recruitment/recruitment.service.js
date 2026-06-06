import * as repo from './recruitment.repository.js';

const STAGE_ORDER = ['applied', 'screening', 'interview', 'offer', 'hired'];

export async function getSummary(tenantId) {
  return repo.getSummary(tenantId);
}

export async function getOpenings(tenantId, query) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const { openings, total } = await repo.getOpenings(tenantId, { page, limit, status: query.status });
  return {
    openings,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function createOpening(tenantId, data) {
  const { title, department, location, employmentType } = data;
  if (!title || !department || !location || !employmentType) {
    const err = new Error('title, department, location, employmentType are required');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 422;
    throw err;
  }
  return repo.createOpening(tenantId, { title, department, location, employmentType });
}

export async function updateOpening(tenantId, id, data) {
  const updated = await repo.updateOpening(tenantId, id, data);
  if (!updated) {
    const err = new Error('Job opening not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  return updated;
}

export async function getCandidates(tenantId, query) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 50;
  const { candidates, total } = await repo.getCandidates(tenantId, {
    page, limit, openingId: query.openingId, stage: query.stage,
  });
  return {
    candidates: candidates.map(c => ({ ...c, tag: c.openingId })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function advanceCandidate(tenantId, id) {
  const candidate = await repo.getCandidateById(tenantId, id);
  if (!candidate) {
    const err = new Error('Candidate not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  if (candidate.stage === 'hired') {
    const err = new Error('Candidate is already hired');
    err.code = 'ALREADY_HIRED';
    err.statusCode = 409;
    throw err;
  }
  const currentIdx = STAGE_ORDER.indexOf(candidate.stage);
  if (currentIdx === -1 || currentIdx === STAGE_ORDER.length - 1) {
    const err = new Error('Cannot advance beyond hired stage');
    err.code = 'INVALID_STAGE_TRANSITION';
    err.statusCode = 422;
    throw err;
  }
  const nextStage = STAGE_ORDER[currentIdx + 1];
  const updated = await repo.advanceCandidate(id, nextStage);
  return { id: updated.id, stage: updated.stage, daysInStage: updated.daysInStage };
}

export async function updateCandidateRating(tenantId, id, rating) {
  if (rating < 1 || rating > 5) {
    const err = new Error('Rating must be between 1 and 5');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 422;
    throw err;
  }
  const candidate = await repo.getCandidateById(tenantId, id);
  if (!candidate) {
    const err = new Error('Candidate not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  const updated = await repo.updateCandidateRating(id, rating);
  return { id: updated.id, rating: updated.rating };
}

export async function getRecruiters(tenantId) {
  return repo.getRecruiters(tenantId);
}
