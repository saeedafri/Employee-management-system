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
  const dbUrl = process.env.DATABASE_URL || '';
  const isTestDb =
    process.env.NODE_ENV === 'test' &&
    (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('ems_test'));
  if (!isTestDb) {
    throw new Error(
      'cleanDatabase() refused: NODE_ENV is not "test" or DATABASE_URL is not a local test DB. ' +
      'Set NODE_ENV=test and point DATABASE_URL at a local database.',
    );
  }
  // Clean up test data (order matters for foreign keys)
  try {
    await prisma.auditLog.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.session.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.attendanceRegularizationRequest.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.leaveRequest.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.leaveBalance.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.attendanceRecord.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.employeeDocument.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.employee.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.department.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.holiday.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.leaveType.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.userRole.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.rolePermission.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.role.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.user.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.permission.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.exportJob.deleteMany({});
  } catch {} // eslint-disable-line no-empty
  try {
    await prisma.tenant.deleteMany({});
  } catch {} // eslint-disable-line no-empty
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

export async function createTestLeaveType(tenantId, data = {}) {
  const code = data.code || `LT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  return await prisma.leaveType.create({
    data: {
      tenantId,
      name: data.name || 'Casual Leave',
      code,
      ...data,
    },
  });
}

export async function createTestUser(tenantId, data = {}) {
  const defaultEmail = `user-${Date.now()}@test.com`;
  const passwordHash = data.passwordHash || await getTestPasswordHash();
  const memberType = data.memberType || 'EMPLOYEE';

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: data.email || defaultEmail,
      passwordHash,
      memberType,
      status: data.status || 'ACTIVE',
      ...data,
    },
  });

  // Assign role with appropriate permissions
  if (memberType === 'HR_ADMIN' || memberType === 'SUPER_ADMIN' || memberType === 'MANAGER') {
    const roleKey = memberType === 'HR_ADMIN' ? 'hr-admin' : memberType === 'SUPER_ADMIN' ? 'super-admin' : 'manager';
    let role = await prisma.role.findFirst({
      where: { tenantId, key: roleKey },
    });

    if (!role) {
      // Create role if it doesn't exist
      role = await prisma.role.create({
        data: {
          tenantId,
          name: memberType === 'HR_ADMIN' ? 'HR Admin' : memberType === 'SUPER_ADMIN' ? 'Super Admin' : 'Manager',
          key: roleKey,
          isSystem: false,
        },
      });
    }

    // Create and assign permissions based on role
    const permissionKeys = [];
    if (memberType === 'HR_ADMIN') {
      permissionKeys.push('analytics:read', 'employees:read', 'leave:read', 'attendance:read', 'audit:read');
    } else if (memberType === 'SUPER_ADMIN') {
      permissionKeys.push('analytics:read', 'employees:read', 'leave:read', 'attendance:read', 'audit:read', 'roles:write', 'users:write');
    } else if (memberType === 'MANAGER') {
      permissionKeys.push('employees:read', 'leave:read', 'attendance:read');
    }

    // Create permissions and assign to role
    for (const key of permissionKeys) {
      let permission = await prisma.permission.findFirst({ where: { key } });
      if (!permission) {
        permission = await prisma.permission.create({
          data: {
            key,
            module: key.split(':')[0],
            description: key,
          },
        });
      }

      // Check if role permission already exists before creating
      const existing = await prisma.rolePermission.findFirst({
        where: { roleId: role.id, permissionId: permission.id },
      });
      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }

    // Assign role to user
    const existingUserRole = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: role.id },
    });
    if (!existingUserRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });
    }
  }

  return user;
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

export async function createTestEmployee(tenantId, userId, data = {}) {
  const employeeCode = data.employeeCode || `EMP-${Date.now()}`;
  const workEmail = data.workEmail || `${employeeCode}@test.com`;

  return await prisma.employee.create({
    data: {
      tenantId,
      userId,
      firstName: data.firstName || 'Test',
      lastName: data.lastName || 'Employee',
      employeeCode,
      workEmail,
      email: data.email,
      phone: data.phone,
      gender: data.gender || 'MALE',
      employmentType: data.employmentType || 'FULL_TIME',
      employmentStatus: data.employmentStatus || 'ACTIVE',
      designation: data.designation || 'Developer',
      joinedOn: data.joinedOn || new Date(),
      ...data,
    },
  });
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
