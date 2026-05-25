import * as service from './departments.service.js';
import * as validator from './departments.validator.js';
import { errorResponse } from '../../utils/response.js';

export async function getDepartment(request, reply) {
  const tenantId = request.tenant.id;
  try {
    const { id } = request.params;
    const result = await service.getDepartment(id, tenantId);
    reply.code(result.error ? 404 : 200).send(result);
  } catch (error) {
    reply.code(500).send(errorResponse('INTERNAL_ERROR', error.message, request.requestId));
  }
}

const CONFLICT_CODES = new Set(['DEPARTMENT_CYCLE', 'DEPARTMENT_NOT_EMPTY', 'DUPLICATE_CODE']);
const NOT_FOUND_CODES = new Set(['NOT_FOUND']);

function errorStatus(code) {
  if (CONFLICT_CODES.has(code)) return 409;
  if (NOT_FOUND_CODES.has(code)) return 404;
  return 400;
}

export async function listDepartments(request, reply) {
  const tenantId = request.tenant.id;

  try {
    const query = await validator.listQuerySchema.parseAsync(request.query);
    const result = await service.listDepartments(tenantId, query);
    reply.code(result.error ? 400 : 200).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function createDepartment(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can create departments', request.requestId));
  }

  try {
    const data = await validator.createDepartmentSchema.parseAsync(request.body);
    const result = await service.createDepartment(tenantId, data, user.id);
    reply.code(result.error ? errorStatus(result.error.code) : 201).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function updateDepartment(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can update departments', request.requestId));
  }

  try {
    const { id } = await validator.idParamSchema.parseAsync(request.params);
    const data = await validator.updateDepartmentSchema.parseAsync(request.body);
    const result = await service.updateDepartment(id, tenantId, data, user.id);
    reply.code(result.error ? errorStatus(result.error.code) : 200).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function deleteDepartment(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can delete departments', request.requestId));
  }

  try {
    const { id } = await validator.idParamSchema.parseAsync(request.params);
    const result = await service.deleteDepartment(id, tenantId);
    reply.code(result.error ? errorStatus(result.error.code) : 200).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function reassignAndDelete(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;
  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can delete departments', request.requestId));
  }
  try {
    const { id } = request.params;
    const { reassignEmployeesTo } = request.body;
    if (!reassignEmployeesTo) return reply.code(400).send(errorResponse('VALIDATION_ERROR', 'reassignEmployeesTo is required', request.requestId));
    const result = await service.reassignAndDeleteDepartment(id, tenantId, reassignEmployeesTo);
    reply.code(result.error ? 400 : 200).send(result);
  } catch (error) {
    reply.code(500).send(errorResponse('INTERNAL_ERROR', error.message, request.requestId));
  }
}

export async function getDepartmentEmployees(request, reply) {
  const tenantId = request.tenant.id;
  try {
    const { id } = request.params;
    const { page = 1, limit = 20, search } = request.query;
    const result = await service.getDepartmentEmployees(id, tenantId, parseInt(page, 10), parseInt(limit, 10), search);
    reply.code(result.error ? 404 : 200).send(result);
  } catch (error) {
    reply.code(500).send(errorResponse('INTERNAL_ERROR', error.message, request.requestId));
  }
}
