import * as repo from './employees.repository.js';
import { prisma } from '../../plugins/prisma.js';
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

export async function getNextEmployeeCode(tenantId) {
  try {
    const code = await generateEmployeeCode(tenantId);
    return successResponse({ code }, { cached: false });
  } catch (error) {
    return errorResponse('FETCH_ERROR', error.message, null);
  }
}

async function generateEmployeeCode(tenantId) {
  const count = await repo.countEmployees(tenantId);
  let attempt = count + 1;
  let code = `EMP-${String(attempt).padStart(4, '0')}`;
  while (await repo.checkEmployeeCodeExists(code, tenantId)) {
    attempt += 1;
    code = `EMP-${String(attempt).padStart(4, '0')}`;
  }
  return code;
}

export async function createEmployee(tenantId, data, userId) {
  try {
    if (!data.employeeCode) {
      data.employeeCode = await generateEmployeeCode(tenantId);
    }

    const codeExists = await repo.checkEmployeeCodeExists(data.employeeCode, tenantId);
    if (codeExists) {
      return errorResponse('DUPLICATE_EMPLOYEE_CODE', 'Employee code already exists', null);
    }

    const emailExists = await repo.checkWorkEmailExists(data.workEmail, tenantId);
    if (emailExists) {
      return errorResponse('DUPLICATE_WORK_EMAIL', 'Work email already exists', null);
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

    if (data.employeeCode && data.employeeCode !== existing.employeeCode) {
      const codeExists = await repo.checkEmployeeCodeExists(data.employeeCode, tenantId, employeeId);
      if (codeExists) {
        return errorResponse('DUPLICATE_EMPLOYEE_CODE', 'Employee code already exists', null);
      }
    }

    if (data.workEmail && data.workEmail !== existing.workEmail) {
      const emailExists = await repo.checkWorkEmailExists(data.workEmail, tenantId, employeeId);
      if (emailExists) {
        return errorResponse('DUPLICATE_WORK_EMAIL', 'Work email already exists', null);
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

    // Block deletion if employee manages others or heads a department
    const [managedCount, deptHeadCount] = await Promise.all([
      prisma.employee.count({ where: { managerId: employeeId, tenantId, deletedAt: null } }),
      prisma.department.count({ where: { headEmployeeId: employeeId, tenantId, deletedAt: null } }),
    ]);

    if (managedCount > 0 || deptHeadCount > 0) {
      return errorResponse(
        'EMPLOYEE_HAS_DEPENDENTS',
        'Reassign direct reports and department head roles before deleting this employee',
        { managedEmployees: managedCount, departmentsHeaded: deptHeadCount },
      );
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
