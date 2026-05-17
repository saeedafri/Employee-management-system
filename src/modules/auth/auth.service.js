import crypto from 'crypto';
import { verifyPassword, hashSHA256 } from '../../utils/hash.js';
import { createAccessToken, generateRefreshToken } from '../../utils/token.js';
import { generateId } from '../../utils/id.js';
import { config } from '../../config/index.js';
import * as authRepository from './auth.repository.js';

class AppError extends Error {
  constructor(message, code, statusCode = 400, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function validateLogin(db, tenantId, email, password) {
  const user = await authRepository.findUserByEmail(db, tenantId, email);

  if (!user) {
    throw new AppError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
  }

  if (user.status === 'LOCKED') {
    throw new AppError('Account is locked', 'ACCOUNT_LOCKED', 401);
  }

  if (user.status === 'DISABLED') {
    throw new AppError('Account is disabled', 'ACCOUNT_DISABLED', 401);
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
  }

  return user;
}

function extractPermissions(user) {
  const permissions = new Set();
  for (const userRole of user.userRoles) {
    for (const rp of userRole.role.permissions) {
      permissions.add(rp.permission.key);
    }
  }
  return Array.from(permissions);
}

export async function login(db, tenantId, email, password, ipAddress, userAgent) {
  const user = await validateLogin(db, tenantId, email, password);

  if (user.mfaEnabled) {
    // TODO: Generate OTP challenge and return mfaRequired
    throw new AppError('MFA not yet implemented', 'MFA_REQUIRED', 400);
  }

  // Create session with sessionFamilyId in single operation
  const sessionId = generateId();
  const rawRefreshToken = generateRefreshToken();
  const refreshTokenHash = hashSHA256(rawRefreshToken);
  const expiresAt = new Date(
    Date.now() + config.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
  );

  const sessionData = {
    id: sessionId,
    userId: user.id,
    tenantId,
    sessionFamilyId: sessionId,
    refreshTokenHash,
    ipAddress,
    userAgent,
    expiresAt,
  };

  const session = await authRepository.createSession(db, sessionData);

  // Create access token
  const permissions = extractPermissions(user);
  const accessToken = await createAccessToken({
    sub: user.id,
    tenantId,
    memberType: user.memberType,
    sessionId: session.id,
    permissions,
  });

  // Audit log
  await authRepository.createAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    action: 'LOGIN',
    entityType: 'User',
    entityId: user.id,
    ipAddress,
    userAgent,
  });

  // Update last login
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Return opaque refresh token format: sessionId.rawRefreshToken
  const opaqueRefreshToken = `${session.id}.${rawRefreshToken}`;

  return {
    user: {
      id: user.id,
      email: user.email,
      memberType: user.memberType,
      employee: user.employee,
    },
    accessToken,
    refreshToken: opaqueRefreshToken,
    sessionId: session.id,
    permissions,
  };
}

export async function adminLogin(db, tenantId, email, password, ipAddress, userAgent) {
  const user = await validateLogin(db, tenantId, email, password);

  // Check if user is admin
  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    throw new AppError(
      'Only admins can use this endpoint',
      'FORBIDDEN',
      403,
    );
  }

  // Same as regular login, but with admin check
  const sessionId = generateId();
  const rawRefreshToken = generateRefreshToken();
  const refreshTokenHash = hashSHA256(rawRefreshToken);
  const expiresAt = new Date(
    Date.now() + config.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
  );

  const sessionData = {
    id: sessionId,
    userId: user.id,
    tenantId,
    sessionFamilyId: sessionId,
    refreshTokenHash,
    ipAddress,
    userAgent,
    expiresAt,
  };

  const session = await authRepository.createSession(db, sessionData);

  const permissions = extractPermissions(user);
  const accessToken = await createAccessToken({
    sub: user.id,
    tenantId,
    memberType: user.memberType,
    sessionId: session.id,
    permissions,
  });

  await authRepository.createAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    action: 'ADMIN_LOGIN',
    entityType: 'User',
    entityId: user.id,
    ipAddress,
    userAgent,
  });

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Return opaque refresh token format: sessionId.rawRefreshToken
  const opaqueRefreshToken = `${session.id}.${rawRefreshToken}`;

  return {
    user: {
      id: user.id,
      email: user.email,
      memberType: user.memberType,
      employee: user.employee,
    },
    accessToken,
    refreshToken: opaqueRefreshToken,
    sessionId: session.id,
    permissions,
  };
}

export async function refreshAccessToken(db, tenantId, sessionId, rawRefreshToken) {
  // Step 1: Retrieve session by sessionId (including revoked ones)
  const session = await authRepository.findSessionByIdWithFamily(db, sessionId);
  if (!session) {
    throw new AppError('Session not found', 'SESSION_NOT_FOUND', 401);
  }

  // Step 2: Verify tenant matches
  if (session.tenantId !== tenantId) {
    throw new AppError('Tenant mismatch', 'TENANT_MISMATCH', 401);
  }

  // Step 3: Hash provided token for comparison
  const providedHash = hashSHA256(rawRefreshToken);

  // Step 4: If session is revoked, check if this is token reuse
  if (session.revokedAt !== null) {
    try {
      crypto.timingSafeEqual(
        Buffer.from(providedHash),
        Buffer.from(session.refreshTokenHash),
      );
      // Token matches but session is revoked - this is reuse of a rotated token
      await authRepository.revokeSessionFamily(db, session.sessionFamilyId, 'TOKEN_REUSE_DETECTED');
      await authRepository.createAuditLog(db, {
        tenantId,
        actorUserId: session.userId,
        action: 'TOKEN_REUSE_DETECTED',
        entityType: 'Session',
        entityId: sessionId,
      });
    } catch (_e) {
      // Token doesn't match revoked session - also suspicious
      await authRepository.revokeSessionFamily(db, session.sessionFamilyId, 'TOKEN_REUSE_DETECTED');
    }
    throw new AppError(
      'Token reuse detected. All sessions revoked.',
      'TOKEN_REUSE',
      401,
    );
  }

  // Step 5: Session is active - verify token and check expiry
  if (new Date() > session.expiresAt) {
    await authRepository.revokeSession(db, sessionId, 'EXPIRED');
    throw new AppError('Session expired', 'SESSION_EXPIRED', 401);
  }

  // Step 6: Verify token with timing-safe comparison
  let tokensMatch = false;
  try {
    crypto.timingSafeEqual(
      Buffer.from(providedHash),
      Buffer.from(session.refreshTokenHash),
    );
    tokensMatch = true;
  } catch (_e) {
    tokensMatch = false;
  }

  if (!tokensMatch) {
    // Token mismatch - revoke entire family
    await authRepository.revokeSessionFamily(db, session.sessionFamilyId, 'TOKEN_REUSE_DETECTED');
    await authRepository.createAuditLog(db, {
      tenantId,
      actorUserId: session.userId,
      action: 'TOKEN_REUSE_DETECTED',
      entityType: 'Session',
      entityId: sessionId,
    });
    throw new AppError(
      'Token reuse detected. All sessions revoked.',
      'TOKEN_REUSE',
      401,
    );
  }

  // Step 7: Fetch user data
  const user = await authRepository.findUserById(db, session.userId);
  if (!user) {
    throw new AppError('User not found', 'USER_NOT_FOUND', 404);
  }

  // Step 8: Generate new refresh token
  const newSessionId = generateId();
  const newRawRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = hashSHA256(newRawRefreshToken);
  const expiresAt = new Date(
    Date.now() + config.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
  );

  // Step 9: Create new session with same sessionFamilyId
  const newSession = await authRepository.createSession(db, {
    id: newSessionId,
    userId: session.userId,
    tenantId: session.tenantId,
    refreshTokenHash: newRefreshTokenHash,
    sessionFamilyId: session.sessionFamilyId,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    expiresAt,
  });

  // Step 10: Revoke old session
  await authRepository.revokeSession(db, sessionId, 'TOKEN_ROTATED');

  // Step 11: Generate new access token
  const permissions = extractPermissions(user);
  const accessToken = await createAccessToken({
    sub: user.id,
    tenantId: session.tenantId,
    memberType: user.memberType,
    sessionId: newSession.id,
    permissions,
  });

  // Step 12: Create audit log
  await authRepository.createAuditLog(db, {
    tenantId: session.tenantId,
    actorUserId: session.userId,
    action: 'TOKEN_REFRESH',
    entityType: 'Session',
    entityId: newSession.id,
  });

  // Step 13: Format opaque refresh token
  const opaqueRefreshToken = `${newSession.id}.${newRawRefreshToken}`;

  // Step 14: Return response
  return {
    accessToken,
    refreshToken: opaqueRefreshToken,
    sessionId: newSession.id,
  };
}

export async function logout(db, userId, sessionId) {
  await authRepository.revokeSession(db, sessionId, 'LOGOUT');

  const user = await authRepository.findUserById(db, userId);
  if (user) {
    await authRepository.createAuditLog(db, {
      tenantId: user.tenantId,
      actorUserId: userId,
      action: 'LOGOUT',
      entityType: 'Session',
      entityId: sessionId,
    });
  }
}

export async function logoutAll(db, userId, _currentSessionId) {
  const user = await authRepository.findUserById(db, userId);
  if (!user) {
    throw new AppError('User not found', 'USER_NOT_FOUND', 404);
  }

  await authRepository.revokeUserSessions(db, userId, 'LOGOUT_ALL');

  await authRepository.createAuditLog(db, {
    tenantId: user.tenantId,
    actorUserId: userId,
    action: 'LOGOUT_ALL',
    entityType: 'User',
    entityId: userId,
  });
}

export async function getCurrentUser(db, userId) {
  const user = await authRepository.findUserById(db, userId);
  if (!user) {
    throw new AppError('User not found', 'USER_NOT_FOUND', 404);
  }

  const permissions = extractPermissions(user);

  return {
    id: user.id,
    email: user.email,
    memberType: user.memberType,
    status: user.status,
    employee: user.employee,
    permissions,
    lastLoginAt: user.lastLoginAt,
  };
}

export async function getUserSessions(db, userId) {
  const sessions = await authRepository.findUserSessions(db, userId);
  return sessions.map((session) => ({
    id: session.id,
    deviceName: session.deviceName,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    loginAt: session.loginAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
    isRevoked: session.revokedAt !== null,
  }));
}

export async function revokeSpecificSession(db, userId, sessionId) {
  const session = await authRepository.findSessionByIdAndUser(db, sessionId, userId);
  if (!session) {
    throw new AppError('Session not found', 'SESSION_NOT_FOUND', 404);
  }

  await authRepository.revokeSession(db, sessionId, 'USER_REVOKED');

  const user = await authRepository.findUserById(db, userId);
  if (user) {
    await authRepository.createAuditLog(db, {
      tenantId: user.tenantId,
      actorUserId: userId,
      action: 'REVOKE_SESSION',
      entityType: 'Session',
      entityId: sessionId,
    });
  }
}

export { AppError };
