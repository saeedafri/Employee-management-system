import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as controller from './recruitment.controller.js';

export default async function recruitmentRoutes(fastify) {
  const HR_MANAGER = ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'];
  const HR_ONLY = ['HR_ADMIN', 'SUPER_ADMIN'];

  fastify.get('/recruitment/summary', {
    schema: {
      tags: ['Recruitment'],
      summary: 'Recruitment pipeline summary',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_MANAGER)],
  }, controller.getSummary);

  fastify.get('/recruitment/openings', {
    schema: {
      tags: ['Recruitment'],
      summary: 'List job openings (paginated)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          status: { type: 'string', enum: ['Open', 'Closing', 'On hold', 'Closed'] },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_MANAGER)],
  }, controller.getOpenings);

  fastify.post('/recruitment/openings', {
    schema: {
      tags: ['Recruitment'],
      summary: 'Create a job opening',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['title', 'department', 'location', 'employmentType'],
        properties: {
          title: { type: 'string' },
          department: { type: 'string' },
          location: { type: 'string' },
          employmentType: { type: 'string', enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'] },
        },
      },
      response: { 201: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_ONLY)],
  }, controller.createOpening);

  fastify.patch('/recruitment/openings/:id', {
    schema: {
      tags: ['Recruitment'],
      summary: 'Update a job opening',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          department: { type: 'string' },
          location: { type: 'string' },
          employmentType: { type: 'string' },
          status: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_ONLY)],
  }, controller.updateOpening);

  fastify.get('/recruitment/candidates', {
    schema: {
      tags: ['Recruitment'],
      summary: 'List candidates (paginated)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 50 },
          openingId: { type: 'string' },
          stage: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_MANAGER)],
  }, controller.getCandidates);

  fastify.post('/recruitment/candidates/:id/advance', {
    schema: {
      tags: ['Recruitment'],
      summary: 'Advance candidate to next stage (HR_ADMIN, SUPER_ADMIN only)',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['stage'],
        properties: { stage: { type: 'string' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_ONLY)],
  }, controller.advanceCandidate);

  fastify.patch('/recruitment/candidates/:id/rating', {
    schema: {
      tags: ['Recruitment'],
      summary: 'Rate a candidate (1-5)',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['rating'],
        properties: { rating: { type: 'integer' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_MANAGER)],
  }, controller.updateCandidateRating);

  fastify.get('/recruitment/recruiters', {
    schema: {
      tags: ['Recruitment'],
      summary: 'List HR recruiters for this tenant',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_MANAGER)],
  }, controller.getRecruiters);
}
