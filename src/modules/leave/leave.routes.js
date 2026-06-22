import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as leaveController from './leave.controller.js';

export default async function leaveRoutes(fastify) {
  // ── Leave Types ──────────────────────────────────────────────────────────────

  fastify.get('/leave/types', {
    schema: {
      tags: ['Leave Management'],
      description: 'Get the leave-type catalog. Source of truth = the leave engine/policies: returns types with id===code (e.g. EL/SL/CL/CO) derived from active policies, so the self-service balance↔type join resolves. Falls back to legacy DB LeaveType rows only when no policies exist.',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, (request, reply) => leaveController.getLeaveTypes(request, reply));

  fastify.post('/leave/types', {
    schema: {
      tags: ['Leave Management'],
      description: '[DEPRECATED — legacy DB-row CRUD] Create a leave type. Leave types are now defined by policies/packs (manage via /leave/policies + /leave/assignments); rows created here do NOT appear in GET /leave/types once policies exist. Retained for back-compat only. HR_ADMIN / SUPER_ADMIN.',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['name', 'code'],
        properties: {
          name: { type: 'string' },
          code: { type: 'string' },
          annualAllowance: { type: 'integer', default: 0 },
          carryForwardAllowed: { type: 'boolean', default: false },
          isPaid: { type: 'boolean', default: true },
        },
      },
      response: { 201: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])],
  }, (request, reply) => leaveController.createLeaveType(request, reply));

  fastify.patch('/leave/types/:id', {
    schema: {
      tags: ['Leave Management'],
      description: '[DEPRECATED — legacy DB-row CRUD] Update a leave type by DB id. Catalog is policy-derived (manage via /leave/policies). Retained for back-compat only. HR_ADMIN / SUPER_ADMIN.',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          annualAllowance: { type: 'integer' },
          carryForwardAllowed: { type: 'boolean' },
          isPaid: { type: 'boolean' },
          isActive: { type: 'boolean' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])],
  }, (request, reply) => leaveController.updateLeaveType(request, reply));

  fastify.delete('/leave/types/:id', {
    schema: {
      tags: ['Leave Management'],
      description: '[DEPRECATED — legacy DB-row CRUD] Deactivate a leave type by DB id. Catalog is policy-derived (manage via /leave/policies). Retained for back-compat only. HR_ADMIN / SUPER_ADMIN.',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])],
  }, (request, reply) => leaveController.deleteLeaveType(request, reply));

  // ── Leave Requests ───────────────────────────────────────────────────────────

  fastify.post('/leave/requests', {
    schema: {
      tags: ['Leave Management'],
      description: 'Create a new leave request',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['leaveTypeId', 'startDate', 'endDate', 'reason'],
        properties: {
          leaveTypeId: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => leaveController.createLeaveRequest(request, reply));

  fastify.get('/leave/requests', {
    schema: {
      tags: ['Leave Management'],
      description: 'Get your leave requests with pagination and filters',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'DENIED', 'WITHDRAWN', 'CANCELLED'] },
          leaveTypeId: { type: 'string' },
          fromDate: { type: 'string' },
          toDate: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => leaveController.getLeaveRequests(request, reply));

  fastify.get('/leave/team/requests', {
    schema: {
      tags: ['Leave Management'],
      description: 'Get team leave requests (managers only). Add ?employeeId= to filter for one employee.',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'DENIED', 'WITHDRAWN', 'CANCELLED'] },
          employeeId: { type: 'string', description: 'Filter by specific employee — used on employee profile Leave tab' },
          fromDate: { type: 'string' },
          toDate: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => leaveController.getTeamLeaveRequests(request, reply));

  fastify.get('/leave/team/calendar', {
    schema: {
      tags: ['Leave Management'],
      description: 'Team calendar view — who is on leave in a given month (managers only)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', description: 'YYYY-MM, defaults to current month' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => leaveController.getTeamCalendar(request, reply));

  // ── Team coverage ────────────────────────────────────────────────────────────

  fastify.get('/leave/team/coverage', {
    schema: {
      tags: ['Leave Management'],
      description: 'Check team coverage for a given date — warns when on-leave count exceeds threshold',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        required: ['date'],
        properties: {
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'YYYY-MM-DD' },
          departmentId: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => leaveController.getTeamCoverage(request, reply));

  // ── Bulk actions ─────────────────────────────────────────────────────────────

  fastify.post('/leave/requests/bulk-approve', {
    schema: {
      tags: ['Leave Management'],
      description: 'Bulk approve multiple leave requests (managers only)',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
          comment: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => leaveController.bulkApproveLeave(request, reply));

  fastify.post('/leave/requests/bulk-deny', {
    schema: {
      tags: ['Leave Management'],
      description: 'Bulk deny multiple leave requests (managers only)',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
          comment: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => leaveController.bulkDenyLeave(request, reply));

  // UI-team canonical paths (slash-separated — same handlers)
  fastify.post('/leave/requests/bulk/approve', {
    schema: {
      tags: ['Leave Management'],
      description: 'Bulk approve leave requests — canonical path for UI team',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
          comment: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => leaveController.bulkApproveLeave(request, reply));

  fastify.post('/leave/requests/bulk/reject', {
    schema: {
      tags: ['Leave Management'],
      description: 'Bulk reject leave requests — canonical path for UI team',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
          comment: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => leaveController.bulkDenyLeave(request, reply));

  // ── Individual request actions ───────────────────────────────────────────────

  fastify.patch('/leave/requests/:id/approve', {
    schema: {
      tags: ['Leave Management'],
      description: 'Approve a leave request (managers only)',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', properties: { approverComment: { type: 'string' } } },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => leaveController.approveLeaveRequest(request, reply));

  fastify.patch('/leave/requests/:id/reject', {
    schema: {
      tags: ['Leave Management'],
      description: 'Reject a leave request (managers only)',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['approverComment'], properties: { approverComment: { type: 'string' } } },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => leaveController.rejectLeaveRequest(request, reply));

  fastify.patch('/leave/requests/:id/withdraw', {
    schema: {
      tags: ['Leave Management'],
      description: 'Withdraw your pending leave request',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    onRequest: [authenticate],
  }, (request, reply) => leaveController.withdrawLeaveRequest(request, reply));

  // ── Balance ──────────────────────────────────────────────────────────────────

  fastify.get('/leave/balance', {
    schema: {
      tags: ['Leave Management'],
      description: 'Get your leave balance',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, (request, reply) => leaveController.getLeaveBalance(request, reply));

  fastify.get('/leave/balance/me', {
    schema: {
      tags: ['Leave Management'],
      description: 'Get your leave balance (alias for /leave/balance — used by employee dashboard)',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, (request, reply) => leaveController.getLeaveBalance(request, reply));
}
