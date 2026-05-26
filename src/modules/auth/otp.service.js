import crypto from 'crypto';
import { prisma } from '../../plugins/prisma.js';
import * as otpRepository from './otp.repository.js';
import { hashSHA256 } from '../../utils/hash.js';
import { enqueueOtpEmail } from '../../jobs/emailJob.js';

function generateOtpCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function generateSecureChallengeId() {
  return crypto.randomUUID();
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (local.length <= 3) {
    return `${local[0]}${'*'.repeat(Math.max(0, local.length - 2))}${local[local.length - 1]}@${domain}`;
  }
  const masked = local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
}

export async function generateOtp(tenantId, userId, email, purpose = 'LOGIN', deliveryChannel = 'EMAIL') {
  try {
    const code = generateOtpCode();
    const codeHash = hashSHA256(code);
    const challengeId = generateSecureChallengeId();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const destinationMasked = maskEmail(email);

    const challenge = await otpRepository.createOtpChallenge(prisma, {
      userId,
      tenantId,
      challengeId,
      codeHash,
      purpose,
      deliveryChannel,
      destinationMasked,
      attempts: 0,
      maxAttempts: 5,
      resendCount: 0,
      maxResends: 3,
      lastSentAt: new Date(),
      expiresAt,
    });

    await otpRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: userId,
      action: 'OTP_CHALLENGE_CREATED',
      entityType: 'OtpChallenge',
      entityId: challenge.id,
    });

    try {
      await enqueueOtpEmail(email, code, 10);

      await otpRepository.createAuditLog(prisma, {
        tenantId,
        actorUserId: userId,
        action: 'OTP_EMAIL_QUEUED',
        entityType: 'OtpChallenge',
        entityId: challenge.id,
      });
    } catch (emailError) {
      await otpRepository.createAuditLog(prisma, {
        tenantId,
        actorUserId: userId,
        action: 'OTP_EMAIL_FAILED',
        entityType: 'OtpChallenge',
        entityId: challenge.id,
      });
      throw emailError;
    }

    return {
      success: true,
      challengeId: challenge.challengeId,
      destinationMasked: challenge.destinationMasked,
      expiresIn: 10 * 60,
    };
  } catch (error) {
    await otpRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: userId,
      action: 'OTP_VERIFICATION_FAILED',
      entityType: 'OtpChallenge',
      entityId: 'unknown',
    });
    throw error;
  }
}

export async function verifyOtp(tenantId, challengeId, code) {
  const codeHash = hashSHA256(code);

  const challenge = await otpRepository.findOtpChallengeByChallengeId(prisma, tenantId, challengeId);

  if (!challenge) {
    await otpRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: null,
      action: 'OTP_VERIFICATION_FAILED',
      entityType: 'OtpChallenge',
      entityId: 'unknown',
    });
    throw {
      code: 'OTP_CHALLENGE_NOT_FOUND',
      message: 'OTP challenge not found',
      statusCode: 400,
    };
  }

  if (challenge.consumedAt) {
    await otpRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: challenge.userId,
      action: 'OTP_VERIFICATION_FAILED',
      entityType: 'OtpChallenge',
      entityId: challenge.id,
    });
    throw {
      code: 'OTP_ALREADY_USED',
      message: 'This OTP has already been used',
      statusCode: 400,
    };
  }

  if (new Date() > challenge.expiresAt) {
    await otpRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: challenge.userId,
      action: 'OTP_EXPIRED',
      entityType: 'OtpChallenge',
      entityId: challenge.id,
    });
    throw {
      code: 'OTP_EXPIRED',
      message: 'This OTP has expired',
      statusCode: 400,
    };
  }

  if (challenge.lockedAt && new Date() < challenge.lockedAt) {
    await otpRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: challenge.userId,
      action: 'OTP_LOCKED',
      entityType: 'OtpChallenge',
      entityId: challenge.id,
    });
    throw {
      code: 'OTP_LOCKED',
      message: 'Too many failed attempts. Please try again later.',
      statusCode: 429,
    };
  }

  if (challenge.codeHash !== codeHash) {
    const newAttempts = challenge.attempts + 1;
    const lockDuration = 15 * 60 * 1000; // 15 minutes
    const lockedUntil = new Date(Date.now() + lockDuration);

    const updates = { attempts: newAttempts };
    if (newAttempts >= challenge.maxAttempts) {
      updates.lockedAt = lockedUntil;
    }

    await otpRepository.updateOtpChallenge(prisma, challenge.id, updates);

    await otpRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: challenge.userId,
      action: 'OTP_VERIFICATION_FAILED',
      entityType: 'OtpChallenge',
      entityId: challenge.id,
    });

    throw {
      code: 'OTP_INVALID',
      message: 'Invalid OTP code',
      statusCode: 400,
    };
  }

  await otpRepository.updateOtpChallenge(prisma, challenge.id, { consumedAt: new Date() });

  await otpRepository.createAuditLog(prisma, {
    tenantId,
    actorUserId: challenge.userId,
    action: 'OTP_VERIFICATION_SUCCEEDED',
    entityType: 'OtpChallenge',
    entityId: challenge.id,
  });

  return {
    valid: true,
    challengeId: challenge.challengeId,
    userId: challenge.userId,
    purpose: challenge.purpose,
  };
}

export async function resendOtp(tenantId, challengeId, email) {
  const challenge = await otpRepository.findOtpChallengeByChallengeId(prisma, tenantId, challengeId);

  if (!challenge) {
    await otpRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: null,
      action: 'OTP_VERIFICATION_FAILED',
      entityType: 'OtpChallenge',
      entityId: 'unknown',
    });
    throw {
      code: 'OTP_CHALLENGE_NOT_FOUND',
      message: 'OTP challenge not found',
      statusCode: 400,
    };
  }

  if (challenge.consumedAt) {
    await otpRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: challenge.userId,
      action: 'OTP_VERIFICATION_FAILED',
      entityType: 'OtpChallenge',
      entityId: challenge.id,
    });
    throw {
      code: 'OTP_ALREADY_USED',
      message: 'This OTP has already been used',
      statusCode: 400,
    };
  }

  if (new Date() > challenge.expiresAt) {
    await otpRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: challenge.userId,
      action: 'OTP_EXPIRED',
      entityType: 'OtpChallenge',
      entityId: challenge.id,
    });
    throw {
      code: 'OTP_EXPIRED',
      message: 'This OTP has expired',
      statusCode: 400,
    };
  }

  // Check cooldown (60 seconds)
  if (challenge.lastSentAt && Date.now() - challenge.lastSentAt.getTime() < 60000) {
    const cooldownSeconds = Math.ceil((60000 - (Date.now() - challenge.lastSentAt.getTime())) / 1000);
    await otpRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: challenge.userId,
      action: 'OTP_RESEND_BLOCKED',
      entityType: 'OtpChallenge',
      entityId: challenge.id,
    });
    throw {
      code: 'OTP_RESEND_COOLDOWN',
      message: 'Please wait before requesting another OTP.',
      statusCode: 429,
      details: { cooldownSeconds },
    };
  }

  if (challenge.resendCount >= challenge.maxResends) {
    await otpRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: challenge.userId,
      action: 'OTP_VERIFICATION_FAILED',
      entityType: 'OtpChallenge',
      entityId: challenge.id,
    });
    throw {
      code: 'OTP_RESEND_LIMIT_EXCEEDED',
      message: 'Maximum resend attempts exceeded',
      statusCode: 429,
    };
  }

  const code = generateOtpCode();
  const codeHash = hashSHA256(code);

  await otpRepository.updateOtpChallenge(prisma, challenge.id, {
    codeHash,
    resendCount: challenge.resendCount + 1,
    lastSentAt: new Date(),
  });

  try {
    await enqueueOtpEmail(email, code, 10);

    await otpRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: challenge.userId,
      action: 'OTP_RESENT',
      entityType: 'OtpChallenge',
      entityId: challenge.id,
    });

    return {
      success: true,
      destinationMasked: challenge.destinationMasked,
      expiresIn: Math.floor((challenge.expiresAt.getTime() - Date.now()) / 1000),
    };
  } catch (emailError) {
    await otpRepository.createAuditLog(prisma, {
      tenantId,
      actorUserId: challenge.userId,
      action: 'OTP_EMAIL_FAILED',
      entityType: 'OtpChallenge',
      entityId: challenge.id,
    });
    throw emailError;
  }
}

export async function initiateOtp(challengeId) {
  // Lookup by challengeId alone (no tenant — unauthenticated endpoint)
  const challenge = await prisma.otpChallenge.findFirst({ where: { challengeId } });
  if (!challenge) throw { code: 'CHALLENGE_NOT_FOUND', message: 'Challenge not found or expired', statusCode: 404 };
  if (challenge.consumedAt || new Date() > challenge.expiresAt)
    throw { code: 'CHALLENGE_NOT_FOUND', message: 'Challenge has expired', statusCode: 404 };
  if (challenge.resendCount >= challenge.maxResends)
    throw { code: 'MAX_RESENDS', message: 'Maximum resend attempts reached', statusCode: 429 };
  if (challenge.lastSentAt && Date.now() - challenge.lastSentAt.getTime() < 60000)
    throw { code: 'RESEND_TOO_SOON', message: 'Please wait 60 seconds before requesting again', statusCode: 429 };

  const code = generateOtpCode();
  const codeHash = hashSHA256(code);
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { codeHash, resendCount: challenge.resendCount + 1, lastSentAt: new Date() },
  });

  const user = await prisma.user.findUnique({ where: { id: challenge.userId }, select: { email: true } });
  if (user) await enqueueOtpEmail(user.email, code, 10);

  const now = new Date();
  return {
    challengeId: challenge.challengeId,
    deliveryMethod: challenge.deliveryChannel,
    expiresAt: challenge.expiresAt,
    resendAvailableAt: new Date(now.getTime() + 60000),
  };
}
