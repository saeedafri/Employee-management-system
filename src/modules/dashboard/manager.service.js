import { prisma } from '../../plugins/prisma.js';
import { successResponse, errorResponse } from '../../utils/response.js';
import { APPROVAL_TYPE_COLORS } from '../../utils/payrollUiShapes.js';

export async function getManagerDashboard(managerId, tenantId) {
  try {
    const manager = await prisma.employee.findUnique({
      where: { id: managerId },
      include: { user: { select: { email: true } } },
    });

    if (!manager) {
      return errorResponse('MANAGER_NOT_FOUND', 'Manager employee record not found', null);
    }

    // Get team size (direct reports)
    const teamSize = await prisma.employee.count({
      where: { managerId, tenantId, employmentStatus: 'ACTIVE' },
    });

    // Get pending approvals count
    const pendingLeaves = await prisma.leaveRequest.count({
      where: {
        tenantId,
        status: 'PENDING',
        employee: { managerId },
      },
    });

    const pendingRegularizations = await prisma.attendanceRegularizationRequest.count({
      where: {
        tenantId,
        status: 'PENDING',
        employee: { managerId },
      },
    });

    // Get today's team attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const teamAttendanceToday = await prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: {
        tenantId,
        attendanceDate: today,
        employee: { managerId },
      },
      _count: { id: true },
    });

    const attendanceSummary = {
      present: 0,
      absent: 0,
      leave: 0,
      wfh: 0,
      halfDay: 0,
      notMarked: teamSize,
    };

    for (const record of teamAttendanceToday) {
      const key = record.status.toLowerCase();
      if (key in attendanceSummary) {
        attendanceSummary[key] = record._count.id;
        attendanceSummary.notMarked -= record._count.id;
      }
    }

    return successResponse({
      managerName: `${manager.firstName} ${manager.lastName}`,
      teamSize,
      pendingApprovals: pendingLeaves + pendingRegularizations,
      approvalBreakdown: { leave: pendingLeaves, regularization: pendingRegularizations },
      presentToday: attendanceSummary.present,
      avgAttendancePercent: teamSize > 0 ? Math.round((attendanceSummary.present / teamSize) * 100) : 0,
      todayAttendance: attendanceSummary,
    }, { cached: false });
  } catch (error) {
    return errorResponse('DASHBOARD_ERROR', error.message, null);
  }
}

export async function getTeam(managerId, tenantId) {
  try {
    const team = await prisma.employee.findMany({
      where: {
        managerId,
        tenantId,
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        designation: true,
        department: { select: { name: true } },
        user: { select: { email: true, memberType: true } },
        employmentStatus: true,
        joinedOn: true,
      },
      orderBy: { employeeCode: 'asc' },
    });

    return successResponse(team, { cached: false });
  } catch (error) {
    return errorResponse('TEAM_FETCH_ERROR', error.message, null);
  }
}

export async function getTeamAttendance(managerId, tenantId, range = '30d') {
  try {
    const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[range] || 30;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days);

    // Get team members
    const team = await prisma.employee.findMany({
      where: { managerId, tenantId },
      select: { id: true },
    });
    const teamIds = team.map(t => t.id);

    if (teamIds.length === 0) {
      return successResponse({ range, series: [] }, { cached: false });
    }

    // Get attendance records for range
    const records = await prisma.attendanceRecord.groupBy({
      by: ['attendanceDate', 'status'],
      where: {
        tenantId,
        employeeId: { in: teamIds },
        attendanceDate: { gte: startDate, lte: today },
      },
      _count: { id: true },
    });

    // Build series
    const seriesMap = {};
    for (let d = 0; d < days; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      seriesMap[dateStr] = { date: dateStr, present: 0, absent: 0, leave: 0, wfh: 0, halfDay: 0 };
    }

    for (const record of records) {
      const dateStr = record.attendanceDate.toISOString().split('T')[0];
      const status = record.status.toLowerCase();
      if (dateStr in seriesMap && status in seriesMap[dateStr]) {
        seriesMap[dateStr][status] = record._count.id;
      }
    }

    const series = Object.values(seriesMap).reverse();

    return successResponse({ range, series }, { cached: false });
  } catch (error) {
    return errorResponse('ATTENDANCE_FETCH_ERROR', error.message, null);
  }
}

export async function getPendingApprovals(managerId, tenantId, { scope = 'team' } = {}) {
  try {
    if (scope === 'team') {
      const manager = await prisma.employee.findUnique({ where: { id: managerId } });
      if (!manager) {
        return errorResponse('MANAGER_NOT_FOUND', 'Manager not found', null);
      }
    }

    const teamFilter = scope === 'tenant' ? {} : { employee: { managerId } };

    const [pendingLeaves, pendingRegularizations, pendingTimesheets, pendingAssets] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { tenantId, status: 'PENDING', ...teamFilter },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          leaveType: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.attendanceRegularizationRequest.findMany({
        where: { tenantId, status: 'PENDING', ...teamFilter },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      (async () => {
        const where = { tenantId, status: 'SUBMITTED' };
        if (scope !== 'tenant' && managerId) {
          const teamIds = await prisma.employee.findMany({
            where: { tenantId, managerId, deletedAt: null },
            select: { id: true },
          });
          const ids = teamIds.map((e) => e.id);
          if (!ids.length) return [];
          where.employeeId = { in: ids };
        }
        const sheets = await prisma.timesheet.findMany({
          where,
          orderBy: { submittedAt: 'desc' },
          take: 50,
        });
        const empIds = [...new Set(sheets.map((s) => s.employeeId))];
        const emps = empIds.length
          ? await prisma.employee.findMany({
            where: { id: { in: empIds } },
            select: { id: true, firstName: true, lastName: true, employeeCode: true },
          })
          : [];
        const empMap = Object.fromEntries(emps.map((e) => [e.id, e]));
        return sheets.map((s) => ({ ...s, employee: empMap[s.employeeId] }));
      })().catch(() => []),
      prisma.assetRequest.findMany({
        where: { tenantId, status: 'Pending' },
        orderBy: { requestedAt: 'desc' },
        take: 50,
      }).catch(() => []),
    ]);

    const leaveRequests = pendingLeaves.map((l) => ({
      id: l.id,
      type: 'leave',
      color: APPROVAL_TYPE_COLORS.leave,
      employeeId: l.employee.id,
      employeeCode: l.employee.employeeCode,
      employeeName: `${l.employee.firstName} ${l.employee.lastName}`,
      leaveType: l.leaveType.name,
      title: 'Leave request',
      subtitle: l.leaveType.name,
      startDate: l.startDate,
      endDate: l.endDate,
      totalDays: l.totalDays,
      reason: l.reason,
      status: l.status,
      submittedAt: l.createdAt,
    }));

    const regularizationRequests = pendingRegularizations.map((r) => ({
      id: r.id,
      type: 'regularization',
      color: APPROVAL_TYPE_COLORS.regularization,
      employeeId: r.employee.id,
      employeeCode: r.employee.employeeCode,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      title: 'Attendance regularization',
      subtitle: r.attendanceDate?.toISOString?.().split('T')[0] ?? r.attendanceDate,
      attendanceDate: r.attendanceDate,
      reason: r.reason,
      status: r.status,
      submittedAt: r.createdAt,
    }));

    const timesheetRequests = pendingTimesheets.map((t) => ({
      id: t.id,
      type: 'timesheet',
      color: APPROVAL_TYPE_COLORS.timesheet,
      employeeId: t.employee.id,
      employeeCode: t.employee.employeeCode,
      employeeName: `${t.employee.firstName} ${t.employee.lastName}`,
      title: 'Timesheet approval',
      subtitle: `${t.weekStart} – ${t.weekEnd}`,
      weekStart: t.weekStart,
      weekEnd: t.weekEnd,
      totalHours: Number(t.totalHours ?? 0),
      status: t.status,
      submittedAt: t.submittedAt ?? t.updatedAt,
    }));

    const assetRequests = pendingAssets.map((a) => ({
      id: a.id,
      type: 'asset',
      color: APPROVAL_TYPE_COLORS.asset,
      employeeId: a.requestedById,
      employeeCode: null,
      employeeName: a.requestedByName ?? 'Unknown',
      title: 'Asset request',
      subtitle: a.item ?? 'Asset',
      status: a.status,
      submittedAt: a.requestedAt,
    }));

    const items = [
      ...leaveRequests,
      ...regularizationRequests,
      ...timesheetRequests,
      ...assetRequests,
    ].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    return successResponse({
      items,
      leaveRequests,
      regularizationRequests,
      timesheetRequests,
      assetRequests,
      total: items.length,
      approvalBreakdown: {
        leave: leaveRequests.length,
        regularization: regularizationRequests.length,
        timesheet: timesheetRequests.length,
        asset: assetRequests.length,
      },
    }, { cached: false });
  } catch (error) {
    return errorResponse('PENDING_APPROVALS_ERROR', error.message, null);
  }
}

export async function approveLeaveRequest(managerId, leaveRequestId, tenantId, decision, comment = '') {
  try {
    // Verify manager has authority to approve this request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      include: { employee: true },
    });

    if (!leaveRequest) {
      return errorResponse('LEAVE_NOT_FOUND', 'Leave request not found', null);
    }

    if (leaveRequest.tenantId !== tenantId) {
      return errorResponse('UNAUTHORIZED', 'Tenant mismatch', null);
    }

    if (leaveRequest.employee.managerId !== managerId) {
      return errorResponse('FORBIDDEN', 'Not authorized to approve this leave request', null);
    }

    if (leaveRequest.status !== 'PENDING') {
      return errorResponse('INVALID_STATE', 'Leave request is not pending', null);
    }

    const status = decision === 'approve' ? 'APPROVED' : 'DENIED';

    const updated = await prisma.leaveRequest.update({
      where: { id: leaveRequestId },
      data: {
        status,
        approverId: managerId,
        approverComment: comment || null,
        decidedAt: new Date(),
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId: null,
        action: decision === 'approve' ? 'LEAVE_APPROVED' : 'LEAVE_DENIED',
        entityType: 'LeaveRequest',
        entityId: leaveRequestId,
        oldValuesJson: JSON.stringify({ status: 'PENDING' }),
        newValuesJson: JSON.stringify({ status }),
      },
    }).catch(() => undefined);

    return successResponse({ id: updated.id, status }, { cached: false });
  } catch (error) {
    return errorResponse('APPROVAL_ERROR', error.message, null);
  }
}

export async function approveRegularizationRequest(managerId, requestId, tenantId, decision, comment = '') {
  try {
    const request = await prisma.attendanceRegularizationRequest.findUnique({
      where: { id: requestId },
      include: { employee: true },
    });

    if (!request) {
      return errorResponse('REQUEST_NOT_FOUND', 'Regularization request not found', null);
    }

    if (request.tenantId !== tenantId) {
      return errorResponse('UNAUTHORIZED', 'Tenant mismatch', null);
    }

    if (request.employee.managerId !== managerId) {
      return errorResponse('FORBIDDEN', 'Not authorized to approve this request', null);
    }

    if (request.status !== 'PENDING') {
      return errorResponse('INVALID_STATE', 'Request is not pending', null);
    }

    const status = decision === 'approve' ? 'APPROVED' : 'DENIED';

    const updated = await prisma.attendanceRegularizationRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewerId: managerId,
        reviewerComment: comment || null,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId: null,
        action: decision === 'approve' ? 'REGULARIZATION_APPROVED' : 'REGULARIZATION_DENIED',
        entityType: 'AttendanceRegularizationRequest',
        entityId: requestId,
        oldValuesJson: JSON.stringify({ status: 'PENDING' }),
        newValuesJson: JSON.stringify({ status }),
      },
    }).catch(() => undefined);

    return successResponse({ id: updated.id, status }, { cached: false });
  } catch (error) {
    return errorResponse('APPROVAL_ERROR', error.message, null);
  }
}
