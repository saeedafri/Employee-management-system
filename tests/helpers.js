import { createApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';
import { hashPassword, hashSHA256 } from '../src/utils/hash.js';
import { generateRefreshToken } from '../src/utils/token.js';

let testPasswordHash;

async function getTestPasswordHash() {
  if (!testPasswordHash) {
    testPasswordHash = await hashPassword('password');
  }
  return testPasswordHash;
}

export async function createTestApp() {
  const app = await createApp();
  return app;
}

export async function cleanDatabase() {
  // Clean up test data
  await prisma.auditLog.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});
}

export async function createTestTenant() {
  return await prisma.tenant.create({
    data: {
      name: 'Test Tenant',
      legalName: 'Test Tenant Inc',
      displayName: 'Test',
      country: 'US',
      tenantKey: `test-tenant-${Date.now()}`,
      primaryContactEmail: 'contact@test.com',
    },
  });
}

export async function createTestUser(tenantId, data = {}) {
  const defaultEmail = `user-${Date.now()}@test.com`;
  const passwordHash = data.passwordHash || await getTestPasswordHash();
  return await prisma.user.create({
    data: {
      tenantId,
      email: data.email || defaultEmail,
      passwordHash,
      memberType: data.memberType || 'EMPLOYEE',
      status: data.status || 'ACTIVE',
      ...data,
    },
  });
}

export async function createTestSession(userId, tenantId) {
  const sessionId = 'session-' + Date.now();
  return await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      tenantId,
      sessionFamilyId: sessionId,
      refreshTokenHash: 'test-hash-' + Date.now(),
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
}

export async function createTestPasswordResetToken(userId, tenantId) {
  const rawToken = generateRefreshToken();
  const tokenHash = hashSHA256(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const token = await prisma.passwordResetToken.create({
    data: {
      userId,
      tenantId,
      tokenHash,
      expiresAt,
      createdByIp: '127.0.0.1',
      userAgent: 'Test Agent',
    },
  });

  return {
    token,
    rawToken,
  };
}

export async function createTestOtpChallenge(userId, tenantId, email = 'test@test.com') {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = hashSHA256(code);
  const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const destinationMasked = email.replace(/(.{1})(.*)(@.*)/, '$1***$3');

  const challenge = await prisma.otpChallenge.create({
    data: {
      userId,
      tenantId,
      challengeId,
      codeHash,
      purpose: 'LOGIN',
      deliveryChannel: 'EMAIL',
      destinationMasked,
      attempts: 0,
      maxAttempts: 5,
      resendCount: 0,
      maxResends: 3,
      lastSentAt: new Date(),
      expiresAt,
    },
  });

  return {
    challenge,
    code,
  };
}

export async function getAuthToken(app, tenantKey, email, password) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'x-tenant-key': tenantKey },
    payload: {
      email,
      password,
    },
  });

  if (response.statusCode === 200) {
    const data = JSON.parse(response.body);
    return data.data.accessToken;
  }

  throw new Error(`Failed to get auth token: ${response.statusCode}`);
}
