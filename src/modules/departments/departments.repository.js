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

export async function createDepartment(tenantId, data) {
  return prisma.department.create({
    data: {
      tenantId,
      name: data.name,
      departmentCode: data.departmentCode,
      parentId: data.parentId || null,
    },
    include: {
      headEmployee: { select: { id: true, firstName: true, lastName: true } },
      parent: { select: { id: true, name: true } },
      _count: { select: { employees: true } },
    },
  });
}

export async function updateDepartment(id, tenantId, data) {
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.departmentCode !== undefined) updateData.departmentCode = data.departmentCode;
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

export async function softDeleteDepartment(id, tenantId) {
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
