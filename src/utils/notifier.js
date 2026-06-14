import { prisma } from '../plugins/prisma.js';
import { generateId } from './id.js';
import { emitToUsers, emitToUser } from './sseClients.js';

const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

async function getEmployeeContext(employeeId, tenantId) {
  const [employee, admins] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        manager: { select: { userId: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        tenantId,
        memberType: { in: ['HR_ADMIN', 'SUPER_ADMIN'] },
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true, memberType: true },
    }),
  ]);

  return {
    employeeUserId: employee?.userId || null,
    employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'An employee',
    managerUserId: employee?.manager?.userId || null,
    hrAdminUserIds: admins.filter((u) => u.memberType === 'HR_ADMIN').map((u) => u.id),
    superAdminUserIds: admins.filter((u) => u.memberType === 'SUPER_ADMIN').map((u) => u.id),
  };
}

async function saveAndEmit(tenantId, userIds, { type, title, message, metadata }) {
  const expiresAt = new Date(Date.now() + TTL_MS);
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;

  await Promise.all(
    unique.map((userId) =>
      prisma.notification
        .create({
          data: {
            id: generateId(),
            tenantId,
            userId,
            type,
            title,
            message,
            metadataJson: metadata || null,
            expiresAt,
          },
        })
        .then((n) => {
          emitToUser(n.userId, 'notification', {
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            createdAt: n.createdAt,
            metadata: n.metadataJson,
          });
        })
        .catch(() => {}),
    ),
  );
}

function emitAnalyticsRefresh(tenantId, adminUserIds) {
  emitToUsers(adminUserIds, 'analytics_update', { tenantId, ts: Date.now() });
}

// ── Public notifier functions ────────────────────────────────────────────────

export async function notifyLeaveRequested(tenantId, employeeId, leaveRequest) {
  const ctx = await getEmployeeContext(employeeId, tenantId);
  const targets = [ctx.managerUserId, ...ctx.hrAdminUserIds, ...ctx.superAdminUserIds];
  await saveAndEmit(tenantId, targets, {
    type: 'leave_requested',
    title: 'New Leave Request',
    message: `${ctx.employeeName} requested ${leaveRequest.totalDays} day(s) of ${leaveRequest.leaveType?.name || 'leave'}`,
    metadata: { leaveRequestId: leaveRequest.id, employeeId },
  });
  emitAnalyticsRefresh(tenantId, [...ctx.hrAdminUserIds, ...ctx.superAdminUserIds]);
}

export async function notifyLeaveApproved(tenantId, employeeId, leaveRequest) {
  const ctx = await getEmployeeContext(employeeId, tenantId);
  const targets = [ctx.employeeUserId];
  await saveAndEmit(tenantId, targets, {
    type: 'leave_approved',
    title: 'Leave Approved',
    message: `Your leave request for ${leaveRequest.totalDays} day(s) has been approved`,
    metadata: { leaveRequestId: leaveRequest.id },
  });
  emitAnalyticsRefresh(tenantId, [...ctx.hrAdminUserIds, ...ctx.superAdminUserIds]);
}

export async function notifyLeaveDenied(tenantId, employeeId, leaveRequest) {
  const ctx = await getEmployeeContext(employeeId, tenantId);
  const targets = [ctx.employeeUserId];
  await saveAndEmit(tenantId, targets, {
    type: 'leave_denied',
    title: 'Leave Denied',
    message: `Your leave request for ${leaveRequest.totalDays} day(s) has been denied`,
    metadata: { leaveRequestId: leaveRequest.id },
  });
  emitAnalyticsRefresh(tenantId, [...ctx.hrAdminUserIds, ...ctx.superAdminUserIds]);
}

export async function notifyLeaveWithdrawn(tenantId, employeeId, leaveRequest) {
  const ctx = await getEmployeeContext(employeeId, tenantId);
  const targets = [ctx.managerUserId, ...ctx.hrAdminUserIds, ...ctx.superAdminUserIds];
  await saveAndEmit(tenantId, targets, {
    type: 'leave_withdrawn',
    title: 'Leave Request Withdrawn',
    message: `${ctx.employeeName} has withdrawn their leave request`,
    metadata: { leaveRequestId: leaveRequest.id, employeeId },
  });
  emitAnalyticsRefresh(tenantId, [...ctx.hrAdminUserIds, ...ctx.superAdminUserIds]);
}

export async function notifyCheckIn(tenantId, employeeId, record) {
  const ctx = await getEmployeeContext(employeeId, tenantId);
  const targets = [ctx.employeeUserId, ctx.managerUserId, ...ctx.superAdminUserIds];
  await saveAndEmit(tenantId, targets, {
    type: 'attendance_checkin',
    title: 'Check-In Recorded',
    message: `${ctx.employeeName} checked in`,
    metadata: { attendanceId: record.id, employeeId },
  });
  emitAnalyticsRefresh(tenantId, [...ctx.hrAdminUserIds, ...ctx.superAdminUserIds]);
}

export async function notifyCheckOut(tenantId, employeeId, record) {
  const ctx = await getEmployeeContext(employeeId, tenantId);
  const targets = [ctx.employeeUserId, ctx.managerUserId, ...ctx.superAdminUserIds];
  await saveAndEmit(tenantId, targets, {
    type: 'attendance_checkout',
    title: 'Check-Out Recorded',
    message: `${ctx.employeeName} checked out after ${record.durationMinutes} minute(s)`,
    metadata: { attendanceId: record.id, employeeId },
  });
  emitAnalyticsRefresh(tenantId, [...ctx.hrAdminUserIds, ...ctx.superAdminUserIds]);
}

export async function notifyRegularizationRequested(tenantId, employeeId, request) {
  const ctx = await getEmployeeContext(employeeId, tenantId);
  const targets = [ctx.managerUserId, ...ctx.hrAdminUserIds, ...ctx.superAdminUserIds];
  await saveAndEmit(tenantId, targets, {
    type: 'regularization_requested',
    title: 'Attendance Regularization Request',
    message: `${ctx.employeeName} submitted an attendance regularization request`,
    metadata: { requestId: request.id, employeeId },
  });
}

export async function notifyRegularizationApproved(tenantId, employeeId, request) {
  const ctx = await getEmployeeContext(employeeId, tenantId);
  const targets = [ctx.employeeUserId];
  await saveAndEmit(tenantId, targets, {
    type: 'regularization_approved',
    title: 'Regularization Approved',
    message: 'Your attendance regularization request has been approved',
    metadata: { requestId: request.id },
  });
}

export async function notifyRegularizationDenied(tenantId, employeeId, request) {
  const ctx = await getEmployeeContext(employeeId, tenantId);
  const targets = [ctx.employeeUserId];
  await saveAndEmit(tenantId, targets, {
    type: 'regularization_denied',
    title: 'Regularization Denied',
    message: 'Your attendance regularization request has been denied',
    metadata: { requestId: request.id },
  });
}

// ── M7 Timesheet submit reminders (bulk, idempotent, scale-safe) ───────────────

// Build the canonical message for an employee submit reminder.
export function submitReminderMessage(weekStart, status) {
  return status === 'REJECTED'
    ? `Your timesheet for the week of ${weekStart} was rejected — please update and resubmit.`
    : `Your timesheet for the week of ${weekStart} is still a draft — please submit it.`;
}

// Bulk-create timesheet reminder notifications for one tenant.
// `rows` = [{ userId, type, title, message, weekStart, metadata }].
// Idempotency is guaranteed by a DB unique index on
// (tenantId, userId, type, metadataJson->>'weekStart') for the reminder types,
// so createMany({ skipDuplicates }) drops anything already sent this week — even
// under a double cron fire or two job instances racing. Returns rows actually created.
//
// Bulk insert (one round-trip) scales to large tenants; we deliberately do NOT emit
// one SSE event per row here (the bell badge + reminder banner refresh on the next
// poll). A single best-effort lightweight ping wakes any currently-connected clients.
export async function createTimesheetReminderNotifications(tenantId, rows) {
  const clean = (rows || []).filter((r) => r && r.userId);
  if (clean.length === 0) return 0;

  const expiresAt = new Date(Date.now() + TTL_MS);
  const data = clean.map((r) => ({
    id: generateId(),
    tenantId,
    userId: r.userId,
    type: r.type,
    title: r.title,
    message: r.message,
    metadataJson: { ...(r.metadata || {}), weekStart: r.weekStart },
    expiresAt,
  }));

  const { count } = await prisma.notification.createMany({ data, skipDuplicates: true });

  if (count > 0) {
    try {
      const userIds = [...new Set(clean.map((r) => r.userId))];
      emitToUsers(userIds, 'notification', { refresh: true, reason: 'timesheet_reminder' });
    } catch { /* SSE is best-effort — never let it fail the job */ }
  }
  return count;
}
