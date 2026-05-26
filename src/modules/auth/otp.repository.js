export async function createOtpChallenge(db, data) {
  return db.otpChallenge.create({ data });
}

export async function findOtpChallengeByChallengeId(db, tenantId, challengeId) {
  const where = tenantId ? { tenantId, challengeId } : { challengeId };
  return db.otpChallenge.findFirst({ where });
}

export async function findOtpChallengeById(db, id) {
  return db.otpChallenge.findUnique({ where: { id } });
}

export async function updateOtpChallenge(db, id, data) {
  return db.otpChallenge.update({
    where: { id },
    data,
  });
}

export async function deleteOtpChallenge(db, id) {
  return db.otpChallenge.delete({ where: { id } });
}

export async function invalidateExpiredChallenges(db, tenantId) {
  return db.otpChallenge.updateMany({
    where: {
      tenantId,
      expiresAt: { lte: new Date() },
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });
}

export async function createAuditLog(db, data) {
  return db.auditLog.create({ data });
}
