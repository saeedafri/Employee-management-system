// Payout-methods routes (BANK_PAYOUT_BACKEND_CONTRACT §5–§9). Registered alongside
// payrollRoutes under the /api/v1 prefix. The two divergent country endpoints
// (/payroll/countries, /payroll/countries/:code/bank-schema) are reconciled in
// payroll.controller.js to avoid duplicate-route registration.
import { authenticate, authorize } from '../../../middleware/authenticate.js';
import * as ctrl from './payout.controller.js';

const adminRoles = ['HR_ADMIN', 'SUPER_ADMIN'];
const superOnly = ['SUPER_ADMIN'];
const allAuth = ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE', 'AUDITOR'];

const obj = { type: 'object', additionalProperties: true };
const ok = { 200: obj };
const sec = [{ Bearer: [] }];
const T = ['Payroll · Payout Methods'];
const countryParam = { type: 'object', required: ['country'], properties: { country: { type: 'string' } } };
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };
const empParam = { type: 'object', required: ['employeeId'], properties: { employeeId: { type: 'string' } } };

export default async function payoutRoutes(fastify) {
  // ── Country bank-schema catalog (SUPER_ADMIN) ───────────────────────────────
  fastify.get('/payroll/country-bank-schemas', {
    schema: { tags: T, description: 'List the tenant country bank-schema catalog.', security: sec, response: ok },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.listCatalog);

  fastify.get('/payroll/country-bank-schemas/:country', {
    schema: { tags: T, description: 'Get one country schema (or a generic-fallback row).', security: sec, params: countryParam, response: ok },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.getCatalogOne);

  fastify.post('/payroll/country-bank-schemas', {
    schema: { tags: T, description: 'Create a country schema. 409 SCHEMA_EXISTS if present.', security: sec, body: obj, response: { 201: obj } },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.createCatalog);

  fastify.patch('/payroll/country-bank-schemas/:country', {
    schema: { tags: T, description: 'Update a country schema (currency/fields).', security: sec, params: countryParam, body: obj, response: ok },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.updateCatalog);

  fastify.delete('/payroll/country-bank-schemas/:country', {
    schema: { tags: T, description: 'Delete a country schema (reverts to generic fallback).', security: sec, params: countryParam, response: ok },
    onRequest: [authenticate, authorize(superOnly)],
  }, ctrl.deleteCatalog);

  // ── Payout methods — reads ──────────────────────────────────────────────────
  fastify.get('/payroll/me/payout-methods', {
    schema: { tags: T, description: 'Signed-in employee’s payout methods (masked) + instructions.', security: sec, response: ok },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.listMine);

  fastify.get('/payroll/employees/:employeeId/payout-methods', {
    schema: { tags: T, description: 'An employee’s payout methods (self or HR/SUPER). Masked.', security: sec, params: empParam, response: ok },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.listForEmployee);

  // Static segments registered before the :id param (Fastify prioritises static, order-independent).
  fastify.get('/payroll/payout-methods/approvals', {
    schema: { tags: T, description: 'Maker-checker approval queue (?status=PENDING). HR/SUPER.', security: sec, querystring: { type: 'object', properties: { status: { type: 'string' } } }, response: ok },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.listApprovals);

  fastify.get('/payroll/payout-methods/unverified', {
    schema: { tags: T, description: 'ACTIVE + UNVERIFIED BANK methods awaiting verification. HR/SUPER.', security: sec, response: ok },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.listUnverified);

  fastify.get('/payroll/payout-methods/:id', {
    schema: { tags: T, description: 'Single method. Owner sees full details; others masked.', security: sec, params: idParam, response: ok },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.getMethod);

  // ── Payout methods — writes ─────────────────────────────────────────────────
  fastify.post('/payroll/employees/:employeeId/payout-methods', {
    schema: { tags: T, description: 'Create a payout method → PENDING_APPROVAL + enqueues METHOD_ADD. Self or HR/SUPER.', security: sec, params: empParam, body: obj, response: { 201: obj } },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.createMethod);

  fastify.post('/payroll/payout-methods/:id/set-primary', {
    schema: { tags: T, description: 'Enqueue a SET_PRIMARY approval. Returns 202.', security: sec, params: idParam, response: { 202: obj } },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.setPrimary);

  fastify.post('/payroll/payout-methods/:id/archive', {
    schema: { tags: T, description: 'Archive a method (removes from disbursement). No approval needed.', security: sec, params: idParam, response: ok },
    onRequest: [authenticate, authorize(allAuth)],
  }, ctrl.archive);

  fastify.post('/payroll/payout-methods/:id/verify', {
    schema: { tags: T, description: 'Verify an ACTIVE method (VERIFIED/FAILED). 409 NOT_ACTIVE otherwise. HR/SUPER.', security: sec, params: idParam, body: obj, response: ok },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.verify);

  // ── Approvals — apply/reject (HR/SUPER, maker ≠ checker) ─────────────────────
  fastify.post('/payroll/payout-methods/approvals/:id/approve', {
    schema: { tags: T, description: 'Apply a queued change. 403 if approver is the requester.', security: sec, params: idParam, body: obj, response: ok },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.approveApproval);

  fastify.post('/payroll/payout-methods/approvals/:id/reject', {
    schema: { tags: T, description: 'Reject a queued change (reason required).', security: sec, params: idParam, body: obj, response: ok },
    onRequest: [authenticate, authorize(adminRoles)],
  }, ctrl.rejectApproval);
}
