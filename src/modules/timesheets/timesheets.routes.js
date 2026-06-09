import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as controller from './timesheets.controller.js';

// ─── Shared response schemas ───────────────────────────────────────────────────
const TimesheetEntry = {
  type: 'object',
  properties: {
    id:           { type: 'string' },
    timesheetId:  { type: 'string' },
    employeeId:   { type: 'string' },
    projectId:    { type: 'string' },
    taskId:       { type: 'string', nullable: true },
    date:         { type: 'string', format: 'date' },
    hours:        { type: 'number' },
    billable:     { type: 'boolean' },
    note:         { type: 'string', nullable: true },
    source:       { type: 'string', enum: ['MANUAL', 'TIMER'] },
  },
};

const Timesheet = {
  type: 'object',
  properties: {
    id:             { type: 'string' },
    employeeId:     { type: 'string' },
    employeeName:   { type: 'string', description: 'Full name of the employee (enriched from Employee table)' },
    weekStart:      { type: 'string', format: 'date' },
    weekEnd:        { type: 'string', format: 'date' },
    status:         { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] },
    totalHours:     { type: 'number' },
    billableHours:  { type: 'number' },
    overtimeHours:  { type: 'number' },
    standardHours:  { type: 'number' },
    submittedAt:    { type: 'string', format: 'date-time', nullable: true },
    decidedBy:      { type: 'string', nullable: true },
    decidedAt:      { type: 'string', format: 'date-time', nullable: true },
    comment:        { type: 'string', nullable: true },
    entries:        { type: 'array', items: TimesheetEntry },
  },
};

const TimesheetSummaryByEmployee = {
  type: 'object',
  properties: {
    employeeId:     { type: 'string' },
    employeeName:   { type: 'string' },
    hours:          { type: 'number', description: 'Total hours logged' },
    billableHours:  { type: 'number' },
    utilizationPct: { type: 'integer', description: 'Billable / total * 100' },
  },
};

const TimesheetSummaryByProject = {
  type: 'object',
  properties: {
    projectId:     { type: 'string' },
    projectName:   { type: 'string' },
    hours:         { type: 'number' },
    billableHours: { type: 'number' },
  },
};

const TimesheetSummary = {
  type: 'object',
  properties: {
    totalHours:      { type: 'number' },
    billableHours:   { type: 'number' },
    nonBillableHours:{ type: 'number' },
    utilizationPct:  { type: 'integer' },
    byProject:       { type: 'array', items: TimesheetSummaryByProject },
    byEmployee:      { type: 'array', items: TimesheetSummaryByEmployee },
  },
};

export default async function timesheetsRoutes(fastify) {
  const HR_ADMIN = ['HR_ADMIN', 'SUPER_ADMIN'];
  const HR_MANAGER = ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'];
  const ALL_AUTH = ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'];
  const obj = { type: 'object', additionalProperties: true };

  // ── Projects ──────────────────────────────────────────────────────────────

  fastify.get('/timesheets/projects', {
    schema: {
      tags: ['Timesheets'],
      summary: 'List timesheet projects (scoped by memberId)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: { memberId: { type: 'string', description: 'Employee id or "self"' } },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(ALL_AUTH)],
  }, controller.getProjects);

  fastify.post('/timesheets/projects', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Create a timesheet project',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['name', 'code'],
        properties: {
          name: { type: 'string' },
          code: { type: 'string' },
          clientName: { type: 'string' },
          billable: { type: 'boolean' },
          defaultRate: { type: 'number' },
          memberIds: { type: 'array', items: { type: 'string' } },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(HR_ADMIN)],
  }, controller.createProject);

  fastify.patch('/timesheets/projects/:id', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Update a timesheet project',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          code: { type: 'string' },
          clientName: { type: 'string' },
          billable: { type: 'boolean' },
          memberIds: { type: 'array', items: { type: 'string' } },
        },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(HR_ADMIN)],
  }, controller.updateProject);

  fastify.delete('/timesheets/projects/:id', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Archive (or delete) a timesheet project',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(HR_ADMIN)],
  }, controller.deleteProject);

  fastify.get('/timesheets/projects/:id/tasks', {
    schema: {
      tags: ['Timesheets'],
      summary: 'List tasks for a project',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(ALL_AUTH)],
  }, controller.getProjectTasks);

  fastify.post('/timesheets/projects/:id/tasks', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Create a task within a project',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          billable: { type: 'boolean' },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(HR_ADMIN)],
  }, controller.createTask);

  // ── Tasks (standalone update) ─────────────────────────────────────────────

  fastify.patch('/timesheets/tasks/:id', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Update a task',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          billable: { type: 'boolean' },
          active: { type: 'boolean' },
        },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(HR_ADMIN)],
  }, controller.updateTask);

  // ── Timesheet (weekly) ────────────────────────────────────────────────────

  fastify.get('/timesheets', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Get weekly timesheet for employee (creates draft if absent)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          week: { type: 'string', description: 'YYYY-MM-DD (Monday of week)' },
          employeeId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: Timesheet,
          },
        },
      },
    },
    onRequest: [authenticate, authorize(ALL_AUTH)],
  }, controller.getTimesheet);

  fastify.post('/timesheets/entries', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Create a time entry (attaches to weekly timesheet)',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['weekStart', 'projectId', 'date', 'hours'],
        properties: {
          weekStart: { type: 'string', description: 'YYYY-MM-DD (Monday)' },
          projectId: { type: 'string' },
          taskId: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          hours: { type: 'number', minimum: 0.25, maximum: 24 },
          billable: { type: 'boolean' },
          note: { type: 'string' },
          source: { type: 'string', enum: ['MANUAL', 'TIMER'] },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(ALL_AUTH)],
  }, controller.createEntry);

  fastify.patch('/timesheets/entries/:id', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Update a time entry',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          hours: { type: 'number' },
          billable: { type: 'boolean' },
          note: { type: 'string' },
          taskId: { type: 'string' },
        },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(ALL_AUTH)],
  }, controller.updateEntry);

  fastify.delete('/timesheets/entries/:id', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Delete a time entry',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(ALL_AUTH)],
  }, controller.deleteEntry);

  fastify.post('/timesheets/:id/submit', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Submit a timesheet for approval',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object' },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(ALL_AUTH)],
  }, controller.submitTimesheet);

  // ── Approvals ─────────────────────────────────────────────────────────────

  fastify.get('/timesheets/approvals', {
    schema: {
      tags: ['Timesheets'],
      summary: 'List timesheets pending approval (manager/HR queue). Each row includes employeeName.',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: { status: { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'], description: 'Default: SUBMITTED' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: Timesheet },
          },
        },
      },
    },
    onRequest: [authenticate, authorize(HR_MANAGER)],
  }, controller.getApprovals);

  fastify.post('/timesheets/:id/approve', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Approve a submitted timesheet',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: { comment: { type: 'string' } },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(HR_MANAGER)],
  }, controller.approveTimesheet);

  fastify.post('/timesheets/:id/reject', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Reject a submitted timesheet',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['comment'],
        properties: { comment: { type: 'string' } },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(HR_MANAGER)],
  }, controller.rejectTimesheet);

  // ── Summary & Settings ────────────────────────────────────────────────────

  fastify.get('/timesheets/summary', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Timesheet utilization summary — returns totalHours, billableHours, utilizationPct, byProject[], byEmployee[]',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['30d', '90d'], description: 'Lookback window (default 30d)' },
          employeeId: { type: 'string', description: 'Filter to specific employee (HR only)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: TimesheetSummary,
          },
        },
      },
    },
    onRequest: [authenticate, authorize(HR_MANAGER)],
  }, controller.getSummary);

  fastify.get('/timesheets/settings', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Get timesheet settings',
      security: [{ Bearer: [] }],
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(HR_ADMIN)],
  }, controller.getSettings);

  fastify.patch('/timesheets/settings', {
    schema: {
      tags: ['Timesheets'],
      summary: 'Update timesheet settings',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        properties: {
          standardWeeklyHours: { type: 'number' },
          overtimeThresholdHours: { type: 'number' },
          roundingMinutes: { type: 'integer' },
          approvalRequired: { type: 'boolean' },
          unloggedHoursPolicy: { type: 'string', enum: ['IGNORE', 'FLAG', 'DEDUCT'] },
          billableDefault: { type: 'boolean' },
        },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(HR_ADMIN)],
  }, controller.updateSettings);
}
