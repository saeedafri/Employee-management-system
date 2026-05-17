import * as repo from './employees.repository.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export async function listEmployees(tenantId, filters) {
  try {
    const result = await repo.listEmployees(tenantId, filters);
    return successResponse(result, { cached: false });
  } catch (error) {
    return errorResponse('LIST_ERROR', error.message, null);
  }
}

export async function getEmployee(employeeId, tenantId) {
  try {
    const employee = await repo.getEmployeeById(employeeId, tenantId);
    if (!employee) {
      return errorResponse('NOT_FOUND', 'Employee not found', null);
    }
    return successResponse(employee, { cached: false });
  } catch (error) {
    return errorResponse('FETCH_ERROR', error.message, null);
  }
}

export async function createEmployee(tenantId, data, userId) {
  try {
    // Check for duplicates
    const codeExists = await repo.checkEmployeeCodeExists(data.employeeCode, tenantId);
    if (codeExists) {
      return errorResponse('DUPLICATE_CODE', 'Employee code already exists', null);
    }

    const emailExists = await repo.checkWorkEmailExists(data.workEmail, tenantId);
    if (emailExists) {
      return errorResponse('DUPLICATE_EMAIL', 'Work email already exists', null);
    }

    const employee = await repo.createEmployee(tenantId, {
      ...data,
      createdBy: userId,
    });

    return successResponse(employee, { cached: false });
  } catch (error) {
    return errorResponse('CREATE_ERROR', error.message, null);
  }
}

export async function updateEmployee(employeeId, tenantId, data, userId) {
  try {
    const existing = await repo.getEmployeeById(employeeId, tenantId);
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Employee not found', null);
    }

    // Check for duplicate code (excluding self)
    if (data.employeeCode && data.employeeCode !== existing.employeeCode) {
      const codeExists = await repo.checkEmployeeCodeExists(data.employeeCode, tenantId, employeeId);
      if (codeExists) {
        return errorResponse('DUPLICATE_CODE', 'Employee code already exists', null);
      }
    }

    // Check for duplicate email (excluding self)
    if (data.workEmail && data.workEmail !== existing.workEmail) {
      const emailExists = await repo.checkWorkEmailExists(data.workEmail, tenantId, employeeId);
      if (emailExists) {
        return errorResponse('DUPLICATE_EMAIL', 'Work email already exists', null);
      }
    }

    const employee = await repo.updateEmployee(employeeId, tenantId, {
      ...data,
      updatedBy: userId,
    });

    return successResponse(employee, { cached: false });
  } catch (error) {
    return errorResponse('UPDATE_ERROR', error.message, null);
  }
}

export async function deleteEmployee(employeeId, tenantId) {
  try {
    const existing = await repo.getEmployeeById(employeeId, tenantId);
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Employee not found', null);
    }

    const deleted = await repo.softDeleteEmployee(employeeId, tenantId);
    return successResponse({ id: deleted.id, status: 'TERMINATED' }, { cached: false });
  } catch (error) {
    return errorResponse('DELETE_ERROR', error.message, null);
  }
}

export async function exportEmployees(tenantId) {
  try {
    const employees = await repo.exportEmployeesCsv(tenantId);
    return successResponse(employees, { cached: false });
  } catch (error) {
    return errorResponse('EXPORT_ERROR', error.message, null);
  }
}
