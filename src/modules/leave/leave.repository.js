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
  return prisma.leaveRequest.create({
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
}

export async function updateLeaveRequest(tenantId, leaveRequestId, data) {
  return prisma.leaveRequest.update({
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

  const [requests, total] = await Promise.all([
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

  return { requests, total };
}

export async function getTeamLeaveRequests(tenantId, managerEmployeeId, filters = {}) {
  const {
    status, leaveTypeId, fromDate, toDate, limit = 10, offset = 0,
  } = filters;

  const where = {
    tenantId,
    employee: {
      managerId: managerEmployeeId,
    },
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

  const [requests, total] = await Promise.all([
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

  return { requests, total };
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
