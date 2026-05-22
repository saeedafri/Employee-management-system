import * as repo from './departments.repository.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export async function listDepartments(tenantId, filters) {
  try {
    const departments = await repo.listDepartments(tenantId, filters);
    const tree = buildDepartmentTree(departments);
    return successResponse(tree, { cached: false });
  } catch (error) {
    return errorResponse('LIST_ERROR', error.message, null);
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

    const department = await repo.createDepartment(tenantId, data);
    return successResponse(department, { cached: false });
  } catch (error) {
    return errorResponse('CREATE_ERROR', error.message, null);
  }
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

    const department = await repo.updateDepartment(id, tenantId, data);
    return successResponse(department, { cached: false });
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
