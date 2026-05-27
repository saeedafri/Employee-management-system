import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as ctrl from './payroll.controller.js';

const adminRoles = ['HR_ADMIN', 'SUPER_ADMIN'];
const superOnly = ['SUPER_ADMIN'];
const allAuth = ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'];
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };
const obj = { type: 'object', additionalProperties: true };

export default async function payrollRoutes(fastify) {
  // ── Salary Components ───────────────────────────────────────────────────────
  fastify.get('/payroll/components', {
    schema: {
      tags: ['Payroll'], description: 'List salary components', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { active: { type: 'string', enum: ['true', 'false'] } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getComponents);

  fastify.post('/payroll/components', {
    schema: {
      tags: ['Payroll'], description: 'Create salary component', security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['name', 'code', 'type', 'calculationType', 'taxable'],
        properties: {
          name: { type: 'string', maxLength: 100 },
          code: { type: 'string', maxLength: 30 },
          type: { type: 'string', enum: ['EARNING', 'DEDUCTION', 'BENEFIT', 'REIMBURSEMENT'] },
          calculationType: { type: 'string', enum: ['FLAT', 'PERCENTAGE', 'FORMULA'] },
          value: { type: 'number' },
          basisCode: { type: 'string' },
          formula: { type: 'string' },
          taxable: { type: 'boolean' },
          active: { type: 'boolean' },
          displayOrder: { type: 'integer' },
          description: { type: 'string', maxLength: 500 },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.createComponent);

  fastify.patch('/payroll/components/:id', {
    schema: {
      tags: ['Payroll'], description: 'Update salary component (code is immutable)', security: [{ Bearer: [] }],
      params: idParam,
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' }, type: { type: 'string' }, calculationType: { type: 'string' },
          value: { type: 'number' }, basisCode: { type: 'string' }, formula: { type: 'string' },
          taxable: { type: 'boolean' }, active: { type: 'boolean' }, displayOrder: { type: 'integer' },
          description: { type: 'string' },
        },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.updateComponent);

  fastify.delete('/payroll/components/:id', {
    schema: {
      tags: ['Payroll'], description: 'Delete salary component (SUPER_ADMIN only)', security: [{ Bearer: [] }],
      params: idParam, response: { 200: obj },
    },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.deleteComponent);

  // ── Pay Groups ──────────────────────────────────────────────────────────────
  fastify.get('/payroll/groups', {
    schema: { tags: ['Payroll'], description: 'List pay groups with components', security: [{ Bearer: [] }], response: { 200: obj } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getPayGroups);

  fastify.post('/payroll/groups', {
    schema: {
      tags: ['Payroll'], description: 'Create pay group', security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['name', 'code'],
        properties: {
          name: { type: 'string' }, code: { type: 'string' }, currency: { type: 'string' },
          paySchedule: { type: 'string', enum: ['MONTHLY', 'BIWEEKLY', 'WEEKLY'] },
          description: { type: 'string' }, active: { type: 'boolean' },
          components: {
            type: 'array',
            items: {
              type: 'object',
              required: ['componentId'],
              properties: {
                componentId: { type: 'string' },
                overrideCalculationType: { type: 'string' },
                overrideValue: { type: 'number' },
                overrideFormula: { type: 'string' },
              },
            },
          },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.createPayGroup);

  fastify.patch('/payroll/groups/:id', {
    schema: {
      tags: ['Payroll'], description: 'Update pay group (code is immutable)', security: [{ Bearer: [] }],
      params: idParam,
      body: { type: 'object', additionalProperties: true },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.updatePayGroup);

  fastify.delete('/payroll/groups/:id', {
    schema: {
      tags: ['Payroll'], description: 'Delete pay group (SUPER_ADMIN only)', security: [{ Bearer: [] }],
      params: idParam, response: { 200: obj },
    },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.deletePayGroup);

  fastify.get('/payroll/schedules', {
    schema: { tags: ['Payroll'], description: 'List non-monthly pay schedules', security: [{ Bearer: [] }], response: { 200: obj } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getPaySchedules);

  // ── Employee Salary ─────────────────────────────────────────────────────────
  fastify.get('/payroll/employees/:employeeId/salary', {
    schema: {
      tags: ['Payroll'], description: 'Get employee salary config. HR sees full bank details; EMPLOYEE sees own masked.', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['employeeId'], properties: { employeeId: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.getEmployeeSalary);

  fastify.post('/payroll/employees/:employeeId/salary', {
    schema: {
      tags: ['Payroll'], description: 'Set employee salary (creates new record, closes old)', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['employeeId'], properties: { employeeId: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['payGroupId', 'annualCtc', 'effectiveFrom'],
        properties: {
          payGroupId: { type: 'string' }, annualCtc: { type: 'number' },
          effectiveFrom: { type: 'string', description: 'YYYY-MM-DD' },
          bankAccountName: { type: 'string' }, bankAccountNumber: { type: 'string' },
          bankIfscCode: { type: 'string' }, bankName: { type: 'string' },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.setEmployeeSalary);

  fastify.patch('/payroll/employees/:employeeId/salary', {
    schema: {
      tags: ['Payroll'], description: 'Update employee salary (creates new history record)', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['employeeId'], properties: { employeeId: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          payGroupId: { type: 'string' }, annualCtc: { type: 'number' },
          effectiveFrom: { type: 'string' }, bankAccountName: { type: 'string' },
          bankAccountNumber: { type: 'string' }, bankIfscCode: { type: 'string' },
          bankName: { type: 'string' },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.setEmployeeSalary);

  // ── Employee Payslips ───────────────────────────────────────────────────────
  fastify.get('/payroll/employees/:employeeId/payslips', {
    schema: {
      tags: ['Payroll'], description: 'List employee payslips. HR sees any; EMPLOYEE sees own.', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['employeeId'], properties: { employeeId: { type: 'string' } } },
      querystring: {
        type: 'object',
        properties: { page: { type: 'integer', default: 1 }, limit: { type: 'integer', default: 12 }, year: { type: 'string' } },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.getEmployeePayslips);

  fastify.get('/payroll/employees/:employeeId/payslips/:payslipId', {
    schema: {
      tags: ['Payroll'], description: 'Get payslip detail', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['employeeId', 'payslipId'], properties: { employeeId: { type: 'string' }, payslipId: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.getEmployeePayslip);

  // ── Payroll Runs ────────────────────────────────────────────────────────────
  fastify.get('/payroll/runs', {
    schema: {
      tags: ['Payroll'], description: 'List payroll runs', security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 }, limit: { type: 'integer', default: 10 },
          year: { type: 'string' }, status: { type: 'string', enum: ['DRAFT', 'CALCULATING', 'REVIEW', 'APPROVED', 'PAID', 'CANCELLED'] },
        },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getPayrollRuns);

  fastify.post('/payroll/runs', {
    schema: {
      tags: ['Payroll'], description: 'Initiate a new payroll run', security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['period'],
        properties: {
          period: { type: 'string', description: 'YYYY-MM', pattern: '^\\d{4}-\\d{2}$' },
          includeAllActiveEmployees: { type: 'boolean', default: true },
          payGroupIds: { type: 'array', items: { type: 'string' } },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.createPayrollRun);

  fastify.get('/payroll/runs/:id', {
    schema: {
      tags: ['Payroll'], description: 'Get payroll run with summary', security: [{ Bearer: [] }],
      params: idParam, response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getPayrollRun);

  fastify.post('/payroll/runs/:id/calculate', {
    schema: {
      tags: ['Payroll'], description: 'Trigger payroll calculation (DRAFT → REVIEW)', security: [{ Bearer: [] }],
      params: idParam, body: { type: 'object' }, response: { 202: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.calculatePayrollRun);

  fastify.post('/payroll/runs/:id/approve', {
    schema: {
      tags: ['Payroll'], description: 'Approve payroll run (REVIEW → APPROVED)', security: [{ Bearer: [] }],
      params: idParam,
      body: { type: 'object', properties: { notes: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.approvePayrollRun);

  fastify.patch('/payroll/runs/:id/mark-paid', {
    schema: {
      tags: ['Payroll'], description: 'Mark payroll run as PAID (APPROVED → PAID)', security: [{ Bearer: [] }],
      params: idParam,
      body: { type: 'object', properties: { paidAt: { type: 'string' }, paymentReference: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.markRunPaid);

  fastify.post('/payroll/runs/:id/cancel', {
    schema: {
      tags: ['Payroll'], description: 'Cancel a payroll run (SUPER_ADMIN only)', security: [{ Bearer: [] }],
      params: idParam,
      body: { type: 'object', properties: { reason: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.cancelPayrollRun);

  // ── Run Payslips ────────────────────────────────────────────────────────────
  fastify.get('/payroll/runs/:runId/payslips', {
    schema: {
      tags: ['Payroll'], description: 'List payslips within a run', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['runId'], properties: { runId: { type: 'string' } } },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 }, limit: { type: 'integer', default: 20 },
          departmentId: { type: 'string' }, search: { type: 'string' },
        },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getRunPayslips);

  fastify.get('/payroll/runs/:runId/payslips/:payslipId', {
    schema: {
      tags: ['Payroll'], description: 'Get payslip detail within a run', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['runId', 'payslipId'], properties: { runId: { type: 'string' }, payslipId: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getRunPayslip);

  fastify.patch('/payroll/runs/:runId/payslips/:payslipId', {
    schema: {
      tags: ['Payroll'], description: 'Add one-time adjustments to a payslip', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['runId', 'payslipId'], properties: { runId: { type: 'string' }, payslipId: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          oneTimeAdditions: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, amount: { type: 'number' } } } },
          oneTimeDeductions: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, amount: { type: 'number' } } } },
          notes: { type: 'string' },
        },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.updateRunPayslip);

  fastify.get('/payroll/runs/:runId/export', {
    schema: {
      tags: ['Payroll'], description: 'Export payroll register as CSV', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['runId'], properties: { runId: { type: 'string' } } },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.exportRunPayslips);
}
