import { prisma } from '../../plugins/prisma.js';

export async function listEmployees(tenantId, filters = {}) {
  const { page = 1, limit = 20, search, departmentId, status, location, managerOrSelf, selfId } = filters;
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    employmentStatus: status,
    ...(departmentId && { departmentId }),
    ...(location && { location }),
    // Row-level filtering for non-admin roles
    ...(managerOrSelf && { OR: [{ managerId: managerOrSelf }, { id: managerOrSelf }] }),
    ...(selfId && { id: selfId }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { workEmail: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { email: true, memberType: true, status: true } },
      },
      skip,
      take: limit,
      orderBy: { employeeCode: 'asc' },
    }),
    prisma.employee.count({ where }),
  ]);

  return {
    data: employees,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getEmployeeById(employeeId, tenantId) {
  return prisma.employee.findFirst({
    where: { id: employeeId, tenantId, deletedAt: null },
    include: {
      user: { select: { email: true, memberType: true, status: true, mfaEnabled: true } },
      department: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      leaveBalances: { include: { leaveType: { select: { name: true, code: true } } } },
      documents: { select: { id: true, documentType: true, verificationStatus: true } },
    },
  });
}

export async function createEmployee(tenantId, data) {
  return prisma.employee.create({
    data: {
      tenantId,
      ...data,
      createdBy: data.createdBy,
      updatedBy: data.createdBy,
    },
    include: {
      department: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function updateEmployee(employeeId, tenantId, data) {
  return prisma.employee.update({
    where: { id: employeeId },
    data: {
      ...data,
      updatedBy: data.updatedBy,
    },
    include: {
      department: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
      user: { select: { email: true, memberType: true } },
    },
  });
}

export async function softDeleteEmployee(employeeId) {
  return prisma.employee.update({
    where: { id: employeeId },
    data: { employmentStatus: 'TERMINATED', deletedAt: new Date(), updatedBy: 'system' },
  });
}

export async function exportEmployeesCsv(tenantId) {
  return prisma.employee.findMany({
    where: { tenantId },
    include: {
      department: { select: { name: true } },
      manager: { select: { firstName: true, lastName: true } },
    },
    orderBy: { employeeCode: 'asc' },
  });
}

export async function checkEmployeeCodeExists(employeeCode, _tenantId, excludeId = null) {
  const where = { employeeCode };
  if (excludeId) {
    Object.assign(where, { NOT: { id: excludeId } });
  }
  return prisma.employee.findFirst({ where });
}

export async function countEmployees(tenantId) {
  return prisma.employee.count({ where: { tenantId } });
}

export async function checkWorkEmailExists(workEmail, _tenantId, excludeId = null) {
  const where = { workEmail };
  if (excludeId) {
    Object.assign(where, { NOT: { id: excludeId } });
  }
  return prisma.employee.findFirst({ where });
}
