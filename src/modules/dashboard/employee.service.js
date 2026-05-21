import { prisma } from '../../plugins/prisma.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export async function getEmployeeDashboard(employeeId, tenantId) {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: { select: { email: true, memberType: true } },
        department: { select: { name: true } },
      },
    });

    if (!employee) {
      return errorResponse('EMPLOYEE_NOT_FOUND', 'Employee not found', null);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's attendance
    const todayAttendance = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        tenantId,
        attendanceDate: today,
      },
    });

    // Get pending leave requests count
    const pendingLeaves = await prisma.leaveRequest.count({
      where: {
        employeeId,
        tenantId,
        status: 'PENDING',
      },
    });

    // Get upcoming leave
    const upcomingLeave = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        tenantId,
        status: { in: ['APPROVED', 'PENDING'] },
        startDate: { gte: today },
      },
      select: { startDate: true, endDate: true, leaveType: { select: { name: true } } },
      orderBy: { startDate: 'asc' },
    });

    return successResponse({
      employeeName: `${employee.firstName} ${employee.lastName}`,
      designation: employee.designation,
      department: employee.department?.name,
      todayAttendance: todayAttendance ? {
        status: todayAttendance.status,
        checkInAt: todayAttendance.checkInAt,
        checkOutAt: todayAttendance.checkOutAt,
      } : null,
      pendingLeaves,
      upcomingLeave: upcomingLeave ? {
        leaveType: upcomingLeave.leaveType.name,
        startDate: upcomingLeave.startDate,
        endDate: upcomingLeave.endDate,
      } : null,
    }, { cached: false });
  } catch (error) {
    return errorResponse('DASHBOARD_ERROR', error.message, null);
  }
}

export async function getEmployeeToday(employeeId, tenantId) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        tenantId,
        attendanceDate: today,
      },
    });

    if (!attendance) {
      return successResponse({
        date: today,
        status: 'NOT_MARKED',
        checkInAt: null,
        checkOutAt: null,
        duration: null,
      }, { cached: false });
    }

    let duration = null;
    if (attendance.checkInAt && attendance.checkOutAt) {
      duration = Math.round((attendance.checkOutAt - attendance.checkInAt) / (1000 * 60)); // minutes
    }

    return successResponse({
      date: today,
      status: attendance.status,
      checkInAt: attendance.checkInAt,
      checkOutAt: attendance.checkOutAt,
      duration,
    }, { cached: false });
  } catch (error) {
    return errorResponse('ERROR', error.message, null);
  }
}

export async function checkIn(employeeId, tenantId) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        tenantId,
        attendanceDate: today,
      },
    });

    const now = new Date();

    if (!attendance) {
      attendance = await prisma.attendanceRecord.create({
        data: {
          employeeId,
          tenantId,
          attendanceDate: today,
          checkInAt: now,
          status: 'PRESENT',
        },
      });
    } else if (!attendance.checkInAt) {
      attendance = await prisma.attendanceRecord.update({
        where: { id: attendance.id },
        data: { checkInAt: now, status: 'PRESENT' },
      });
    }

    return successResponse({
      checkInAt: attendance.checkInAt,
      message: 'Check-in successful',
    }, { cached: false });
  } catch (error) {
    return errorResponse('CHECK_IN_ERROR', error.message, null);
  }
}

export async function checkOut(employeeId, tenantId) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        tenantId,
        attendanceDate: today,
      },
    });

    if (!attendance) {
      return errorResponse('NO_CHECK_IN', 'No check-in record found for today', null);
    }

    const now = new Date();

    const updated = await prisma.attendanceRecord.update({
      where: { id: attendance.id },
      data: { checkOutAt: now },
    });

    const duration = Math.round((now - attendance.checkInAt) / (1000 * 60));

    return successResponse({
      checkOutAt: updated.checkOutAt,
      duration,
      message: 'Check-out successful',
    }, { cached: false });
  } catch (error) {
    return errorResponse('CHECK_OUT_ERROR', error.message, null);
  }
}

export async function getLeaveBalance(employeeId, tenantId) {
  try {
    const balances = await prisma.leaveBalance.findMany({
      where: { employeeId, tenantId },
      include: { leaveType: { select: { name: true, code: true } } },
    });

    return successResponse(
      balances.map(b => ({
        leaveType: b.leaveType.name,
        code: b.leaveType.code,
        balance: b.balance,
        used: b.used,
        pending: b.pending,
        available: b.balance - b.used,
      })),
      { cached: false },
    );
  } catch (error) {
    return errorResponse('ERROR', error.message, null);
  }
}

export async function getHolidays(tenantId) {
  try {
    const holidays = await prisma.holiday.findMany({
      where: { tenantId },
      select: { name: true, holidayDate: true, isOptional: true },
      orderBy: { holidayDate: 'asc' },
    });

    return successResponse(holidays, { cached: false });
  } catch (error) {
    return errorResponse('ERROR', error.message, null);
  }
}

export async function getDocuments(employeeId, tenantId) {
  try {
    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId, tenantId },
      select: {
        id: true,
        documentType: true,
        fileName: true,
        fileUrl: true,
        mimeType: true,
        sizeBytes: true,
        verificationStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(documents, { cached: false });
  } catch (error) {
    return errorResponse('ERROR', error.message, null);
  }
}

export async function getEmployeeTeam(employeeId, tenantId) {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { managerId: true, departmentId: true },
    });

    if (!employee) {
      return errorResponse('EMPLOYEE_NOT_FOUND', 'Employee not found', null);
    }

    // Get manager
    let manager = null;
    if (employee.managerId) {
      manager = await prisma.employee.findUnique({
        where: { id: employee.managerId },
        select: {
          firstName: true,
          lastName: true,
          designation: true,
          user: { select: { email: true } },
        },
      });
    }

    // Get peers (same department, excluding self)
    const peers = await prisma.employee.findMany({
      where: {
        departmentId: employee.departmentId,
        tenantId,
        id: { not: employeeId },
      },
      select: {
        firstName: true,
        lastName: true,
        designation: true,
        user: { select: { email: true } },
      },
      orderBy: { employeeCode: 'asc' },
      take: 10,
    });

    return successResponse({
      manager: manager ? {
        name: `${manager.firstName} ${manager.lastName}`,
        designation: manager.designation,
        email: manager.user?.email,
      } : null,
      peers: peers.map(p => ({
        name: `${p.firstName} ${p.lastName}`,
        designation: p.designation,
        email: p.user?.email,
      })),
    }, { cached: false });
  } catch (error) {
    return errorResponse('ERROR', error.message, null);
  }
}
