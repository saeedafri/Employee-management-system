import * as service from './employees.service.js';
import * as repo from './employees.repository.js';
import * as validator from './employees.validator.js';
import { errorResponse } from '../../utils/response.js';

export async function listEmployees(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  // Check permission
  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can list employees', request.requestId));
  }

  try {
    const query = await validator.listQuerySchema.parseAsync(request.query);
    const result = await service.listEmployees(tenantId, query, user.id);
    reply.code(result.error ? 400 : 200).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function getEmployee(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  try {
    const { id } = await validator.idParamSchema.parseAsync(request.params);

    // Permission: own data or HR/Admin
    if (user.employeeId !== id && !['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
      return reply.code(403).send(errorResponse('FORBIDDEN', 'Cannot view other employee data', request.requestId));
    }

    const result = await service.getEmployee(id, tenantId);
    reply.code(result.error ? 400 : 200).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function createEmployee(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  // Only HR/Admin can create
  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can create employees', request.requestId));
  }

  try {
    const data = await validator.createEmployeeSchema.parseAsync(request.body);
    const result = await service.createEmployee(tenantId, data, user.id);
    reply.code(result.error ? 400 : 201).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function updateEmployee(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  try {
    const { id } = await validator.idParamSchema.parseAsync(request.params);

    // Permission: own data or HR/Admin
    if (user.employeeId !== id && !['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
      return reply.code(403).send(errorResponse('FORBIDDEN', 'Cannot update other employee data', request.requestId));
    }

    const data = await validator.updateEmployeeSchema.parseAsync(request.body);
    const result = await service.updateEmployee(id, tenantId, data, user.id);
    reply.code(result.error ? 400 : 200).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function deleteEmployee(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  // Only HR/Admin can delete
  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can delete employees', request.requestId));
  }

  try {
    const { id } = await validator.idParamSchema.parseAsync(request.params);
    const result = await service.deleteEmployee(id, tenantId);
    reply.code(result.error ? 400 : 200).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function exportEmployees(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can export employees', request.requestId));
  }

  try {
    const employees = await repo.exportEmployeesCsv(tenantId);
    const headers = ['employeeCode', 'firstName', 'lastName', 'workEmail', 'designation', 'department', 'manager', 'employmentType', 'employmentStatus', 'joinedOn'];
    const rows = employees.map(e => [
      e.employeeCode, e.firstName, e.lastName, e.workEmail,
      e.designation || '',
      e.department?.name || '',
      e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : '',
      e.employmentType, e.employmentStatus,
      e.joinedOn ? new Date(e.joinedOn).toISOString().split('T')[0] : '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    reply.type('text/csv').header('Content-Disposition', 'attachment; filename="employees.csv"').send(csv);
  } catch (error) {
    reply.code(400).send(errorResponse('EXPORT_ERROR', error.message, request.requestId));
  }
}
