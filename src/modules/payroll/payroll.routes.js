import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as ctrl from './payroll.controller.js';

const adminRoles = ['HR_ADMIN', 'SUPER_ADMIN'];
const superOnly = ['SUPER_ADMIN'];
const allAuth = ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'];
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };
const obj = { type: 'object', additionalProperties: true };

// ─── Explicit Phase 3 register schemas ──────────────────────────────────────
const RegisterColumn = {
  type: 'object',
  properties: {
    key:   { type: 'string' },
    label: { type: 'string' },
    align: { type: 'string', enum: ['left', 'right'] },
    kind:  { type: 'string', enum: ['text', 'money', 'number'] },
  },
};

const SummaryItem = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    value: { type: 'string' },
  },
};

const PayrollComponent = {
  type: 'object',
  properties: {
    id:              { type: 'string' },
    name:            { type: 'string' },
    code:            { type: 'string' },
    type:            { type: 'string', enum: ['EARNING', 'DEDUCTION', 'BENEFIT', 'REIMBURSEMENT', 'EMPLOYER_CONTRIBUTION', 'VARIABLE'] },
    calculationType: { type: 'string', enum: ['FLAT', 'PERCENTAGE', 'FORMULA'] },
    value:           { type: 'number', nullable: true },
    basisCode:       { type: 'string', nullable: true },
    formula:         { type: 'string', nullable: true },
    taxable:         { type: 'boolean' },
    active:          { type: 'boolean' },
    displayOrder:    { type: 'integer' },
    description:     { type: 'string', nullable: true },
    color:           { type: 'string', description: 'UI badge color (hex or tailwind class)' },
    amount:          { type: 'number', nullable: true, description: 'Normalized monthly amount alias for UI' },
    statutoryTag:    { type: 'string', nullable: true, description: 'e.g. PF_EMPLOYEE, ESI, TDS — links component to statutory deduction bucket' },
    prorate:         { type: 'boolean', description: 'Whether to pro-rate for mid-month joiners/exits' },
    payInPeriods:    { type: 'array', nullable: true, items: { type: 'integer' }, description: 'Which months to pay (null = all months)' },
    createdAt:       { type: 'string', format: 'date-time' },
    updatedAt:       { type: 'string', format: 'date-time' },
    glAccountCode:   { type: 'string', nullable: true, description: 'GL ledger account code for accounting integration' },
    costCenterRule:  { type: 'string', enum: ['DEPARTMENT', 'NONE'], description: 'How to allocate cost: DEPARTMENT maps to employee dept, NONE uses default center' },
  },
};

const PayrollRegister = {
  type: 'object',
  properties: {
    register:        { type: 'string', enum: ['SALARY', 'STATUTORY', 'BANK_ADVICE', 'VARIANCE'], description: 'Register type rendered' },
    runId:           { type: 'string' },
    period:          { type: 'string', example: '2026-05' },
    periodLabel:     { type: 'string', example: 'May 2026' },
    currency:        { type: 'string', example: 'INR' },
    columns:         { type: 'array', items: RegisterColumn },
    rows:            {
      type: 'array',
      description: 'Row shape varies by register type. SALARY rows include department + employerCost; STATUTORY rows include pfEmployee + pfEmployer; BANK_ADVICE rows include bankName + accountNumber; VARIANCE rows include previousNet + currentNet + variance.',
      items: {
        type: 'object',
        properties: {
          employeeCode:    { type: 'string' },
          employeeName:    { type: 'string' },
          department:      { type: 'string', description: 'SALARY only' },
          grossEarnings:   { type: 'number', description: 'SALARY/STATUTORY' },
          totalDeductions: { type: 'number', description: 'SALARY/STATUTORY' },
          netPay:          { type: 'number' },
          employerCost:    { type: 'number', description: 'SALARY only — grossEarnings × 1.13' },
          pfEmployee:      { type: 'number', description: 'STATUTORY only' },
          pfEmployer:      { type: 'number', description: 'STATUTORY only' },
          bankName:        { type: 'string', description: 'BANK_ADVICE only' },
          accountNumber:   { type: 'string', description: 'BANK_ADVICE only' },
          previousNet:     { type: 'number', description: 'VARIANCE only' },
          currentNet:      { type: 'number', description: 'VARIANCE only' },
          variance:        { type: 'number', description: 'VARIANCE only' },
        },
      },
    },
    summary:         { type: 'array', items: SummaryItem },
    totalEmployerCost: { type: 'number', description: 'Sum of all employerCost values (SALARY register)' },
  },
};

export default async function payrollRoutes(fastify) {
  // ── Salary Components ───────────────────────────────────────────────────────
  fastify.get('/payroll/components', {
    schema: {
      tags: ['Payroll'],
      description: 'List salary components. Each item includes statutoryTag, prorate, payInPeriods, glAccountCode, costCenterRule.',
      security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { active: { type: 'string', enum: ['true', 'false'] } } },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: PayrollComponent },
          },
        },
      },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getComponents);

  fastify.post('/payroll/components', {
    schema: {
      tags: ['Payroll'], description: 'Create salary component. Optional fields: statutoryTag, prorate, payInPeriods, glAccountCode, costCenterRule.', security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['name', 'code', 'type', 'calculationType', 'taxable'],
        properties: {
          name: { type: 'string', maxLength: 100 },
          code: { type: 'string', maxLength: 30 },
          type: { type: 'string', enum: ['EARNING', 'DEDUCTION', 'BENEFIT', 'REIMBURSEMENT', 'EMPLOYER_CONTRIBUTION', 'VARIABLE'] },
          calculationType: { type: 'string', enum: ['FLAT', 'PERCENTAGE', 'FORMULA'] },
          value: { type: 'number' },
          basisCode: { type: 'string' },
          formula: { type: 'string' },
          taxable: { type: 'boolean' },
          active: { type: 'boolean' },
          displayOrder: { type: 'integer' },
          description: { type: 'string', maxLength: 500 },
          statutoryTag: { type: 'string', description: 'e.g. PF_EMPLOYEE, ESI, TDS' },
          prorate: { type: 'boolean', description: 'Pro-rate for mid-month joins/exits (default true)' },
          payInPeriods: { type: 'array', nullable: true, items: { type: 'integer' }, description: 'Which months to pay (null = all)' },
          glAccountCode: { type: 'string', description: 'GL account code for accounting integration' },
          costCenterRule: { type: 'string', enum: ['DEPARTMENT', 'NONE'], description: 'Cost center allocation rule (default NONE)' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: PayrollComponent,
          },
        },
      },
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
          statutoryTag: { type: 'string', nullable: true },
          prorate: { type: 'boolean' },
          payInPeriods: { type: 'array', nullable: true, items: { type: 'integer' } },
          glAccountCode: { type: 'string', nullable: true },
          costCenterRule: { type: 'string', enum: ['DEPARTMENT', 'NONE'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: PayrollComponent },
        },
      },
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

  // ── Payroll Employees (list) ────────────────────────────────────────────────
  fastify.get('/payroll/employees', {
    schema: {
      tags: ['Payroll'],
      description: 'List employees with payroll assignment summary for admin payroll screens',
      security: [{ Bearer: [] }],
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getPayrollEmployees);

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
          country: { type: 'string', description: 'ISO 3166-1 alpha-2. Derived from legalEntityId when provided.' },
          currency: { type: 'string', description: 'ISO 4217. Derived from legalEntityId when provided.' },
          legalEntityId: { type: 'string', description: 'Legal entity. When set, country/currency are derived from it.' },
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
          effectiveFrom: { type: 'string' },
          country: { type: 'string' }, currency: { type: 'string' }, legalEntityId: { type: 'string' },
          bankAccountName: { type: 'string' },
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
      tags: ['Payroll'], description: 'Initiate payroll run (REGULAR|OFF_CYCLE|BONUS|ARREARS|FNF|REVERSAL)', security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['period'],
        properties: {
          period: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
          type: { type: 'string', description: 'REGULAR | OFF_CYCLE | BONUS | ARREARS | FNF | REVERSAL' },
          employeeIds: { type: 'array', items: { type: 'string' } },
          fnf: { type: 'object', additionalProperties: true },
          reversalOfRunId: { type: 'string' },
          includeAllActiveEmployees: { type: 'boolean' },
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
      params: idParam, body: { type: 'object', additionalProperties: true }, response: { 202: obj },
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
      tags: ['Payroll'], description: 'Cancel a payroll run. HR_ADMIN can cancel DRAFT/REVIEW/APPROVED runs. SUPER_ADMIN can cancel any non-PAID run.', security: [{ Bearer: [] }],
      params: idParam,
      body: { type: 'object', properties: { reason: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
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
          active: { type: 'boolean', description: 'Entity status for UI badges (default true)' },
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
      tags: ['Payroll'], description: 'Create statutory pack — flat body same as GET (SUPER_ADMIN)', security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['country', 'version', 'effectiveFrom'],
        properties: {
          country: { type: 'string' }, version: { type: 'string' },
          effectiveFrom: { type: 'string' }, effectiveTo: { type: 'string', nullable: true },
          rounding: { type: 'object', additionalProperties: true },
          proration: { type: 'object', additionalProperties: true },
          taxRegimes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          contributionSchemes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          localTaxes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          statutoryComponents: {
            type: 'array',
            description: 'Component codes (string[]). Legacy { code } objects accepted and normalized on write.',
            items: {
              oneOf: [
                { type: 'string' },
                { type: 'object', required: ['code'], properties: { code: { type: 'string' } }, additionalProperties: true },
              ],
            },
          },
          minimumWages: { type: 'array', items: { type: 'object', additionalProperties: true } },
          gratuity: { type: 'object', nullable: true, additionalProperties: true },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.createStatutoryPack);

  fastify.patch('/payroll/statutory-packs/:id', {
    schema: {
      tags: ['Payroll'], description: 'Update statutory pack — flat partial body (SUPER_ADMIN)', security: [{ Bearer: [] }],
      params: idParam,
      body: { type: 'object', additionalProperties: true },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.updateStatutoryPack);

  fastify.delete('/payroll/statutory-packs/:id', {
    schema: {
      tags: ['Payroll'], description: 'Delete statutory pack if not referenced (SUPER_ADMIN)', security: [{ Bearer: [] }],
      params: idParam,
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.deleteStatutoryPack);

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
      tags: ['Payroll'],
      description: 'Get payroll register for a run. ?type=SALARY|STATUTORY|BANK_ADVICE|VARIANCE. SALARY rows include department + employerCost. Response includes columns[], rows[], summary[], totalEmployerCost, periodLabel.',
      security: [{ Bearer: [] }],
      params: idParam,
      querystring: { type: 'object', properties: { type: { type: 'string', enum: ['SALARY', 'STATUTORY', 'BANK_ADVICE', 'VARIANCE'], description: 'Register type (default SALARY)' } } },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: PayrollRegister,
          },
        },
      },
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
          frequency: { type: 'string', enum: ['MONTHLY', 'BIWEEKLY', 'WEEKLY'], description: 'Alias for paySchedule' },
          firstPayDate: { type: 'string' },
          legalEntityId: { type: 'string', nullable: true },
          periodAnchor: { type: 'integer', minimum: 1, maximum: 28, description: 'Day-of-month the pay period starts (1–28)' },
          payDateRule: { type: 'string' },
          payDay: { type: 'integer' },
          cutoffDay: { type: 'integer' },
          holidayCalendarId: { type: 'string', nullable: true },
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
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          frequency: { type: 'string', enum: ['MONTHLY', 'BIWEEKLY', 'WEEKLY'] },
          paySchedule: { type: 'string', enum: ['MONTHLY', 'BIWEEKLY', 'WEEKLY'] },
          periodAnchor: { type: 'integer', minimum: 1, maximum: 28 },
          payDateRule: { type: 'string' },
          payDay: { type: 'integer' },
          cutoffDay: { type: 'integer' },
          legalEntityId: { type: 'string', nullable: true },
          holidayCalendarId: { type: 'string', nullable: true },
        },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.updatePayCalendar);

  // ── Phase 3: Migration ──────────────────────────────────────────────────────

  fastify.get('/payroll/opening-balances', {
    schema: { tags: ['Payroll'], description: 'List all opening balances', security: [{ Bearer: [] }], response: { 200: obj } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getAllOpeningBalances);

  fastify.get('/payroll/migration', {
    schema: {
      tags: ['Payroll'],
      description: 'Migration overview (alias aggregate of /payroll/migration/status)',
      security: [{ Bearer: [] }],
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getPayrollMigration);

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

  fastify.get('/payroll/payment-batches', {
    schema: {
      tags: ['Payroll'],
      description: 'List all payment batches across payroll runs',
      security: [{ Bearer: [] }],
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.listPaymentBatches);

  // ── Phase 3: Compliance Reports ─────────────────────────────────────────────

  fastify.get('/payroll/reports', {
    schema: {
      tags: ['Payroll'],
      description: 'Payroll reports index with available report metadata and recent runs',
      security: [{ Bearer: [] }],
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getPayrollReportsIndex);

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

  fastify.get('/payroll/settings', {
    schema: {
      tags: ['Payroll'],
      description: 'Central payroll settings (data policy, defaults, feature flags)',
      security: [{ Bearer: [] }],
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getPayrollSettings);

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

  // ── Global Workforce ────────────────────────────────────────────────────────

  fastify.get('/payroll/workers', {
    schema: {
      tags: ['Payroll'], description: 'List all workers (employees + contractors + EOR) with monthly cost', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { classification: { type: 'string', enum: ['EMPLOYEE', 'CONTRACTOR', 'EOR'] } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.listWorkers);

  fastify.patch('/payroll/workers/:id', {
    schema: {
      tags: ['Payroll'], description: 'Update worker classification', security: [{ Bearer: [] }],
      params: idParam,
      body: { type: 'object', required: ['classification'], properties: { classification: { type: 'string', enum: ['EMPLOYEE', 'CONTRACTOR', 'EOR'] }, country: { type: 'string', description: 'ISO 3166-1 alpha-2 country code' }, currency: { type: 'string', description: 'ISO 4217 currency code' }, legalEntityId: { type: 'string', description: 'Legal entity this worker belongs to' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.updateWorkerClassification);

  fastify.get('/payroll/cost-summary', {
    schema: {
      tags: ['Payroll'], description: 'Consolidated people cost summary (FX-normalized to base currency)', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { groupBy: { type: 'string', enum: ['classification', 'entity', 'currency'] } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getWorkerCostSummary);

  fastify.get('/payroll/contractor-invoices', {
    schema: {
      tags: ['Payroll'], description: 'List contractor invoices', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { workerId: { type: 'string' }, status: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.listContractorInvoices);

  fastify.post('/payroll/contractor-invoices', {
    schema: {
      tags: ['Payroll'], description: 'Submit a contractor invoice', security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['workerId', 'period', 'amount'],
        properties: {
          workerId: { type: 'string' }, period: { type: 'string' },
          amount: { type: 'number' }, currency: { type: 'string' },
          withholdingPct: { type: 'number' }, workerName: { type: 'string' },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.createContractorInvoice);

  fastify.patch('/payroll/contractor-invoices/:id', {
    schema: {
      tags: ['Payroll'], description: 'Approve / pay / void a contractor invoice', security: [{ Bearer: [] }],
      params: idParam,
      body: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['SUBMITTED', 'APPROVED', 'PAID', 'VOIDED'] },
          payoutRef: { type: 'string' },
        },
      },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.updateContractorInvoice);

  // ── Phase 3: Missing Run Endpoints ─────────────────────────────────────────

  fastify.post('/payroll/runs/:id/approvals/:level', {
    schema: {
      tags: ['Payroll'], description: 'Approve a specific level in the multi-level chain', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id', 'level'], properties: { id: { type: 'string' }, level: { type: 'string' } } },
      body: { type: 'object', properties: { approver: { type: 'string' }, notes: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.approveRunLevel);

  fastify.get('/payroll/runs/:id/variance', {
    schema: {
      tags: ['Payroll'], description: 'Get per-employee net-pay variance vs prior run', security: [{ Bearer: [] }],
      params: idParam, response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getRunVariance);

  fastify.get('/payroll/runs/:id/audit', {
    schema: {
      tags: ['Payroll'], description: 'Get audit log for a payroll run', security: [{ Bearer: [] }],
      params: idParam, response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getRunAudit);

  fastify.post('/payroll/runs/:id/payslips/:payslipId/recalculate', {
    schema: {
      tags: ['Payroll'], description: 'Recalculate a single payslip deterministically', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id', 'payslipId'], properties: { id: { type: 'string' }, payslipId: { type: 'string' } } },
      body: { type: 'object', properties: { actor: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.recalculatePayslip);

  fastify.post('/payroll/runs/:runId/payslips/:payslipId/hold', {
    schema: {
      tags: ['Payroll'], description: 'Hold a payslip (exclude from disbursement)', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['runId', 'payslipId'], properties: { runId: { type: 'string' }, payslipId: { type: 'string' } } },
      body: { type: 'object', properties: { reason: { type: 'string' }, actor: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.holdPayslip);

  fastify.post('/payroll/runs/:runId/payslips/:payslipId/release', {
    schema: {
      tags: ['Payroll'], description: 'Release a held payslip', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['runId', 'payslipId'], properties: { runId: { type: 'string' }, payslipId: { type: 'string' } } },
      body: { type: 'object', additionalProperties: true },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.releasePayslip);

  fastify.post('/payroll/runs/:id/inputs/from-timesheets', {
    schema: {
      tags: ['Payroll'], description: 'Pre-fill OT/LOP from approved timesheets in the run period', security: [{ Bearer: [] }],
      params: idParam, body: { type: 'object', additionalProperties: true }, response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.importInputsFromTimesheets);

  fastify.post('/payroll/runs/:id/publish', {
    schema: {
      tags: ['Payroll'], description: 'Publish run payslips to employees', security: [{ Bearer: [] }],
      params: idParam, body: { type: 'object', additionalProperties: true }, response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.publishRun);

  // ── Phase 3: Events ─────────────────────────────────────────────────────────

  fastify.get('/payroll/events', {
    schema: {
      tags: ['Payroll'], description: 'List payroll lifecycle events', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { runId: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.listPayrollEvents);

  fastify.get('/payroll/event-catalogue', {
    schema: { tags: ['Payroll'], description: 'List subscribable event types', security: [{ Bearer: [] }], response: { 200: obj } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getEventCatalogue);

  // ── Phase 3: Disbursement ───────────────────────────────────────────────────

  fastify.get('/payroll/runs/:id/payment-batch', {
    schema: {
      tags: ['Payroll'], description: 'Get payment batch for a run', security: [{ Bearer: [] }],
      params: idParam, response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getPaymentBatch);

  fastify.post('/payroll/runs/:id/payment-batch', {
    schema: {
      tags: ['Payroll'], description: 'Create payment batch for an approved run', security: [{ Bearer: [] }],
      params: idParam, body: { type: 'object', additionalProperties: true }, response: { 201: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.createPaymentBatch);

  fastify.get('/payroll/runs/:id/bank-file', {
    schema: {
      tags: ['Payroll'], description: 'Download bank file for a run', security: [{ Bearer: [] }],
      params: idParam,
      querystring: { type: 'object', properties: { format: { type: 'string', enum: ['NACH', 'ACH', 'SEPA', 'BACS', 'CSV'] } } },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.downloadBankFile);

  fastify.get('/payroll/payment-batches/:id/status', {
    schema: {
      tags: ['Payroll'], description: 'Get payment batch status', security: [{ Bearer: [] }],
      params: idParam, response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getPaymentBatchStatus);

  fastify.post('/payroll/payment-batches/:id/reconcile', {
    schema: {
      tags: ['Payroll'], description: 'Simulate bank reconciliation', security: [{ Bearer: [] }],
      params: idParam, body: { type: 'object', additionalProperties: true }, response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.reconcilePaymentBatch);

  // ── Phase 3: Payslip Templates ──────────────────────────────────────────────

  fastify.get('/payroll/payslip-templates', {
    schema: { tags: ['Payroll'], description: 'Get tenant payslip template. HR_ADMIN configures; MANAGER/EMPLOYEE read-only for own payslip drawer.', security: [{ Bearer: [] }], response: { 200: obj } },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.getPayslipTemplate);

  fastify.patch('/payroll/payslip-templates', {
    schema: {
      tags: ['Payroll'], description: 'Update tenant payslip template', security: [{ Bearer: [] }],
      body: { type: 'object', additionalProperties: true }, response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.updatePayslipTemplate);

  // ── Phase 3: Tax Forms ──────────────────────────────────────────────────────

  fastify.get('/payroll/employees/:id/tax-form', {
    schema: {
      tags: ['Payroll'], description: 'Get statutory tax form document for employee', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      querystring: { type: 'object', properties: { fy: { type: 'string' }, type: { type: 'string', enum: ['FORM16', 'W2', 'P60'] } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.getTaxForm);

  // ── Phase 3: Reimbursement Claims ───────────────────────────────────────────

  fastify.get('/payroll/reimbursement-categories', {
    schema: { tags: ['Payroll'], description: 'List reimbursement categories', security: [{ Bearer: [] }], response: { 200: obj } },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.listReimbursementCategories);

  fastify.get('/payroll/reimbursement-claims', {
    schema: {
      tags: ['Payroll'], description: 'List reimbursement claims', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { employeeId: { type: 'string' }, status: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.listReimbursementClaims);

  fastify.post('/payroll/reimbursement-claims', {
    schema: {
      tags: ['Payroll'], description: 'Submit a reimbursement claim', security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['employeeId', 'categoryId', 'amount'],
        properties: {
          employeeId: { type: 'string' }, categoryId: { type: 'string' },
          amount: { type: 'number' }, currency: { type: 'string' },
          description: { type: 'string' }, proofUrl: { type: 'string' },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.submitReimbursementClaim);

  fastify.patch('/payroll/reimbursement-claims/:id', {
    schema: {
      tags: ['Payroll'], description: 'Approve or reject a reimbursement claim', security: [{ Bearer: [] }],
      params: idParam,
      body: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['APPROVED', 'REJECTED'] } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.decideReimbursementClaim);

  // ── Phase 3: Garnishments ───────────────────────────────────────────────────

  fastify.get('/payroll/employees/:id/garnishments', {
    schema: {
      tags: ['Payroll'], description: 'List garnishments for employee', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.listGarnishments);

  fastify.post('/payroll/employees/:id/garnishments', {
    schema: {
      tags: ['Payroll'], description: 'Create a garnishment order', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['type', 'amountKind', 'amountValue', 'effectiveFrom'],
        properties: {
          type: { type: 'string' }, priority: { type: 'integer' },
          amountKind: { type: 'string' }, amountValue: { type: 'number' },
          protectedEarningsFloor: { type: 'number' }, cap: { type: 'number' },
          reference: { type: 'string' }, effectiveFrom: { type: 'string' }, effectiveTo: { type: 'string' },
        },
      },
      response: { 201: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.createGarnishment);

  fastify.patch('/payroll/employees/:id/garnishments/:garnishmentId', {
    schema: {
      tags: ['Payroll'], description: 'Update a garnishment', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id', 'garnishmentId'], properties: { id: { type: 'string' }, garnishmentId: { type: 'string' } } },
      body: { type: 'object', additionalProperties: true },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.updateGarnishment);

  fastify.delete('/payroll/employees/:id/garnishments/:garnishmentId', {
    schema: {
      tags: ['Payroll'], description: 'Delete a garnishment', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id', 'garnishmentId'], properties: { id: { type: 'string' }, garnishmentId: { type: 'string' } } },
      response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.deleteGarnishment);

  // ── Phase 3: Accounting Journal ─────────────────────────────────────────────

  fastify.get('/payroll/runs/:id/journal', {
    schema: {
      tags: ['Payroll'], description: 'Get double-entry journal for a run', security: [{ Bearer: [] }],
      params: idParam, response: { 200: obj },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.getRunJournal);

  fastify.get('/payroll/runs/:id/journal/export', {
    schema: {
      tags: ['Payroll'], description: 'Export journal (TALLY|QUICKBOOKS|CSV)', security: [{ Bearer: [] }],
      params: idParam,
      querystring: { type: 'object', properties: { format: { type: 'string', enum: ['TALLY', 'QUICKBOOKS', 'CSV'] } } },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.exportRunJournal);
}
