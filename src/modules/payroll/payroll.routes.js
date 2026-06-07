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

  // ── Phase 3: Localization ───────────────────────────────────────────────────

  fastify.get('/payroll/countries', {
    schema: { tags: ['Payroll'], description: 'List supported payroll countries', security: [{ Bearer: [] }], response: { 200: obj } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getCountries);

  fastify.get('/payroll/countries/:code/bank-schema', {
    schema: {
      tags: ['Payroll'], description: 'Get bank account field schema for a country', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getBankSchema);

  fastify.get('/payroll/legal-entities', {
    schema: { tags: ['Payroll'], description: 'List legal entities', security: [{ Bearer: [] }], response: { 200: obj } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getLegalEntities);

  fastify.post('/payroll/legal-entities', {
    schema: {
      tags: ['Payroll'], description: 'Create legal entity', security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['name', 'country'],
        properties: {
          name: { type: 'string' }, country: { type: 'string' }, currency: { type: 'string' },
          fiscalYearStartMonth: { type: 'integer' }, timezone: { type: 'string' }, locale: { type: 'string' },
          registrationIds: { type: 'object', additionalProperties: true },
          statutoryPackId: { type: 'string' }, payCalendarId: { type: 'string' },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.createLegalEntity);

  fastify.patch('/payroll/legal-entities/:id', {
    schema: {
      tags: ['Payroll'], description: 'Update legal entity', security: [{ Bearer: [] }],
      params: idParam,
      body: { type: 'object', additionalProperties: true },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.updateLegalEntity);

  // ── Phase 3: Statutory Packs ────────────────────────────────────────────────

  fastify.get('/payroll/statutory-packs', {
    schema: {
      tags: ['Payroll'], description: 'List statutory packs', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { country: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getStatutoryPacks);

  fastify.get('/payroll/statutory-packs/:id', {
    schema: {
      tags: ['Payroll'], description: 'Get statutory pack by id', security: [{ Bearer: [] }],
      params: idParam, response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getStatutoryPack);

  fastify.post('/payroll/statutory-packs', {
    schema: {
      tags: ['Payroll'], description: 'Create statutory pack (SUPER_ADMIN)', security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['country', 'version', 'effectiveFrom', 'packData'],
        properties: {
          country: { type: 'string' }, version: { type: 'string' },
          effectiveFrom: { type: 'string' }, effectiveTo: { type: 'string' },
          packData: { type: 'object', additionalProperties: true },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.createStatutoryPack);

  fastify.patch('/payroll/statutory-packs/:id', {
    schema: {
      tags: ['Payroll'], description: 'Update statutory pack (SUPER_ADMIN)', security: [{ Bearer: [] }],
      params: idParam,
      body: { type: 'object', additionalProperties: true },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.updateStatutoryPack);

  // ── Phase 3: Employee Payroll ───────────────────────────────────────────────

  fastify.get('/payroll/employees/:id/ytd', {
    schema: {
      tags: ['Payroll'], description: 'Get year-to-date earnings summary for employee', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      querystring: { type: 'object', properties: { fy: { type: 'string', description: 'YYYY-YY fiscal year' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.getEmployeeYtd);

  fastify.get('/payroll/employees/:id/tax-declaration', {
    schema: {
      tags: ['Payroll'], description: 'Get tax declaration for employee', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      querystring: { type: 'object', properties: { fy: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.getTaxDeclaration);

  fastify.post('/payroll/employees/:id/tax-declaration', {
    schema: {
      tags: ['Payroll'], description: 'Create/replace tax declaration', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['fiscalYear'],
        properties: {
          fiscalYear: { type: 'string' }, regime: { type: 'string' },
          items: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.upsertTaxDeclaration);

  fastify.patch('/payroll/employees/:id/tax-declaration', {
    schema: {
      tags: ['Payroll'], description: 'Patch tax declaration (HR updates proofStatus)', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', additionalProperties: true },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.upsertTaxDeclaration);

  fastify.get('/payroll/employees/:id/loans', {
    schema: {
      tags: ['Payroll'], description: 'List loans for employee', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.getEmployeeLoans);

  fastify.post('/payroll/employees/:id/loans', {
    schema: {
      tags: ['Payroll'], description: 'Create loan for employee', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['amount', 'emiAmount', 'startPeriod'],
        properties: {
          amount: { type: 'number' }, emiAmount: { type: 'number' },
          startPeriod: { type: 'string' }, endPeriod: { type: 'string' },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.createEmployeeLoan);

  fastify.patch('/payroll/employees/:id/loans/:loanId', {
    schema: {
      tags: ['Payroll'], description: 'Update loan status/details', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id', 'loanId'], properties: { id: { type: 'string' }, loanId: { type: 'string' } } },
      body: { type: 'object', additionalProperties: true },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.updateEmployeeLoan);

  fastify.get('/payroll/employees/:id/opening-balances', {
    schema: {
      tags: ['Payroll'], description: 'Get YTD opening balance for employee', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getOpeningBalance);

  fastify.post('/payroll/employees/:id/opening-balances', {
    schema: {
      tags: ['Payroll'], description: 'Set opening balance for first-run accuracy', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['fiscalYear'],
        properties: {
          fiscalYear: { type: 'string' }, grossEarnings: { type: 'number' },
          taxableIncome: { type: 'number' }, taxDeducted: { type: 'number' },
          totalDeductions: { type: 'number' }, netPay: { type: 'number' },
          contributions: { type: 'object', additionalProperties: true },
        },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.upsertOpeningBalance);

  // ── Phase 3: Run Inputs ─────────────────────────────────────────────────────

  fastify.get('/payroll/roster', {
    schema: {
      tags: ['Payroll'], description: 'Employees eligible for payroll (have salary config)', security: [{ Bearer: [] }],
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getPayrollRoster);

  fastify.get('/payroll/runs/:runId/inputs', {
    schema: {
      tags: ['Payroll'], description: 'List per-employee inputs for a payroll run', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['runId'], properties: { runId: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getRunInputs);

  fastify.patch('/payroll/runs/:runId/inputs/:employeeId', {
    schema: {
      tags: ['Payroll'], description: 'Update a single employee payroll input', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['runId', 'employeeId'], properties: { runId: { type: 'string' }, employeeId: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          lopDays: { type: 'number' }, otHours: { type: 'number' }, variablePay: { type: 'number' },
          oneTimeAdditions: { type: 'array', items: { type: 'object', additionalProperties: true } },
          oneTimeDeductions: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.updateRunInput);

  fastify.post('/payroll/runs/:runId/inputs/import', {
    schema: {
      tags: ['Payroll'], description: 'Bulk-import run inputs from CSV', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['runId'], properties: { runId: { type: 'string' } } },
      body: { type: 'object', required: ['csv'], properties: { csv: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.importRunInputs);

  fastify.get('/payroll/runs/:id/fnf', {
    schema: {
      tags: ['Payroll'], description: 'Get full-and-final settlement for a run', security: [{ Bearer: [] }],
      params: idParam, response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getRunFnf);

  // ── Phase 3: Run Reports ────────────────────────────────────────────────────

  fastify.get('/payroll/runs/:id/statutory-return', {
    schema: {
      tags: ['Payroll'], description: 'Get statutory return for a run (ECR / 24Q / RTI)', security: [{ Bearer: [] }],
      params: idParam,
      querystring: { type: 'object', properties: { type: { type: 'string', enum: ['ECR', '24Q', 'RTI'] } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getStatutoryReturn);

  fastify.get('/payroll/runs/:id/register', {
    schema: {
      tags: ['Payroll'], description: 'Get payroll register for a run', security: [{ Bearer: [] }],
      params: idParam,
      querystring: { type: 'object', properties: { type: { type: 'string', enum: ['SALARY', 'STATUTORY', 'BANK_ADVICE', 'VARIANCE'] } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getRunRegister);

  fastify.get('/payroll/runs/:id/register/export', {
    schema: {
      tags: ['Payroll'], description: 'Export payroll register', security: [{ Bearer: [] }],
      params: idParam,
      querystring: { type: 'object', properties: { type: { type: 'string' } } },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.exportRunRegister);

  fastify.post('/payroll/runs/:id/parallel-reconcile', {
    schema: {
      tags: ['Payroll'], description: 'Parallel-run reconciliation against legacy figures', security: [{ Bearer: [] }],
      params: idParam,
      body: {
        type: 'object',
        required: ['legacy'],
        properties: {
          tolerance: { type: 'number' },
          legacy: { type: 'array', items: { type: 'object', properties: { employeeCode: { type: 'string' }, netPay: { type: 'number' } } } },
        },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.parallelReconcile);

  // ── Phase 3: Pay Calendars ──────────────────────────────────────────────────

  fastify.get('/payroll/pay-calendars', {
    schema: { tags: ['Payroll'], description: 'List pay calendars', security: [{ Bearer: [] }], response: { 200: obj } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getPayCalendars);

  fastify.post('/payroll/pay-calendars', {
    schema: {
      tags: ['Payroll'], description: 'Create pay calendar', security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['name', 'code'],
        properties: {
          name: { type: 'string' }, code: { type: 'string' }, country: { type: 'string' },
          paySchedule: { type: 'string', enum: ['MONTHLY', 'BIWEEKLY', 'WEEKLY'] },
          firstPayDate: { type: 'string' },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.createPayCalendar);

  fastify.patch('/payroll/pay-calendars/:id', {
    schema: {
      tags: ['Payroll'], description: 'Update pay calendar', security: [{ Bearer: [] }],
      params: idParam,
      body: { type: 'object', additionalProperties: true },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.updatePayCalendar);

  // ── Phase 3: Migration ──────────────────────────────────────────────────────

  fastify.get('/payroll/opening-balances', {
    schema: { tags: ['Payroll'], description: 'List all opening balances', security: [{ Bearer: [] }], response: { 200: obj } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getAllOpeningBalances);

  fastify.get('/payroll/migration/historical-payslips', {
    schema: { tags: ['Payroll'], description: 'List imported historical payslips', security: [{ Bearer: [] }], response: { 200: obj } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getHistoricalPayslips);

  fastify.post('/payroll/migration/historical-payslips', {
    schema: {
      tags: ['Payroll'], description: 'Bulk-import historical payslips', security: [{ Bearer: [] }],
      body: { type: 'object', required: ['rows'], properties: { rows: { type: 'array', items: { type: 'object', additionalProperties: true } } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.importHistoricalPayslips);

  fastify.get('/payroll/migration/status', {
    schema: { tags: ['Payroll'], description: 'Get migration status', security: [{ Bearer: [] }], response: { 200: obj } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getMigrationStatus);

  fastify.patch('/payroll/migration/status', {
    schema: {
      tags: ['Payroll'], description: 'Update migration status (sandbox/goLivePeriod)', security: [{ Bearer: [] }],
      body: { type: 'object', properties: { sandboxMode: { type: 'boolean' }, goLivePeriod: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.updateMigrationStatus);

  // ── Phase 3: Compliance Reports ─────────────────────────────────────────────

  fastify.get('/payroll/reports/pay-equity', {
    schema: {
      tags: ['Payroll'], description: 'Pay equity / gender-pay-gap analysis', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { groupBy: { type: 'string', enum: ['gender', 'level', 'location'] } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getPayEquity);

  fastify.get('/payroll/reports/audit-pack', {
    schema: {
      tags: ['Payroll'], description: 'Download audit assurance pack for a run', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { runId: { type: 'string' } } },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getAuditPack);

  fastify.get('/payroll/settings/data-policy', {
    schema: { tags: ['Payroll'], description: 'Get data residency & retention policy', security: [{ Bearer: [] }], response: { 200: obj } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getDataPolicy);

  fastify.patch('/payroll/settings/data-policy', {
    schema: {
      tags: ['Payroll'], description: 'Update data policy', security: [{ Bearer: [] }],
      body: { type: 'object', properties: { defaultRetentionYears: { type: 'integer' }, policies: { type: 'array', items: { type: 'object', additionalProperties: true } } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.updateDataPolicy);
}
