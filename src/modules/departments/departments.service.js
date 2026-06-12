import * as repo from './departments.repository.js';
import { successResponse, errorResponse } from '../../utils/response.js';

// Flatten the headEmployee relation into the convenience fields the UI consumes.
function withHeadEmployeeName(dept) {
  if (!dept) return dept;
  const he = dept.headEmployee;
  const firstName = he?.firstName ?? null;
  const lastName = he?.lastName ?? null;
  return {
    ...dept,
    headEmployeeFirstName: firstName,
    headEmployeeLastName: lastName,
    headEmployeeName: he ? [firstName, lastName].filter(Boolean).join(' ') : null,
  };
}

export async function listDepartments(tenantId, filters) {
  try {
    const departments = await repo.listDepartments(tenantId, filters);
    const tree = buildDepartmentTree(departments.map(withHeadEmployeeName));
    return successResponse(tree, { cached: false });
  } catch (error) {
    return errorResponse('LIST_ERROR', error.message, null);
  }
}

export async function getDepartment(id, tenantId) {
  try {
    const dept = await repo.getDepartmentDetail(id, tenantId);
    if (!dept) return errorResponse('NOT_FOUND', 'Department not found', null);
    return successResponse(withHeadEmployeeName(dept), { cached: false });
  } catch (error) {
    return errorResponse('FETCH_ERROR', error.message, null);
  }
}

export async function createDepartment(tenantId, data, _userId) {
  try {
    if (data.parentId) {
      const parentExists = await repo.getDepartmentById(data.parentId, tenantId);
      if (!parentExists) {
        return errorResponse('INVALID_PARENT', 'Parent department does not exist', null);
      }
    }

    if (data.departmentCode) {
      const codeExists = await repo.checkDepartmentCodeExists(data.departmentCode, tenantId);
      if (codeExists) {
        return errorResponse('DUPLICATE_CODE', 'Department code already exists', null);
      }
    }

    if (data.headEmployeeId) {
      const headCheck = await validateHeadEmployee(data.headEmployeeId, tenantId, null);
      if (headCheck) return headCheck;
    }

    const department = await repo.createDepartment(tenantId, data);
    return successResponse(withHeadEmployeeName(department), { cached: false });
  } catch (error) {
    return errorResponse('CREATE_ERROR', error.message, null);
  }
}

// Returns an errorResponse if the head employee is invalid, otherwise null.
async function validateHeadEmployee(headEmployeeId, tenantId, departmentId) {
  const emp = await repo.getEmployeeForTenant(headEmployeeId, tenantId);
  if (!emp) {
    return errorResponse('INVALID_HEAD_EMPLOYEE', 'Head employee does not exist in this tenant', null);
  }
  // headEmployeeId is @unique — block assigning someone who already heads another department.
  const headsOther = emp.managedDepartments.some(d => d.id !== departmentId);
  if (headsOther) {
    return errorResponse('HEAD_EMPLOYEE_TAKEN', 'This employee already heads another department', null);
  }
  return null;
}

export async function updateDepartment(id, tenantId, data, _userId) {
  try {
    const existing = await repo.getDepartmentById(id, tenantId);
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Department not found', null);
    }

    if (data.parentId && data.parentId !== existing.parentId) {
      if (await wouldCreateCircularParent(id, data.parentId, tenantId)) {
        return errorResponse('DEPARTMENT_CYCLE', 'Cannot create circular parent relationship', null);
      }
      const parentExists = await repo.getDepartmentById(data.parentId, tenantId);
      if (!parentExists) {
        return errorResponse('INVALID_PARENT', 'Parent department does not exist', null);
      }
    }

    if (data.departmentCode && data.departmentCode !== existing.departmentCode) {
      const codeExists = await repo.checkDepartmentCodeExists(data.departmentCode, tenantId, id);
      if (codeExists) {
        return errorResponse('DUPLICATE_CODE', 'Department code already exists', null);
      }
    }

    if (data.headEmployeeId) {
      const headCheck = await validateHeadEmployee(data.headEmployeeId, tenantId, id);
      if (headCheck) return headCheck;
    }

    const department = await repo.updateDepartment(id, tenantId, data);
    return successResponse(withHeadEmployeeName(department), { cached: false });
  } catch (error) {
    return errorResponse('UPDATE_ERROR', error.message, null);
  }
}

export async function deleteDepartment(id, tenantId) {
  try {
    const department = await repo.getDepartmentById(id, tenantId);
    if (!department) {
      return errorResponse('NOT_FOUND', 'Department not found', null);
    }

    const employeeCount = await repo.getEmployeeCountInDepartment(id, tenantId);
    if (employeeCount > 0) {
      return errorResponse('DEPARTMENT_NOT_EMPTY', `Cannot delete department with ${employeeCount} employees. Reassign employees first.`, null);
    }

    const hasSubdepartments = await repo.hasSubdepartments(id, tenantId);
    if (hasSubdepartments) {
      return errorResponse('DEPARTMENT_NOT_EMPTY', 'Cannot delete department with subdepartments. Remove or reassign them first.', null);
    }

    const deleted = await repo.softDeleteDepartment(id, tenantId);
    return successResponse({ id: deleted.id, status: 'archived' }, { cached: false });
  } catch (error) {
    return errorResponse('DELETE_ERROR', error.message, null);
  }
}

async function wouldCreateCircularParent(deptId, parentId, tenantId) {
  let current = parentId;
  const visited = new Set();

  while (current) {
    if (current === deptId) return true;
    if (visited.has(current)) return false;
    visited.add(current);

    const parent = await repo.getDepartmentById(current, tenantId);
    current = parent?.parentId;
  }

  return false;
}

function buildDepartmentTree(departments) {
  const map = new Map();
  const roots = [];

  departments.forEach(dept => {
    map.set(dept.id, { ...dept, children: [] });
  });

  departments.forEach(dept => {
    if (dept.parentId && map.has(dept.parentId)) {
      map.get(dept.parentId).children.push(map.get(dept.id));
    } else if (!dept.parentId) {
      roots.push(map.get(dept.id));
    }
  });

  return roots.sort((a, b) => a.name.localeCompare(b.name));
}

export async function reassignAndDeleteDepartment(id, tenantId, reassignEmployeesTo) {
  try {
    if (id === reassignEmployeesTo) {
      return errorResponse('SAME_DEPARTMENT', 'Target department cannot be the same as source', null);
    }
    const target = await repo.getDepartmentById(reassignEmployeesTo, tenantId);
    if (!target || target.deletedAt) {
      return errorResponse('INVALID_TARGET', 'Target department does not exist or is being deleted', null);
    }
    const { reassigned } = await repo.reassignAndDelete(id, tenantId, reassignEmployeesTo);
    return successResponse({ id, status: 'archived', reassignedEmployees: reassigned }, { cached: false });
  } catch (error) {
    return errorResponse('OPERATION_ERROR', error.message, null);
  }
}

export async function addDepartmentMembers(id, tenantId, employeeIds, userId) {
  try {
    const dept = await repo.getDepartmentById(id, tenantId);
    if (!dept) return errorResponse('DEPARTMENT_NOT_FOUND', 'Department not found', null);

    const result = await repo.addDepartmentMembers(id, tenantId, employeeIds, userId);
    if (result.error) return { success: false, error: result.error };

    await import('../auditLogs/auditLogs.service.js').then(({ recordAuditLog }) =>
      recordAuditLog(tenantId, userId, 'DEPARTMENT_MEMBERS_ADDED', 'Department', id, null,
        { departmentId: id, employeeIds, added: result.added, skipped: result.skipped })
    ).catch(() => {});

    return { success: true, data: result, meta: {} };
  } catch (error) {
    return errorResponse('UPDATE_ERROR', error.message, null);
  }
}

export async function getDepartmentEmployees(id, tenantId, page, limit, search) {
  try {
    const dept = await repo.getDepartmentById(id, tenantId);
    if (!dept) return errorResponse('NOT_FOUND', 'Department not found', null);
    const result = await repo.getDepartmentEmployees(id, tenantId, page, limit, search);
    return successResponse(result, { cached: false });
  } catch (error) {
    return errorResponse('FETCH_ERROR', error.message, null);
  }
}
