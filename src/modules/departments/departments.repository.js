import { prisma } from '../../plugins/prisma.js';

export async function listDepartments(tenantId, filters = {}) {
  const { includeArchived = false } = filters;

  return prisma.department.findMany({
    where: {
      tenantId,
      ...(includeArchived ? {} : { deletedAt: null }),
    },
    include: {
      headEmployee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      _count: { select: { employees: true } },
    },
    orderBy: { name: 'asc' },
  });
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
  const dept = await prisma.department.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      headEmployee: { select: { id: true, firstName: true, lastName: true } },
      parent: { select: { id: true, name: true } },
      subDepartments: { where: { deletedAt: null }, select: { id: true, name: true, departmentCode: true } },
    },
  });
  if (!dept) return null;

  const [, employees, subDeptCount, totalHeadcount, managerCount] = await Promise.all([
    prisma.department.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, parentId: true } }),
    prisma.employee.findMany({
      where: { tenantId, departmentId: id, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true, employmentStatus: true },
      orderBy: { firstName: 'asc' },
      take: 50,
    }),
    prisma.department.count({ where: { tenantId, parentId: id, deletedAt: null } }),
    (async () => {
      const subtreeIds = new Set([id]);
      const allD = await prisma.department.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, parentId: true } });
      allD.forEach(d => { if (d.parentId === id) subtreeIds.add(d.id); });
      return prisma.employee.count({ where: { tenantId, departmentId: { in: [...subtreeIds] }, deletedAt: null } });
    })(),
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
    },
  });
  return result;
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
  const where = { tenantId, departmentId: deptId, deletedAt: null };
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
