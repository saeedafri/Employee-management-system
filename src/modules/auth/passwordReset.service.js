import { prisma } from '../../plugins/prisma.js';
import * as authRepository from './auth.repository.js';
import { hashPassword, hashSHA256 } from '../../utils/hash.js';
import { generateRefreshToken } from '../../utils/token.js';
import { config } from '../../config/index.js';
import { enqueuePasswordResetEmail } from '../../jobs/emailJob.js';

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (local.length <= 3) {
    return `${local[0]}${'*'.repeat(Math.max(0, local.length - 2))}${local[local.length - 1]}@${domain}`;
  }
  const masked = local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
}

export async function requestPasswordReset(tenantId, email, ip, userAgent) {
  try {
    const user = await authRepository.findUserByEmail(prisma, tenantId, email);
    const effectiveTenantId = tenantId ?? user?.tenantId ?? null;

    if (!user) {
      await authRepository.createAuditLog(prisma, {
        tenantId,
        actorUserId: null,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'User',
        entityId: 'unknown',
        ipAddress: ip,
        userAgent,
      });
      return { success: true };
    }

    await authRepository.invalidateOldResetTokens(prisma, user.id, effectiveTenantId);

    const rawToken = generateRefreshToken();
    const tokenHash = hashSHA256(rawToken);
    const expiresAt = new Date(Date.now() + config.resetPasswordTokenTtlMinutes * 60 * 1000);

    const token = await authRepository.createPasswordResetToken(prisma, {
      userId: user.id,
      tenantId: effectiveTenantId,
      tokenHash,
      expiresAt,
      createdByIp: ip,
      userAgent,
    });

    await authRepository.createAuditLog(prisma, {
      tenantId: effectiveTenantId,
      actorUserId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'PasswordResetToken',
      entityId: token.id,
      ipAddress: ip,
      userAgent,
    });

    try {
      await enqueuePasswordResetEmail(user.email, rawToken, config.resetPasswordTokenTtlMinutes);

      await authRepository.createAuditLog(prisma, {
        tenantId: effectiveTenantId,
        actorUserId: user.id,
        action: 'PASSWORD_RESET_EMAIL_QUEUED',
        entityType: 'PasswordResetToken',
        entityId: token.id,
        ipAddress: ip,
        userAgent,
      });
    } catch (emailError) {
      await authRepository.createAuditLog(prisma, {
        tenantId: effectiveTenantId,
        actorUserId: user.id,
        action: 'PASSWORD_RESET_FAILED',
        entityType: 'PasswordResetToken',
        entityId: token.id,
        ipAddress: ip,
        userAgent,
      });
      throw emailError;
    }

    return { success: true };
  } catch (error) {
    return { success: true };
  }
}

export async function validateResetToken(tenantId, rawToken) {
  const tokenHash = hashSHA256(rawToken);

  const token = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  if (!token) {
    if (tenantId) {
      await authRepository.createAuditLog(prisma, {
        tenantId,
        actorUserId: null,
        action: 'PASSWORD_RESET_FAILED',
        entityType: 'PasswordResetToken',
        entityId: 'unknown',
      });
    }
    throw {
      code: 'RESET_TOKEN_INVALID',
      message: 'Invalid or expired reset token',
      statusCode: 400,
    };
  }

  if (token.usedAt) {
    await authRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: token.userId,
      action: 'PASSWORD_RESET_FAILED',
      entityType: 'PasswordResetToken',
      entityId: token.id,
    });
    throw {
      code: 'RESET_TOKEN_ALREADY_USED',
      message: 'This reset token has already been used',
      statusCode: 400,
    };
  }

  if (new Date() > token.expiresAt) {
    await authRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: token.userId,
      action: 'PASSWORD_RESET_FAILED',
      entityType: 'PasswordResetToken',
      entityId: token.id,
    });
    throw {
      code: 'RESET_TOKEN_EXPIRED',
      message: 'This reset token has expired',
      statusCode: 400,
    };
  }

  const user = await authRepository.findUserById(prisma, token.userId);

  await authRepository.createAuditLog(prisma, {
    tenantId,
    actorUserId: token.userId,
    action: 'PASSWORD_RESET_TOKEN_VALIDATED',
    entityType: 'PasswordResetToken',
    entityId: token.id,
  });

  return {
    valid: true,
    expiresAt: token.expiresAt,
    emailMasked: maskEmail(user.email),
    tokenId: token.id,
    userId: token.userId,
    tenantId: token.tenantId,
  };
}

export async function completePasswordReset(tenantId, rawToken, newPassword, ip, userAgent) {
  const tokenHash = hashSHA256(rawToken);

  const token = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  if (!token) {
    if (tenantId) {
      await authRepository.createAuditLog(prisma, {
        tenantId,
        actorUserId: null,
        action: 'PASSWORD_RESET_FAILED',
        entityType: 'PasswordResetToken',
        entityId: 'unknown',
        ipAddress: ip,
        userAgent,
      });
    }
    throw {
      code: 'RESET_TOKEN_INVALID',
      message: 'Invalid or expired reset token',
      statusCode: 400,
    };
  }

  if (token.usedAt) {
    await authRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: token.userId,
      action: 'PASSWORD_RESET_FAILED',
      entityType: 'PasswordResetToken',
      entityId: token.id,
      ipAddress: ip,
      userAgent,
    });
    throw {
      code: 'RESET_TOKEN_ALREADY_USED',
      message: 'This reset token has already been used',
      statusCode: 400,
    };
  }

  if (new Date() > token.expiresAt) {
    await authRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: token.userId,
      action: 'PASSWORD_RESET_FAILED',
      entityType: 'PasswordResetToken',
      entityId: token.id,
      ipAddress: ip,
      userAgent,
    });
    throw {
      code: 'RESET_TOKEN_EXPIRED',
      message: 'This reset token has expired',
      statusCode: 400,
    };
  }

  try {
    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash },
    });

    await authRepository.updatePasswordResetToken(prisma, token.id, { usedAt: new Date() });

    await authRepository.revokeUserSessions(prisma, token.userId, 'PASSWORD_RESET');

    const user = await authRepository.findUserById(prisma, token.userId);

    await authRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: token.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'User',
      entityId: token.userId,
      ipAddress: ip,
      userAgent,
    });

    return {
      success: true,
      email: maskEmail(user.email),
    };
  } catch (error) {
    await authRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: token.userId,
      action: 'PASSWORD_RESET_FAILED',
      entityType: 'PasswordResetToken',
      entityId: token.id,
      ipAddress: ip,
      userAgent,
    });
    throw error;
  }
}
