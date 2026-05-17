export async function findUserByEmail(db, tenantId, email) {
  return db.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
    include: {
      employee: true,
      userRoles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function findUserById(db, userId) {
  return db.user.findUnique({
    where: { id: userId },
    include: {
      employee: true,
      userRoles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function createSession(db, sessionData) {
  return db.session.create({ data: sessionData });
}

export async function findSessionById(db, sessionId) {
  return db.session.findUnique({ where: { id: sessionId } });
}

export async function findSessionByIdAndUser(db, sessionId, userId) {
  return db.session.findFirst({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
    },
  });
}

export async function updateSession(db, sessionId, data) {
  return db.session.update({
    where: { id: sessionId },
    data,
  });
}

export async function findUserSessions(db, userId) {
  return db.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeSession(db, sessionId, reason) {
  return db.session.update({
    where: { id: sessionId },
    data: {
      revokedAt: new Date(),
      revokeReason: reason,
    },
  });
}

export async function revokeUserSessions(db, userId, reason) {
  return db.session.updateMany({
    where: { userId },
    data: {
      revokedAt: new Date(),
      revokeReason: reason,
    },
  });
}

export async function revokeSessionFamily(db, sessionFamilyId, reason) {
  return db.session.updateMany({
    where: { sessionFamilyId },
    data: {
      revokedAt: new Date(),
      revokeReason: reason,
    },
  });
}

export async function findSessionByIdWithFamily(db, sessionId) {
  return db.session.findUnique({
    where: { id: sessionId },
  });
}

export async function createPasswordResetToken(db, tokenData) {
  return db.passwordResetToken.create({ data: tokenData });
}

export async function findPasswordResetToken(db, tokenHash) {
  return db.passwordResetToken.findUnique({ where: { tokenHash } });
}

export async function updatePasswordResetToken(db, tokenId, data) {
  return db.passwordResetToken.update({
    where: { id: tokenId },
    data,
  });
}

export async function createOtpChallenge(db, otpData) {
  return db.otpChallenge.create({ data: otpData });
}

export async function findOtpChallenge(db, challengeId) {
  return db.otpChallenge.findUnique({ where: { challengeId } });
}

export async function updateOtpChallenge(db, challengeId, data) {
  return db.otpChallenge.update({
    where: { challengeId },
    data,
  });
}

export async function createAuditLog(db, auditData) {
  return db.auditLog.create({ data: auditData });
}
