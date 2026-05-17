import { verifyPassword, hashPassword, hashSHA256 } from '../../utils/hash.js';
import { createAccessToken, generateRefreshToken } from '../../utils/token.js';
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

  // Create session
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashSHA256(refreshToken);
  const expiresAt = new Date(
    Date.now() + config.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
  );

  const session = await authRepository.createSession(db, {
    userId: user.id,
    tenantId,
    refreshTokenHash,
    ipAddress,
    userAgent,
    expiresAt,
  });

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

  return {
    user: {
      id: user.id,
      email: user.email,
      memberType: user.memberType,
      employee: user.employee,
    },
    accessToken,
    refreshToken,
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
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashSHA256(refreshToken);
  const expiresAt = new Date(
    Date.now() + config.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
  );

  const session = await authRepository.createSession(db, {
    userId: user.id,
    tenantId,
    refreshTokenHash,
    ipAddress,
    userAgent,
    expiresAt,
  });

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

  return {
    user: {
      id: user.id,
      email: user.email,
      memberType: user.memberType,
      employee: user.employee,
    },
    accessToken,
    refreshToken,
    sessionId: session.id,
    permissions,
  };
}

export async function refreshAccessToken(db, userId, sessionId, refreshToken) {
  // Verify session exists and is not revoked
  const session = await authRepository.findSessionByIdAndUser(db, sessionId, userId);
  if (!session) {
    throw new AppError('Session not found or expired', 'SESSION_EXPIRED', 401);
  }

  // Check token expiry
  if (new Date() > session.expiresAt) {
    await authRepository.revokeSession(db, sessionId, 'EXPIRED');
    throw new AppError('Session expired', 'SESSION_EXPIRED', 401);
  }

  // Verify refresh token matches
  const refreshTokenHash = hashSHA256(refreshToken);
  if (refreshTokenHash !== session.refreshTokenHash) {
    // Token reuse detected - revoke entire session family
    await authRepository.revokeSession(db, sessionId, 'TOKEN_REUSE_DETECTED');
    throw new AppError(
      'Token reuse detected. Session revoked.',
      'TOKEN_REUSE',
      401,
    );
  }

  // Get updated user data
  const user = await authRepository.findUserById(db, userId);
  if (!user) {
    throw new AppError('User not found', 'USER_NOT_FOUND', 404);
  }

  // Create new session (old one stays for audit)
  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = hashSHA256(newRefreshToken);
  const expiresAt = new Date(
    Date.now() + config.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
  );

  const newSession = await authRepository.createSession(db, {
    userId,
    tenantId: user.tenantId,
    refreshTokenHash: newRefreshTokenHash,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    expiresAt,
  });

  // Revoke old session
  await authRepository.revokeSession(db, sessionId, 'TOKEN_ROTATED');

  // Create new access token
  const permissions = extractPermissions(user);
  const accessToken = await createAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    memberType: user.memberType,
    sessionId: newSession.id,
    permissions,
  });

  // Audit log
  await authRepository.createAuditLog(db, {
    tenantId: user.tenantId,
    actorUserId: user.id,
    action: 'TOKEN_REFRESH',
    entityType: 'Session',
    entityId: newSession.id,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
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

export async function logoutAll(db, userId, currentSessionId) {
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
