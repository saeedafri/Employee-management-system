import { prisma } from '../../plugins/prisma.js';

export async function findLeaveRequest(tenantId, leaveRequestId) {
  return prisma.leaveRequest.findFirst({
    where: {
      id: leaveRequestId,
      tenantId,
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
        },
      },
      leaveType: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });
}

function withRef(req) {
  if (!req) return req;
  const { seqNo, ...rest } = req;
  return { ...rest, referenceNo: `LVR-${String(seqNo).padStart(4, '0')}` };
}

export async function getLeaveBalances(tenantId, employeeId) {
  return prisma.leaveBalance.findMany({
    where: {
      tenantId,
      employeeId,
    },
    include: {
      leaveType: {
        select: {
          id: true,
          name: true,
          code: true,
          isPaid: true,
        },
      },
    },
  });
}

export async function getLeaveBalance(tenantId, employeeId, leaveTypeId) {
  return prisma.leaveBalance.findFirst({
    where: {
      tenantId,
      employeeId,
      leaveTypeId,
    },
    include: {
      leaveType: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });
}

export async function createLeaveType(tenantId, data) {
  return prisma.leaveType.create({
    data: { tenantId, name: data.name, code: data.code, annualAllowance: data.annualAllowance || 0, carryForwardAllowed: data.carryForwardAllowed || false, isPaid: data.isPaid !== false },
  });
}

export async function updateLeaveType(tenantId, id, data) {
  const existing = await prisma.leaveType.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.leaveType.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.annualAllowance !== undefined && { annualAllowance: data.annualAllowance }),
      ...(data.carryForwardAllowed !== undefined && { carryForwardAllowed: data.carryForwardAllowed }),
      ...(data.isPaid !== undefined && { isPaid: data.isPaid }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

export async function deleteLeaveType(tenantId, id) {
  const existing = await prisma.leaveType.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.leaveType.update({ where: { id }, data: { isActive: false } });
}

export async function getTeamCalendar(tenantId, managerEmployeeId, month) {
  const [year, mon] = month.split('-').map(Number);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 0);

  const teamEmployees = await prisma.employee.findMany({
    where: { tenantId, managerId: managerEmployeeId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
  });

  if (teamEmployees.length === 0) return { month, employees: [] };

  const employeeIds = teamEmployees.map(e => e.id);

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      tenantId,
      employeeId: { in: employeeIds },
      status: { in: ['APPROVED', 'PENDING'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    include: { leaveType: { select: { name: true, code: true } } },
  });

  const leaveMap = {};
  leaves.forEach(lr => {
    if (!leaveMap[lr.employeeId]) leaveMap[lr.employeeId] = [];
    leaveMap[lr.employeeId].push(lr);
  });

  return {
    month,
    employees: teamEmployees.map(emp => ({
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      employeeCode: emp.employeeCode,
      leaves: (leaveMap[emp.id] || []).map(lr => ({
        id: lr.id, startDate: lr.startDate, endDate: lr.endDate,
        totalDays: lr.totalDays, status: lr.status,
        leaveType: lr.leaveType.name, leaveTypeCode: lr.leaveType.code,
      })),
    })),
  };
}

export async function getLeaveTypes(tenantId) {
  return prisma.leaveType.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      annualAllowance: true,
      carryForwardAllowed: true,
      isPaid: true,
    },
    orderBy: { name: 'asc' },
  });
}

export async function getLeaveType(tenantId, leaveTypeId) {
  return prisma.leaveType.findFirst({
    where: {
      id: leaveTypeId,
      tenantId,
    },
  });
}

export async function checkOverlappingLeaves(tenantId, employeeId, startDate, endDate, excludeId = null) {
  const query = {
    tenantId,
    employeeId,
    startDate: {
      lte: endDate,
    },
    endDate: {
      gte: startDate,
    },
    status: {
      in: ['PENDING', 'APPROVED'],
    },
  };

  if (excludeId) {
    query.id = {
      not: excludeId,
    };
  }

  return prisma.leaveRequest.findFirst({
    where: query,
  });
}

export async function createLeaveRequest(data) {
  const req = await prisma.leaveRequest.create({
    data,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      leaveType: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });
  return withRef(req);
}

export async function updateLeaveRequest(tenantId, leaveRequestId, data) {
  const req = await prisma.leaveRequest.update({
    where: {
      id: leaveRequestId,
      tenantId,
    },
    data,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      leaveType: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  return withRef(req);
}

export async function getEmployeeLeaveRequests(tenantId, employeeId, filters = {}) {
  const {
    status, leaveTypeId, fromDate, toDate, limit = 10, offset = 0,
  } = filters;

  const where = {
    tenantId,
    employeeId,
  };

  if (status) {
    where.status = status;
  }

  if (leaveTypeId) {
    where.leaveTypeId = leaveTypeId;
  }

  if (fromDate || toDate) {
    where.startDate = {};
    if (fromDate) where.startDate.gte = fromDate;
    if (toDate) where.startDate.lte = toDate;
  }

  const [raw, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: {
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        approver: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { requests: raw.map(withRef), total };
}

export async function getTeamLeaveRequests(tenantId, managerEmployeeId, filters = {}) {
  const {
    status, leaveTypeId, fromDate, toDate, limit = 10, offset = 0, employeeId,
  } = filters;

  const where = {
    tenantId,
    ...(employeeId
      ? { employeeId }
      : { employee: { managerId: managerEmployeeId } }),
  };

  if (status) {
    where.status = status;
  }

  if (leaveTypeId) {
    where.leaveTypeId = leaveTypeId;
  }

  if (fromDate || toDate) {
    where.startDate = {};
    if (fromDate) where.startDate.gte = fromDate;
    if (toDate) where.startDate.lte = toDate;
  }

  const [raw, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        approver: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { requests: raw.map(withRef), total };
}

export async function updateLeaveBalance(tenantId, employeeId, leaveTypeId, data) {
  return prisma.leaveBalance.update({
    where: {
      tenantId_employeeId_leaveTypeId: {
        tenantId,
        employeeId,
        leaveTypeId,
      },
    },
    data,
  });
}

export async function getLeaveRequestsByDate(tenantId, startDate, endDate) {
  return prisma.leaveRequest.findMany({
    where: {
      tenantId,
      startDate: {
        lte: endDate,
      },
      endDate: {
        gte: startDate,
      },
      status: 'APPROVED',
    },
    include: {
      employee: {
        select: {
          id: true,
        },
      },
    },
  });
}
