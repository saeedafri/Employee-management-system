import * as service from './departments.service.js';
import * as validator from './departments.validator.js';
import { errorResponse } from '../../utils/response.js';

export async function listDepartments(request, reply) {
  const { user: _user } = request; const tenantId = request.tenant.id;

  // List is readable by every authenticated user (used for filter dropdowns, profile pages, etc).
  // Mutations below remain restricted to HR_ADMIN / SUPER_ADMIN.
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
    reply.code(result.error ? 400 : 201).send(result);
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
    reply.code(result.error ? 400 : 200).send(result);
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
    reply.code(result.error ? 400 : 200).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}
