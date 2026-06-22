import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as c from './timesheetsConfig.controller.js';

const ok = { 200: { type: 'object', additionalProperties: true } };
const HR = ['HR_ADMIN', 'SUPER_ADMIN'];
const MGR = ['MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'];
const T = ['Timesheets'];

// Timesheet workflow-extras (Phase 5.4/5.5) — mirrors ems-frontend timesheets.ts MSW handlers.
export default async function timesheetsConfigRoutes(fastify) {
  // Period locks
  fastify.get('/timesheets/locks', { schema: { tags: T, description: 'List timesheet period locks', security: [{ Bearer: [] }], response: ok }, onRequest: [authenticate, authorize(MGR)] }, c.getLocks);
  fastify.post('/timesheets/locks', { schema: { tags: T, description: 'Lock a timesheet period (HR_ADMIN/SUPER_ADMIN)', security: [{ Bearer: [] }], body: { type: 'object', required: ['startDate', 'endDate'], properties: { startDate: { type: 'string' }, endDate: { type: 'string' }, label: { type: 'string' } } }, response: ok }, onRequest: [authenticate, authorize(HR)] }, c.createLock);
  fastify.delete('/timesheets/locks/:id', { schema: { tags: T, description: 'Remove a period lock (HR_ADMIN/SUPER_ADMIN)', security: [{ Bearer: [] }], params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }, response: ok }, onRequest: [authenticate, authorize(HR)] }, c.deleteLock);

  // Audit trail
  fastify.get('/timesheets/audit', { schema: { tags: T, description: 'Timesheet activity audit trail (filter ?timesheetId/?week/?employeeId)', security: [{ Bearer: [] }], querystring: { type: 'object', properties: { timesheetId: { type: 'string' }, week: { type: 'string' }, employeeId: { type: 'string' } } }, response: ok }, onRequest: [authenticate, authorize(MGR)] }, c.getAudit);

  // Approval chain
  fastify.get('/timesheets/approval-chain', { schema: { tags: T, description: 'Approval chain steps', security: [{ Bearer: [] }], response: ok }, onRequest: [authenticate, authorize(MGR)] }, c.getApprovalChain);
  fastify.patch('/timesheets/approval-chain', { schema: { tags: T, description: 'Set approval chain steps (HR_ADMIN/SUPER_ADMIN)', security: [{ Bearer: [] }], body: { type: 'object', properties: { steps: { type: 'array' } } }, response: ok }, onRequest: [authenticate, authorize(HR)] }, c.patchApprovalChain);

  // Rates config
  fastify.get('/timesheets/rates-config', { schema: { tags: T, description: 'PSA reporting rates config', security: [{ Bearer: [] }], response: ok }, onRequest: [authenticate, authorize(MGR)] }, c.getRatesConfig);
  fastify.patch('/timesheets/rates-config', { schema: { tags: T, description: 'Update rates config (HR_ADMIN/SUPER_ADMIN)', security: [{ Bearer: [] }], body: { type: 'object', additionalProperties: true }, response: ok }, onRequest: [authenticate, authorize(HR)] }, c.patchRatesConfig);

  // Budgets
  fastify.get('/timesheets/budgets', { schema: { tags: T, description: 'Project budgets with computed burn status', security: [{ Bearer: [] }], response: ok }, onRequest: [authenticate, authorize(MGR)] }, c.getBudgets);
  fastify.patch('/timesheets/budgets/:projectId', { schema: { tags: T, description: 'Set/remove a project budget (HR_ADMIN/SUPER_ADMIN)', security: [{ Bearer: [] }], params: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string' } } }, body: { type: 'object', properties: { basis: { type: 'string', enum: ['HOURS', 'FEES'] }, cap: { type: 'number' } } }, response: ok }, onRequest: [authenticate, authorize(HR)] }, c.patchBudget);

  // Cost rates
  fastify.get('/timesheets/cost-rates', { schema: { tags: T, description: 'Per-employee cost rates', security: [{ Bearer: [] }], response: ok }, onRequest: [authenticate, authorize(MGR)] }, c.getCostRates);
  fastify.patch('/timesheets/cost-rates/:employeeId', { schema: { tags: T, description: 'Update an employee cost rate (HR_ADMIN/SUPER_ADMIN)', security: [{ Bearer: [] }], params: { type: 'object', required: ['employeeId'], properties: { employeeId: { type: 'string' } } }, body: { type: 'object', required: ['costRate'], properties: { costRate: { type: 'number' } } }, response: ok }, onRequest: [authenticate, authorize(HR)] }, c.patchCostRate);

  // Week config
  fastify.get('/timesheets/week-config', { schema: { tags: T, description: 'Tenant week-start day', security: [{ Bearer: [] }], response: ok }, onRequest: [authenticate] }, c.getWeekConfig);

  // Delegations
  fastify.get('/timesheets/delegations', { schema: { tags: T, description: 'Approval delegations', security: [{ Bearer: [] }], response: ok }, onRequest: [authenticate, authorize(MGR)] }, c.getDelegations);
  fastify.post('/timesheets/delegations', { schema: { tags: T, description: 'Create an approval delegation (MANAGER+)', security: [{ Bearer: [] }], body: { type: 'object', required: ['delegateId', 'fromDate', 'toDate'], properties: { delegateId: { type: 'string' }, fromDate: { type: 'string' }, toDate: { type: 'string' }, role: { type: 'string' }, reason: { type: 'string' }, delegatorId: { type: 'string' }, delegatorName: { type: 'string' }, delegateName: { type: 'string' } } }, response: { 201: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate, authorize(MGR)] }, c.createDelegation);
  fastify.delete('/timesheets/delegations/:id', { schema: { tags: T, description: 'Remove an approval delegation (MANAGER+)', security: [{ Bearer: [] }], params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }, response: ok }, onRequest: [authenticate, authorize(MGR)] }, c.deleteDelegation);
}
