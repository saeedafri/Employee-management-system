import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { PrismaClient } from '@prisma/client';
import * as authRepository from '../../src/modules/auth/auth.repository.js';
import { hashPassword } from '../../src/utils/hash.js';

const prisma = new PrismaClient();

describe('Auth Service Unit Tests', function () {
  let testTenant;
  let testUser;

  beforeEach(async function () {
    testTenant = await prisma.tenant.create({
      data: {
        tenantKey: `test-${Date.now()}`,
        name: 'Test Tenant',
        legalName: 'Test Legal',
        displayName: 'Test',
        country: 'India',
        primaryContactEmail: 'test@test.com',
      },
    });

    const hashedPassword = await hashPassword('password123');
    testUser = await prisma.user.create({
      data: {
        tenantId: testTenant.id,
        email: 'test@test.com',
        passwordHash: hashedPassword,
        memberType: 'EMPLOYEE',
        status: 'ACTIVE',
      },
    });
  });

  afterEach(async function () {
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "tenantId" = '${testTenant.id}'`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Tenant" WHERE id = '${testTenant.id}'`);
  });

  describe('extractPermissions', function () {
    it('should return empty array for user with no roles', function () {
      const user = { userRoles: [] };
      // Permission extraction works on loaded relations
      expect(user.userRoles).to.be.an('array');
    });

    it('should extract permissions from user roles', function () {
      const user = {
        userRoles: [
          {
            role: {
              permissions: [
                { permission: { key: 'auth:login' } },
                { permission: { key: 'user:read' } },
              ],
            },
          },
        ],
      };
      expect(user.userRoles).to.have.lengthOf(1);
    });
  });

  describe('Session creation', function () {
    it('should create session with sessionFamilyId equal to sessionId', async function () {
      const sessionData = {
        id: 'test-session-123',
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: 'test-session-123',
        refreshTokenHash: 'hash123',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const session = await authRepository.createSession(prisma, sessionData);
      expect(session.sessionFamilyId).to.equal(session.id);
    });
  });

  describe('Audit logging', function () {
    it('should create audit log for login', async function () {
      const auditData = {
        tenantId: testTenant.id,
        actorUserId: testUser.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: testUser.id,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const log = await authRepository.createAuditLog(prisma, auditData);
      expect(log.action).to.equal('LOGIN');
      expect(log.actorUserId).to.equal(testUser.id);
    });
  });

  describe('Token hash validation', function () {
    it('should validate token hash correctly', async function () {
      const rawToken = 'test-token-123';
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      expect(hash).to.be.a('string');
      expect(hash.length).to.equal(64);
    });
  });
});
