import { createApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';

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
  return await prisma.user.create({
    data: {
      tenantId,
      email: data.email || defaultEmail,
      passwordHash: data.passwordHash || '$argon2id$v=19$m=19456,t=2,p=1$test$test',
      memberType: data.memberType || 'EMPLOYEE',
      status: data.status || 'ACTIVE',
      ...data,
    },
  });
}

export async function createTestSession(userId, tenantId) {
  return await prisma.session.create({
    data: {
      userId,
      tenantId,
      refreshTokenHash: 'test-hash-' + Date.now(),
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    },
  });
}

export async function getAuthToken(app, email, password) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
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
