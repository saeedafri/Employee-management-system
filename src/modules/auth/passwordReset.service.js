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

    if (!user) {
      await authRepository.createAuditLog(prisma, {
        tenantId,
        actorUserId: null,
        action: 'PASSWORD_RESET_REQUESTED_NOT_FOUND',
        entityType: 'User',
        entityId: 'unknown',
        ipAddress: ip,
        userAgent,
      });
      return { success: true };
    }

    await authRepository.invalidateOldResetTokens(prisma, user.id, tenantId);

    const rawToken = generateRefreshToken();
    const tokenHash = hashSHA256(rawToken);
    const expiresAt = new Date(Date.now() + config.resetPasswordTokenTtlMinutes * 60 * 1000);

    await authRepository.createPasswordResetToken(prisma, {
      userId: user.id,
      tenantId,
      tokenHash,
      expiresAt,
      createdByIp: ip,
      userAgent,
    });

    await enqueuePasswordResetEmail(user.email, rawToken, config.resetPasswordTokenTtlMinutes);

    await authRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
      userAgent,
    });

    return { success: true };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[PASSWORD_RESET] requestPasswordReset error:', error.message);
    return { success: true };
  }
}

export async function validateResetToken(rawToken) {
  const tokenHash = hashSHA256(rawToken);

  const token = await authRepository.findPasswordResetToken(prisma, tokenHash);

  if (!token) {
    throw {
      code: 'RESET_TOKEN_INVALID',
      message: 'Invalid or expired reset token',
      statusCode: 400,
    };
  }

  if (token.usedAt) {
    throw {
      code: 'RESET_TOKEN_ALREADY_USED',
      message: 'This reset token has already been used',
      statusCode: 400,
    };
  }

  if (new Date() > token.expiresAt) {
    throw {
      code: 'RESET_TOKEN_EXPIRED',
      message: 'This reset token has expired',
      statusCode: 400,
    };
  }

  const user = await authRepository.findUserById(prisma, token.userId);

  return {
    valid: true,
    expiresAt: token.expiresAt,
    emailMasked: maskEmail(user.email),
    tokenId: token.id,
    userId: token.userId,
    tenantId: token.tenantId,
  };
}

export async function completePasswordReset(rawToken, newPassword, ip, userAgent) {
  const tokenHash = hashSHA256(rawToken);

  const token = await authRepository.findPasswordResetToken(prisma, tokenHash);

  if (!token) {
    throw {
      code: 'RESET_TOKEN_INVALID',
      message: 'Invalid or expired reset token',
      statusCode: 400,
    };
  }

  if (token.usedAt) {
    throw {
      code: 'RESET_TOKEN_ALREADY_USED',
      message: 'This reset token has already been used',
      statusCode: 400,
    };
  }

  if (new Date() > token.expiresAt) {
    throw {
      code: 'RESET_TOKEN_EXPIRED',
      message: 'This reset token has expired',
      statusCode: 400,
    };
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: token.userId },
    data: { passwordHash },
  });

  await authRepository.updatePasswordResetToken(prisma, token.id, { usedAt: new Date() });

  await authRepository.revokeUserSessions(prisma, token.userId, 'PASSWORD_RESET');

  const user = await authRepository.findUserById(prisma, token.userId);

  await authRepository.createAuditLog(prisma, {
    tenantId: token.tenantId,
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
}
