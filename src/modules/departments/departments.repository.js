import { prisma } from '../../plugins/prisma.js';
import {
  buildDepartmentChildrenMap,
  getDepartmentAndDescendantIds,
  buildRollupEmployeeCounts,
} from '../../utils/departmentTree.js';

export async function listDepartments(tenantId, filters = {}) {
  const { includeArchived = false } = filters;

  const [departments, directCounts] = await Promise.all([
    prisma.department.findMany({
      where: { tenantId, ...(includeArchived ? {} : { deletedAt: null }) },
      include: {
        headEmployee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.employee.groupBy({
      by: ['departmentId'],
      where: { tenantId, deletedAt: null },
      _count: { id: true },
    }),
  ]);

  const directCountMap = new Map(directCounts.map(r => [r.departmentId, r._count.id]));
  const rollupMap = buildRollupEmployeeCounts(departments, directCountMap);

  return departments.map(dept => ({
    ...dept,
    directEmployeeCount: directCountMap.get(dept.id) ?? 0,
    _count: { employees: rollupMap.get(dept.id) ?? 0 },
  }));
}

export async function getDepartmentById(id, tenantId) {
  return prisma.department.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      headEmployee: { select: { id: true, firstName: true, lastName: true } },
      parent: { select: { id: true, name: true } },
      _count: { select: { employees: true } },
    },
  });
}

export async function getDepartmentDetail(id, tenantId) {
  const [dept, allDepts] = await Promise.all([
    prisma.department.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        headEmployee: { select: { id: true, firstName: true, lastName: true } },
        parent: { select: { id: true, name: true } },
        subDepartments: { where: { deletedAt: null }, select: { id: true, name: true, departmentCode: true } },
      },
    }),
    prisma.department.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, parentId: true } }),
  ]);
  if (!dept) return null;

  const childrenMap = buildDepartmentChildrenMap(allDepts);
  const subtreeIds = getDepartmentAndDescendantIds(id, childrenMap);

  const [employees, subDeptCount, totalHeadcount, managerCount] = await Promise.all([
    prisma.employee.findMany({
      where: { tenantId, departmentId: { in: subtreeIds }, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true, employmentStatus: true },
      orderBy: { firstName: 'asc' },
      take: 50,
    }),
    prisma.department.count({ where: { tenantId, parentId: id, deletedAt: null } }),
    prisma.employee.count({ where: { tenantId, departmentId: { in: subtreeIds }, deletedAt: null } }),
    prisma.employee.count({
      where: { tenantId, departmentId: id, deletedAt: null, managedEmployees: { some: { deletedAt: null } } },
    }),
  ]);

  return {
    id: dept.id, name: dept.name, departmentCode: dept.departmentCode,
    depth: dept.depth, parentId: dept.parentId, parent: dept.parent,
    headEmployee: dept.headEmployee, subDepartments: dept.subDepartments,
    totalHeadcount, subDeptCount, managerCount,
    employees,
  };
}

export async function createDepartment(tenantId, data) {
  return prisma.department.create({
    data: {
      tenantId,
      name: data.name,
      departmentCode: data.departmentCode,
      parentId: data.parentId || null,
      headEmployeeId: data.headEmployeeId || null,
    },
    include: {
      headEmployee: { select: { id: true, firstName: true, lastName: true } },
      parent: { select: { id: true, name: true } },
      _count: { select: { employees: true } },
    },
  });
}

export async function getEmployeeForTenant(employeeId, tenantId) {
  return prisma.employee.findFirst({
    where: { id: employeeId, tenantId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      managedDepartments: { where: { deletedAt: null }, select: { id: true } },
    },
  });
}

export async function updateDepartment(id, tenantId, data) {
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.departmentCode !== undefined) updateData.departmentCode = data.departmentCode;
  if (data.headEmployeeId !== undefined) updateData.headEmployeeId = data.headEmployeeId || null;
  updateData.updatedAt = new Date();

  return prisma.department.update({
    where: { id },
    data: updateData,
    include: {
      headEmployee: { select: { id: true, firstName: true, lastName: true } },
      parent: { select: { id: true, name: true } },
      _count: { select: { employees: true } },
    },
  });
}

export async function softDeleteDepartment(id, _tenantId) {
  return prisma.department.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function checkDepartmentCodeExists(code, tenantId, excludeId = null) {
  const where = { tenantId, departmentCode: code, deletedAt: null };
  if (excludeId) {
    Object.assign(where, { NOT: { id: excludeId } });
  }
  return prisma.department.findFirst({ where });
}

export async function getEmployeeCountInDepartment(deptId, tenantId) {
  const result = await prisma.employee.count({
    where: {
      departmentId: deptId,
      tenantId,
      deletedAt: null,
    },
  });
  return result;
}

export async function addDepartmentMembers(departmentId, tenantId, employeeIds, userId) {
  const uniqueIds = [...new Set(employeeIds)];

  const employees = await prisma.employee.findMany({
    where: { id: { in: uniqueIds }, tenantId, deletedAt: null },
    select: { id: true, departmentId: true },
  });

  if (employees.length !== uniqueIds.length) {
    const found = new Set(employees.map(e => e.id));
    return { error: { code: 'EMPLOYEE_NOT_FOUND', message: 'One or more employees were not found', details: { employeeIds: uniqueIds.filter(id => !found.has(id)) } } };
  }

  const skippedIds = employees.filter(e => e.departmentId === departmentId).map(e => e.id);
  const toAddIds   = employees.filter(e => e.departmentId !== departmentId).map(e => e.id);

  if (toAddIds.length > 0) {
    await prisma.employee.updateMany({
      where: { id: { in: toAddIds }, tenantId, deletedAt: null },
      data: { departmentId, updatedBy: userId, updatedAt: new Date() },
    });
  }

  const allDepts = await prisma.department.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, parentId: true },
  });
  const childrenMap = buildDepartmentChildrenMap(allDepts);
  const subtreeIds  = getDepartmentAndDescendantIds(departmentId, childrenMap);
  const employeeCount = await prisma.employee.count({
    where: { tenantId, deletedAt: null, departmentId: { in: subtreeIds } },
  });

  return { id: departmentId, added: toAddIds.length, skipped: skippedIds.length, employeeIds: uniqueIds, _count: { employees: employeeCount } };
}

export async function hasSubdepartments(deptId, tenantId) {
  const count = await prisma.department.count({
    where: {
      parentId: deptId,
      tenantId,
      deletedAt: null,
    },
  });
  return count > 0;
}

export async function reassignAndDelete(id, tenantId, targetDeptId) {
  const [reassigned] = await prisma.$transaction([
    prisma.employee.updateMany({
      where: { departmentId: id, tenantId, deletedAt: null },
      data: { departmentId: targetDeptId },
    }),
    prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
  ]);
  return { reassigned: reassigned.count };
}

export async function getDepartmentEmployees(deptId, tenantId, page = 1, limit = 20, search) {
  const skip = (page - 1) * limit;

  const allDepts = await prisma.department.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, parentId: true },
  });
  const childrenMap = buildDepartmentChildrenMap(allDepts);
  const deptIds = getDepartmentAndDescendantIds(deptId, childrenMap);

  const where = { tenantId, departmentId: { in: deptIds }, deletedAt: null };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { employeeCode: { contains: search, mode: 'insensitive' } },
    ];
  }
  const [data, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: {
        id: true, employeeCode: true, firstName: true, lastName: true,
        designation: true, employmentStatus: true, joinedOn: true,
        department: { select: { id: true, name: true } },
        user: { select: { email: true } },
      },
      orderBy: { employeeCode: 'asc' },
      skip,
      take: limit,
    }),
    prisma.employee.count({ where }),
  ]);
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
