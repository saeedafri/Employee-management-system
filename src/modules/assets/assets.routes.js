import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../auth/auth.policy.js';
import * as controller from './assets.controller.js';

export default async function assetsRoutes(fastify) {
  const canManageAssets = requirePermission('assets:manage');

  fastify.get('/assets/summary', {
    schema: {
      tags: ['Assets'],
      summary: 'Asset inventory summary',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canManageAssets],
  }, controller.getSummary);

  // NOTE: /assets/requests and /assets/employees must come BEFORE /assets/:id
  fastify.get('/assets/requests', {
    schema: {
      tags: ['Assets'],
      summary: 'List asset requests (paginated)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          status: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canManageAssets],
  }, controller.getRequests);

  fastify.get('/assets/employees', {
    schema: {
      tags: ['Assets'],
      summary: 'List employees for asset assignment',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canManageAssets],
  }, controller.getEmployees);

  fastify.get('/assets', {
    schema: {
      tags: ['Assets'],
      summary: 'List assets (paginated)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          type: { type: 'string', enum: ['Laptop', 'Monitor', 'Phone', 'Other'] },
          status: { type: 'string', enum: ['Assigned', 'Available', 'Repair', 'Retired'] },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canManageAssets],
  }, controller.getAssets);

  fastify.post('/assets', {
    schema: {
      tags: ['Assets'],
      summary: 'Add a new asset',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['tag', 'name', 'type'],
        properties: {
          tag: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['Laptop', 'Monitor', 'Phone', 'Other'] },
          assignedTo: {
            type: 'object',
            properties: {
              employeeId: { type: 'string' },
              name: { type: 'string' },
            },
          },
          assignedSince: { type: 'string', description: 'YYYY-MM-DD' },
        },
      },
      response: { 201: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canManageAssets],
  }, controller.createAsset);

  fastify.patch('/assets/requests/:id/approve', {
    schema: {
      tags: ['Assets'],
      summary: 'Approve an asset request',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canManageAssets],
  }, controller.approveRequest);

  fastify.patch('/assets/requests/:id/decline', {
    schema: {
      tags: ['Assets'],
      summary: 'Decline an asset request',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: { reason: { type: 'string' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canManageAssets],
  }, controller.declineRequest);

  fastify.patch('/assets/:id/status', {
    schema: {
      tags: ['Assets'],
      summary: 'Change asset status (Available | Repair | Retired)',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', enum: ['Available', 'Repair', 'Retired'] } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canManageAssets],
  }, controller.updateAssetStatus);

  fastify.patch('/assets/:id/assign', {
    schema: {
      tags: ['Assets'],
      summary: 'Assign asset to an employee',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['employeeId', 'name'],
        properties: {
          employeeId: { type: 'string' },
          name: { type: 'string' },
          since: { type: 'string', description: 'YYYY-MM-DD' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canManageAssets],
  }, controller.assignAsset);

  fastify.patch('/assets/:id/recall', {
    schema: {
      tags: ['Assets'],
      summary: 'Recall asset from employee',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canManageAssets],
  }, controller.recallAsset);

  // BACKEND_CONTRACT_server_side_exports.md §2.4
  fastify.get('/assets/export', {
    schema: {
      tags: ['Assets'],
      summary: 'Export the asset inventory as CSV',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: { type: { type: 'string' }, status: { type: 'string' } },
      },
    },
    onRequest: [authenticate, requirePermission('assets:export')],
  }, controller.exportAssets);
}
