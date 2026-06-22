import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as c from './leaveEngine.controller.js';

const ok = { 200: { type: 'object', additionalProperties: true } };
const created = { 201: { type: 'object', additionalProperties: true } };
const HR = ['HR_ADMIN', 'SUPER_ADMIN'];
const MGR = ['MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'];

// Leave Engine (Phase 4) — versioned policies, append-only ledger, comp-off, encashment.
// Mirrors ems-frontend/src/mocks/handlers/leave-engine.ts exactly (MSW-off parity).
export default async function leaveEngineRoutes(fastify) {
  const T = ['Leave Engine'];

  // ── Policy packs ──
  fastify.get('/leave/policy-packs/catalog', {
    schema: { tags: T, description: 'Starter leave policy pack catalog', security: [{ Bearer: [] }], response: ok },
    onRequest: [authenticate, authorize(MGR)],
  }, c.getPackCatalog);

  fastify.post('/leave/policy-packs/seed', {
    schema: {
      tags: T, description: 'Seed starter packs as tenant policies (idempotent)', security: [{ Bearer: [] }],
      body: { type: 'object', properties: { country: { type: 'string' } } }, response: ok,
    },
    onRequest: [authenticate, authorize(HR)],
  }, c.seedPacks);

  // ── Policies ──
  fastify.get('/leave/policies', {
    schema: {
      tags: T, description: 'List leave policies (filter by country/status)', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { country: { type: 'string' }, status: { type: 'string' } } }, response: ok,
    },
    onRequest: [authenticate, authorize(MGR)],
  }, c.getPolicies);

  fastify.post('/leave/policies', {
    schema: {
      tags: T, description: 'Create a DRAFT policy version', security: [{ Bearer: [] }],
      body: {
        type: 'object', required: ['country', 'effectiveFrom', 'rules'],
        properties: {
          country: { type: 'string' }, effectiveFrom: { type: 'string' },
          rules: { type: 'array' }, applicability: { type: 'object', additionalProperties: true },
          statutoryFloors: { type: 'object', additionalProperties: true },
        },
      }, response: created,
    },
    onRequest: [authenticate, authorize(HR)],
  }, c.createPolicy);

  fastify.post('/leave/policies/:id/new-version', {
    schema: {
      tags: T, description: 'Clone a policy into a new DRAFT version', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }, response: created,
    },
    onRequest: [authenticate, authorize(HR)],
  }, c.newPolicyVersion);

  fastify.patch('/leave/policies/:id', {
    schema: {
      tags: T, description: 'Patch a DRAFT policy (409 if PUBLISHED)', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', additionalProperties: true }, response: ok,
    },
    onRequest: [authenticate, authorize(HR)],
  }, c.patchPolicy);

  fastify.post('/leave/policies/:id/publish', {
    schema: {
      tags: T, description: 'Publish a DRAFT policy (archives prior PUBLISHED for that country)', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }, response: ok,
    },
    onRequest: [authenticate, authorize(HR)],
  }, c.publishPolicy);

  // ── Assignments ──
  fastify.get('/leave/assignments', {
    schema: {
      tags: T, description: 'List leave-policy assignments (optionally by employee)', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { employeeId: { type: 'string' } } }, response: ok,
    },
    onRequest: [authenticate],
  }, c.getAssignments);

  fastify.post('/leave/assignments/auto-assign', {
    schema: {
      tags: T, description: 'Auto-assign country policy + post opening grants/accruals (idempotent)', security: [{ Bearer: [] }],
      body: { type: 'object', properties: { employeeIds: { type: 'array', items: { type: 'string' } }, country: { type: 'string' } } }, response: ok,
    },
    onRequest: [authenticate, authorize(HR)],
  }, c.autoAssign);

  // ── Ledger ──
  fastify.get('/leave/ledger', {
    schema: {
      tags: T, description: 'Append-only ledger entries + folded balance for an employee/leave-type', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { employeeId: { type: 'string' }, leaveTypeId: { type: 'string' } } }, response: ok,
    },
    onRequest: [authenticate],
  }, c.getLedger);

  fastify.post('/leave/ledger/adjust', {
    schema: {
      tags: T, description: 'Post a manual ADJUSTMENT ledger entry', security: [{ Bearer: [] }],
      body: {
        type: 'object', required: ['employeeId', 'leaveTypeId', 'delta', 'reason'],
        properties: { employeeId: { type: 'string' }, leaveTypeId: { type: 'string' }, delta: { type: 'number' }, reason: { type: 'string' } },
      }, response: ok,
    },
    onRequest: [authenticate, authorize(HR)],
  }, c.adjustLedger);

  // ── Comp-off ──
  fastify.get('/leave/comp-off/types', {
    schema: { tags: T, description: 'Comp-off-eligible leave types for the current user', security: [{ Bearer: [] }], response: ok },
    onRequest: [authenticate],
  }, c.getCompOffTypes);

  fastify.post('/leave/comp-off/requests', {
    schema: {
      tags: T, description: 'Submit a comp-off-earn request (PENDING)', security: [{ Bearer: [] }],
      body: {
        type: 'object', required: ['leaveTypeId', 'workDate', 'units', 'reason'],
        properties: { leaveTypeId: { type: 'string' }, workDate: { type: 'string' }, units: { type: 'number' }, reason: { type: 'string' } },
      }, response: created,
    },
    onRequest: [authenticate],
  }, c.submitCompOff);

  fastify.get('/leave/comp-off/requests', {
    schema: {
      tags: T, description: 'List comp-off requests (scope=team for managers, else own)', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { scope: { type: 'string' }, status: { type: 'string' } } }, response: ok,
    },
    onRequest: [authenticate],
  }, c.listCompOff);

  fastify.post('/leave/comp-off/requests/:id/approve', {
    schema: {
      tags: T, description: 'Approve comp-off → posts COMP_OFF_EARNED + sets expiry', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }, response: ok,
    },
    onRequest: [authenticate, authorize(MGR)],
  }, c.approveCompOff);

  fastify.post('/leave/comp-off/requests/:id/reject', {
    schema: {
      tags: T, description: 'Reject comp-off request', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', properties: { approverComment: { type: 'string' } } }, response: ok,
    },
    onRequest: [authenticate, authorize(MGR)],
  }, c.rejectCompOff);

  // ── Encashment ──
  fastify.post('/leave/encashment', {
    schema: {
      tags: T, description: 'Encash leave days (config-driven daily rate)', security: [{ Bearer: [] }],
      body: {
        type: 'object', required: ['employeeId', 'leaveTypeCode', 'days'],
        properties: {
          employeeId: { type: 'string' }, leaveTypeCode: { type: 'string' }, days: { type: 'number' },
          componentsByTag: { type: 'object', additionalProperties: true },
        },
      }, response: ok,
    },
    onRequest: [authenticate, authorize(HR)],
  }, c.encash);
}
