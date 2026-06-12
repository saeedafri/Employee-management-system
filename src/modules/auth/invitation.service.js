import { prisma } from '../../plugins/prisma.js';
import { hashPassword } from '../../utils/hash.js';
import { hashSHA256 } from '../../utils/hash.js';
import { generateSecureToken } from '../../utils/token.js';
import { generateId } from '../../utils/id.js';
import { config } from '../../config/index.js';
import { sendInviteEmail } from '../../jobs/emailJob.js';
import { logger } from '../../utils/logger.js';

const INVITE_TTL_MS = () => config.inviteTokenTtlHours * 60 * 60 * 1000;

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (local.length <= 3) {
    return `${local[0]}${'*'.repeat(Math.max(0, local.length - 2))}${local[local.length - 1] ?? ''}@${domain}`;
  }
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

async function getInviteEmailTarget(tenantId) {
  const cfg = await prisma.tenantConfig.findUnique({ where: { tenantId }, select: { inviteEmailTarget: true } });
  return cfg?.inviteEmailTarget ?? 'PERSONAL';
}

async function getCompanyName(tenantId) {
  const cfg = await prisma.tenantConfig.findUnique({ where: { tenantId }, select: { companyName: true } });
  if (cfg?.companyName) return cfg.companyName;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  return tenant?.name ?? 'Your Company';
}

function resolveEmailAddress(employee, emailTarget) {
  if (emailTarget === 'WORK') return employee.workEmail ?? null;
  return employee.personalEmail ?? null;
}

async function invalidatePriorInvites(userId, tenantId) {
  await prisma.userInvitation.updateMany({
    where: { userId, tenantId, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function createInviteToken(tenantId, employeeId, userId, emailTarget, email, createdById) {
  const rawToken = generateSecureToken();
  const tokenHash = hashSHA256(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS());

  await prisma.userInvitation.create({
    data: {
      id: generateId(),
      tenantId,
      employeeId,
      userId,
      tokenHash,
      emailTarget,
      email,
      expiresAt,
      createdById: createdById ?? null,
    },
  });

  return { rawToken, expiresAt };
}

async function dispatchInviteEmail(to, { employeeFirstName, companyName, rawToken, expiresAt }) {
  const activationUrl = `${config.frontendSetPasswordUrl}?token=${rawToken}`;
  const expiresAtStr = expiresAt.toUTCString();
  try {
    const result = await sendInviteEmail(to, {
      employeeFirstName,
      companyName,
      activationUrl,
      expiresAt: expiresAtStr,
      supportEmail: config.smtpFrom,
    });
    return result;
  } catch (err) {
    logger.error({ type: 'invite_email_failed', error: err.message });
    return { success: false, error: err.message };
  }
}

async function writeAuditLog(tenantId, actorUserId, action, entityId, extra = {}) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      actorUserId: actorUserId ?? null,
      action,
      entityType: 'UserInvitation',
      entityId,
      newValuesJson: Object.keys(extra).length > 0 ? extra : undefined,
    },
  }).catch(() => {});
}

/**
 * Core: create/link User (INVITED), invalidate old invites, issue token, send email.
 * Used by POST /employees (sendInvite=true) and POST /employees/:id/invite.
 */
export async function createAndSendInvite(tenantId, employee, emailTargetOverride, createdById) {
  const emailTarget = emailTargetOverride ?? (await getInviteEmailTarget(tenantId));
  const email = resolveEmailAddress(employee, emailTarget);

  if (!email) {
    return {
      success: false,
      code: 'NO_DELIVERY_EMAIL',
      message: `Employee has no ${emailTarget === 'WORK' ? 'work' : 'personal'} email for invite delivery`,
    };
  }

  const companyName = await getCompanyName(tenantId);

  // Create or find linked User
  let user;
  if (employee.userId) {
    user = await prisma.user.findUnique({ where: { id: employee.userId } });
    if (!user) {
      return { success: false, code: 'USER_NOT_FOUND', message: 'Linked user not found' };
    }
    if (user.status === 'ACTIVE') {
      return { success: false, code: 'ALREADY_ACTIVE', message: 'User is already active' };
    }
  } else {
    // Create a new User linked to this employee
    user = await prisma.user.create({
      data: {
        id: generateId(),
        tenantId,
        email: employee.workEmail,
        passwordHash: '',
        memberType: 'EMPLOYEE',
        status: 'INVITED',
        employeeId: employee.id,
      },
    });
    // Link employee → user
    await prisma.employee.update({ where: { id: employee.id }, data: { userId: user.id } });
  }

  // Ensure user is INVITED status
  if (user.status !== 'INVITED') {
    await prisma.user.update({ where: { id: user.id }, data: { status: 'INVITED' } });
  }

  // Invalidate prior unused invites
  await invalidatePriorInvites(user.id, tenantId);

  // Issue new token
  const { rawToken, expiresAt } = await createInviteToken(
    tenantId, employee.id, user.id, emailTarget, email, createdById,
  );

  await writeAuditLog(tenantId, createdById, 'INVITE_SENT', user.id, { employeeId: employee.id, emailTarget });

  // Send email (non-blocking for the happy path — failure doesn't roll back)
  const emailResult = await dispatchInviteEmail(email, {
    employeeFirstName: employee.firstName,
    companyName,
    rawToken,
    expiresAt,
  });

  if (!emailResult.success) {
    await writeAuditLog(tenantId, createdById, 'INVITE_EMAIL_FAILED', user.id, { reason: emailResult.error ?? emailResult.reason });
  }

  return {
    success: true,
    sent: emailResult.success,
    sentTo: emailTarget,
    email: maskEmail(email),
    expiresAt: expiresAt.toISOString(),
    reason: emailResult.success ? undefined : 'EMAIL_SEND_FAILED',
    user: { id: user.id, email: user.email, memberType: user.memberType, status: 'INVITED' },
  };
}

/**
 * GET /auth/invitation?token= — validate token, return minimal display info.
 */
export async function validateInvitationToken(rawToken) {
  if (!rawToken) return { status: 'NOT_FOUND' };

  const tokenHash = hashSHA256(rawToken);
  const invitation = await prisma.userInvitation.findUnique({
    where: { tokenHash },
    include: {
      employee: { select: { firstName: true } },
      user: { select: { tenantId: true } },
    },
  });

  if (!invitation) return { status: 'NOT_FOUND' };
  if (invitation.usedAt) return { status: 'USED' };
  if (invitation.revokedAt) return { status: 'USED' };
  if (new Date() > invitation.expiresAt) return { status: 'EXPIRED' };

  const companyName = await getCompanyName(invitation.tenantId);

  return {
    status: 'VALID',
    employee: { firstName: invitation.employee.firstName, companyName },
    expiresAt: invitation.expiresAt.toISOString(),
  };
}

function validatePasswordStrength(password) {
  const errors = [];
  if (!password || password.length < 8) errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  if (!/[A-Z]/.test(password)) errors.push({ field: 'password', message: 'Password must contain at least one uppercase letter' });
  if (!/[a-z]/.test(password)) errors.push({ field: 'password', message: 'Password must contain at least one lowercase letter' });
  if (!/\d/.test(password)) errors.push({ field: 'password', message: 'Password must contain at least one number' });
  return errors;
}

/**
 * POST /auth/accept-invitation — validate token, set password, activate user.
 */
export async function acceptInvitation(rawToken, password) {
  const passwordErrors = validatePasswordStrength(password);
  if (passwordErrors.length > 0) {
    return { success: false, code: 'WEAK_PASSWORD', details: passwordErrors };
  }

  const tokenHash = hashSHA256(rawToken);
  const invitation = await prisma.userInvitation.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!invitation) return { success: false, code: 'INVALID_TOKEN' };
  if (invitation.usedAt) return { success: false, code: 'INVITE_ALREADY_USED' };
  if (invitation.revokedAt) return { success: false, code: 'INVITE_ALREADY_USED' };
  if (new Date() > invitation.expiresAt) return { success: false, code: 'INVITE_EXPIRED' };

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: invitation.userId },
      data: { passwordHash, status: 'ACTIVE' },
    }),
    prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await writeAuditLog(invitation.tenantId, invitation.userId, 'INVITE_ACCEPTED', invitation.id);

  return { success: true, activated: true };
}

/**
 * POST /auth/invitation/resend — public self-serve resend.
 * Always returns generic 200 to prevent enumeration.
 */
export async function publicResendInvite(email) {
  if (!email) return { queued: false };

  const normalizedEmail = email.toLowerCase().trim();

  // Find any user with this email who is INVITED
  const user = await prisma.user.findFirst({
    where: { email: normalizedEmail, status: 'INVITED', deletedAt: null },
    include: { employee: true },
  });

  if (!user || !user.employee) return { queued: false };

  const employee = user.employee;

  // Find active unused invitation to determine emailTarget
  const existingInvite = await prisma.userInvitation.findFirst({
    where: { userId: user.id, usedAt: null, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  const emailTarget = existingInvite?.emailTarget ?? (await getInviteEmailTarget(user.tenantId));

  // Invalidate old invites
  await invalidatePriorInvites(user.id, user.tenantId);

  const deliveryEmail = resolveEmailAddress(employee, emailTarget) ?? employee.workEmail;
  if (!deliveryEmail) return { queued: false };

  const companyName = await getCompanyName(user.tenantId);
  const { rawToken, expiresAt } = await createInviteToken(
    user.tenantId, employee.id, user.id, emailTarget, deliveryEmail, null,
  );

  await writeAuditLog(user.tenantId, user.id, 'INVITE_RESENT', user.id);

  await dispatchInviteEmail(deliveryEmail, {
    employeeFirstName: employee.firstName,
    companyName,
    rawToken,
    expiresAt,
  });

  return { queued: true };
}
