import * as repo from './employees.repository.js';
import { prisma } from '../../plugins/prisma.js';
import { successResponse, errorResponse } from '../../utils/response.js';
import { recordAuditLog } from '../auditLogs/auditLogs.service.js';
import { createAndSendInvite } from '../auth/invitation.service.js';
import { generateSecureToken } from '../../utils/token.js';
import { hashSHA256 } from '../../utils/hash.js';
import { generateId } from '../../utils/id.js';
import { config } from '../../config/index.js';
import { sendInviteEmail } from '../../jobs/emailJob.js';
import {
  validateDepartmentPath,
  loadAllDeptsByTenant,
  walkPath,
  getDescendantIds,
  formatEmployeeForApi,
} from './employeeDepartmentPath.js';

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (local.length <= 3) return `${local[0]}${'*'.repeat(Math.max(0, local.length - 2))}${local[local.length - 1] ?? ''}@${domain}`;
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

function deptPathError(message) {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: [{ field: 'departmentId', message }],
    },
  };
}

export async function listEmployees(tenantId, filters) {
  try {
    const allDeptsById = await loadAllDeptsByTenant(tenantId);

    const repoFilters = { ...filters };
    if (filters.departmentId) {
      repoFilters.departmentIds = getDescendantIds(allDeptsById, filters.departmentId);
      delete repoFilters.departmentId;
    }

    const result = await repo.listEmployees(tenantId, repoFilters);
    const formatted = result.data.map(emp => formatEmployeeForApi(emp, walkPath(allDeptsById, emp.departmentId)));
    return successResponse({ data: formatted, pagination: result.pagination }, { cached: false });
  } catch (error) {
    return errorResponse('LIST_ERROR', error.message, null);
  }
}

export async function getEmployee(employeeId, tenantId, { includeTerminated = false } = {}) {
  try {
    const employee = await repo.getEmployeeById(employeeId, tenantId, { includeTerminated });
    if (!employee) {
      return errorResponse('NOT_FOUND', 'Employee not found', null);
    }
    const allDeptsById = await loadAllDeptsByTenant(tenantId);
    return successResponse(formatEmployeeForApi(employee, walkPath(allDeptsById, employee.departmentId)), { cached: false });
  } catch (error) {
    return errorResponse('FETCH_ERROR', error.message, null);
  }
}

export async function getNextEmployeeCode(tenantId) {
  try {
    const code = await generateEmployeeCode(tenantId);
    return successResponse({ code }, { cached: false });
  } catch (error) {
    return errorResponse('FETCH_ERROR', error.message, null);
  }
}

async function generateEmployeeCode(tenantId) {
  const count = await repo.countEmployees(tenantId);
  let attempt = count + 1;
  let code = `E${String(attempt).padStart(4, '0')}`;
  while (await repo.checkEmployeeCodeExists(code, tenantId)) {
    attempt += 1;
    code = `E${String(attempt).padStart(4, '0')}`;
  }
  return code;
}

export async function createEmployee(tenantId, data, userId) {
  try {
    let leafDepartmentId;
    let departmentPath;
    try {
      const result = await validateDepartmentPath(tenantId, data.departmentId);
      leafDepartmentId = result.leafDepartmentId;
      departmentPath = result.path;
    } catch (pathErr) {
      return deptPathError(pathErr.message);
    }

    if (!data.employeeCode) {
      data.employeeCode = await generateEmployeeCode(tenantId);
    }

    const codeExists = await repo.checkEmployeeCodeExists(data.employeeCode, tenantId);
    if (codeExists) {
      return errorResponse('DUPLICATE_EMPLOYEE_CODE', 'Employee code already exists', null);
    }

    const emailExists = await repo.checkWorkEmailExists(data.workEmail, tenantId);
    if (emailExists) {
      return errorResponse('DUPLICATE_WORK_EMAIL', 'Work email already exists', null);
    }

    const { sendInvite = false, emailTarget, memberType = 'EMPLOYEE', ...employeeData } = data;

    // Pre-resolve invite targets outside transaction (read-only queries)
    let resolvedEmailTarget, deliveryEmail, companyName;
    if (sendInvite) {
      if (emailTarget) {
        resolvedEmailTarget = emailTarget;
      } else {
        const cfg = await prisma.tenantConfig.findUnique({ where: { tenantId }, select: { inviteEmailTarget: true } });
        resolvedEmailTarget = cfg?.inviteEmailTarget ?? 'PERSONAL';
      }
      deliveryEmail = resolvedEmailTarget === 'WORK' ? (employeeData.workEmail ?? null) : (employeeData.personalEmail ?? null);

      const cfg = await prisma.tenantConfig.findUnique({ where: { tenantId }, select: { companyName: true } });
      if (cfg?.companyName) {
        companyName = cfg.companyName;
      } else {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
        companyName = tenant?.name ?? 'Your Company';
      }
    }

    // Atomic: employee + user + invite token in one transaction
    let employee, inviteCoreResult;
    const employeeCreateData = { tenantId, ...employeeData, departmentId: leafDepartmentId, createdBy: userId, updatedBy: userId };
    const employeeInclude = {
      department: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
    };

    await prisma.$transaction(async (tx) => {
      employee = await tx.employee.create({ data: employeeCreateData, include: employeeInclude });

      if (sendInvite && deliveryEmail) {
        const newUser = await tx.user.create({
          data: { id: generateId(), tenantId, email: employee.workEmail, passwordHash: '', memberType, status: 'INVITED', employeeId: employee.id },
        });
        await tx.employee.update({ where: { id: employee.id }, data: { userId: newUser.id } });
        await tx.userInvitation.updateMany({
          where: { userId: newUser.id, tenantId, usedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        const rawToken = generateSecureToken();
        const tokenHash = hashSHA256(rawToken);
        const expiresAt = new Date(Date.now() + config.inviteTokenTtlHours * 60 * 60 * 1000);
        await tx.userInvitation.create({
          data: { id: generateId(), tenantId, employeeId: employee.id, userId: newUser.id, tokenHash, emailTarget: resolvedEmailTarget, email: deliveryEmail, expiresAt, createdById: userId ?? null },
        });
        inviteCoreResult = { user: newUser, rawToken, expiresAt };
      }
    }, { timeout: 30000, maxWait: 10000 });

    // Post-transaction: send email (failure doesn't roll back the employee/user/token)
    let inviteForResponse = null;
    if (sendInvite) {
      if (!deliveryEmail) {
        inviteForResponse = { sent: false, reason: 'NO_DELIVERY_EMAIL', sentTo: resolvedEmailTarget };
      } else {
        const activationUrl = `${config.frontendAppUrl}/set-password?token=${inviteCoreResult.rawToken}`;
        const emailResult = await sendInviteEmail(deliveryEmail, {
          employeeFirstName: employee.firstName,
          companyName,
          activationUrl,
          expiresAt: inviteCoreResult.expiresAt.toUTCString(),
          supportEmail: config.supportEmail,
        });

        await prisma.auditLog.create({
          data: { tenantId, actorUserId: userId ?? null, action: 'INVITE_SENT', entityType: 'UserInvitation', entityId: inviteCoreResult.user.id, newValuesJson: { employeeId: employee.id, emailTarget: resolvedEmailTarget } },
        }).catch(() => {});

        if (!emailResult.success) {
          await prisma.auditLog.create({
            data: { tenantId, actorUserId: userId ?? null, action: 'INVITE_EMAIL_FAILED', entityType: 'UserInvitation', entityId: inviteCoreResult.user.id, newValuesJson: { reason: emailResult.error ?? emailResult.reason } },
          }).catch(() => {});
        }

        inviteForResponse = {
          sent: emailResult.success,
          sentTo: resolvedEmailTarget,
          email: maskEmail(deliveryEmail),
          expiresAt: inviteCoreResult.expiresAt.toISOString(),
          user: { id: inviteCoreResult.user.id, email: inviteCoreResult.user.email, memberType: inviteCoreResult.user.memberType, status: 'INVITED' },
          ...(emailResult.success ? {} : { reason: 'EMAIL_SEND_FAILED' }),
        };
      }
    }

    const formatted = formatEmployeeForApi(employee, departmentPath);
    if (sendInvite) {
      formatted.user = inviteForResponse?.user ?? null;
      formatted.invite = inviteForResponse;
    }
    return successResponse(formatted, { cached: false });
  } catch (error) {
    return errorResponse('CREATE_ERROR', error.message, null);
  }
}

export async function sendEmployeeInvite(employeeId, tenantId, emailTarget, actorId) {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
    });
    if (!employee) return errorResponse('EMPLOYEE_NOT_FOUND', 'Employee not found', null, 404);

    if (employee.employmentStatus === 'TERMINATED') {
      return errorResponse('EMPLOYEE_TERMINATED', 'Cannot invite a terminated employee', null, 409);
    }

    // Rate limit: max 3 invites per hour per employee
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.userInvitation.count({
      where: { employeeId, tenantId, createdAt: { gte: oneHourAgo } },
    });
    if (recentCount >= 3) {
      return errorResponse('RATE_LIMITED', 'Too many invite sends. Try again later.', null, 429);
    }

    // Check if already ACTIVE
    if (employee.userId) {
      const user = await prisma.user.findUnique({ where: { id: employee.userId } });
      if (user?.status === 'ACTIVE') {
        return errorResponse('ALREADY_ACTIVE', 'User is already active', null, 409);
      }
    }

    const inviteResult = await createAndSendInvite(tenantId, employee, emailTarget ?? null, actorId);

    if (!inviteResult.success) {
      const statusMap = { NO_DELIVERY_EMAIL: 422, ALREADY_ACTIVE: 409 };
      return errorResponse(inviteResult.code, inviteResult.message, null, statusMap[inviteResult.code] ?? 400);
    }

    return successResponse({
      sent: inviteResult.sent,
      sentTo: inviteResult.sentTo,
      email: inviteResult.email,
      expiresAt: inviteResult.expiresAt,
      ...(inviteResult.reason ? { reason: inviteResult.reason } : {}),
    }, { cached: false });
  } catch (error) {
    return errorResponse('INVITE_ERROR', error.message, null);
  }
}

export async function updateEmployee(employeeId, tenantId, data, userId) {
  try {
    const [existing, allDeptsById] = await Promise.all([
      repo.getEmployeeById(employeeId, tenantId),
      loadAllDeptsByTenant(tenantId),
    ]);

    if (!existing) {
      return errorResponse('NOT_FOUND', 'Employee not found', null);
    }

    let updateData = { ...data };

    if (updateData.departmentId !== undefined) {
      try {
        const { leafDepartmentId } = await validateDepartmentPath(tenantId, updateData.departmentId);
        updateData.departmentId = leafDepartmentId;
      } catch (pathErr) {
        return deptPathError(pathErr.message);
      }
    }

    if (updateData.employeeCode && updateData.employeeCode !== existing.employeeCode) {
      const codeExists = await repo.checkEmployeeCodeExists(updateData.employeeCode, tenantId, employeeId);
      if (codeExists) {
        return errorResponse('DUPLICATE_EMPLOYEE_CODE', 'Employee code already exists', null);
      }
    }

    if (updateData.workEmail && updateData.workEmail !== existing.workEmail) {
      const emailExists = await repo.checkWorkEmailExists(updateData.workEmail, tenantId, employeeId);
      if (emailExists) {
        return errorResponse('DUPLICATE_WORK_EMAIL', 'Work email already exists', null);
      }
    }

    const employee = await repo.updateEmployee(employeeId, tenantId, {
      ...updateData,
      updatedBy: userId,
    });

    await recordAuditLog(
      tenantId,
      userId,
      'EMPLOYEE_UPDATED',
      'Employee',
      employeeId,
      { designation: existing.designation, phone: existing.phone },
      { designation: employee.designation, phone: employee.phone },
    ).catch(() => {});

    return successResponse(formatEmployeeForApi(employee, walkPath(allDeptsById, employee.departmentId)), { cached: false });
  } catch (error) {
    return errorResponse('UPDATE_ERROR', error.message, null);
  }
}

export async function deleteEmployee(employeeId, tenantId) {
  try {
    const existing = await repo.getEmployeeById(employeeId, tenantId);
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Employee not found', null);
    }

    const [managedCount, deptHeadCount] = await Promise.all([
      prisma.employee.count({ where: { managerId: employeeId, tenantId, deletedAt: null } }),
      prisma.department.count({ where: { headEmployeeId: employeeId, tenantId, deletedAt: null } }),
    ]);

    if (managedCount > 0 || deptHeadCount > 0) {
      return errorResponse(
        'EMPLOYEE_HAS_DEPENDENTS',
        'Reassign direct reports and department head roles before deleting this employee',
        { managedEmployees: managedCount, departmentsHeaded: deptHeadCount },
      );
    }

    const deleted = await repo.softDeleteEmployee(employeeId, tenantId);
    return successResponse({ id: deleted.id, status: 'TERMINATED' }, { cached: false });
  } catch (error) {
    return errorResponse('DELETE_ERROR', error.message, null);
  }
}

export async function exportEmployees(tenantId) {
  try {
    const employees = await repo.exportEmployeesCsv(tenantId);
    return successResponse(employees, { cached: false });
  } catch (error) {
    return errorResponse('EXPORT_ERROR', error.message, null);
  }
}

export async function getEmployeeActivity(employeeId, tenantId, { limit = 50 } = {}) {
  try {
    const employee = await repo.getEmployeeById(employeeId, tenantId);
    if (!employee) return errorResponse('NOT_FOUND', 'Employee not found', null);

    const [auditLogs, leaveEvents, docs] = await Promise.all([
      prisma.auditLog.findMany({
        where: { tenantId, entityId: employeeId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { actor: { select: { email: true } } },
      }),
      prisma.leaveRequest.findMany({
        where: { tenantId, employeeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { leaveType: { select: { name: true } } },
      }),
      prisma.employeeDocument.findMany({
        where: { tenantId, employeeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const fromAudit = auditLogs.map((log) => ({
      id: log.id,
      type: 'audit',
      action: log.action,
      actionLabel: log.action?.replace(/_/g, ' ').toLowerCase(),
      description: `${log.action} on ${log.entityType}`,
      actorEmail: log.actor?.email ?? null,
      entityType: log.entityType,
      entityId: log.entityId,
      color: '#64748b',
      createdAt: log.createdAt,
      timestamp: log.createdAt,
    }));

    const fromLeave = leaveEvents.map((l) => ({
      id: l.id,
      type: 'leave',
      action: l.status,
      actionLabel: `Leave ${l.status.toLowerCase()}`,
      description: `${l.leaveType?.name ?? 'Leave'} — ${l.totalDays} day(s)`,
      color: '#3b82f6',
      createdAt: l.createdAt,
      timestamp: l.createdAt,
    }));

    const fromDocs = docs.map((d) => ({
      id: d.id,
      type: 'document',
      action: 'UPLOADED',
      actionLabel: 'Document uploaded',
      description: d.fileName ?? d.documentType ?? 'Document',
      color: '#0d9488',
      createdAt: d.createdAt,
      timestamp: d.createdAt,
      fileUrl: d.fileUrl,
    }));

    const items = [...fromAudit, ...fromLeave, ...fromDocs]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);

    return successResponse({ items, total: items.length }, { cached: false });
  } catch (error) {
    return errorResponse('ACTIVITY_FETCH_ERROR', error.message, null);
  }
}
