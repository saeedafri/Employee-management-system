import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import * as authService from '../../src/modules/auth/auth.service.js';
import { prisma } from '../../src/plugins/prisma.js';
import { hashPassword } from '../../src/utils/hash.js';

describe('Auth Service Unit Tests', function () {
  this.timeout(10000);
  let testTenant;
  let testUser;

  beforeEach(async function () {
    await prisma.session.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.tenant.deleteMany({});

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
        email: 'user@test.com',
        passwordHash: hashedPassword,
        memberType: 'EMPLOYEE',
        status: 'ACTIVE',
      },
    });

    await prisma.user.create({
      data: {
        tenantId: testTenant.id,
        email: 'admin@test.com',
        passwordHash: hashedPassword,
        memberType: 'HR_ADMIN',
        status: 'ACTIVE',
      },
    });
  });

  afterEach(async function () {
    await prisma.session.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.tenant.deleteMany({});
  });

  describe('validateLogin', function () {
    it('should throw INVALID_CREDENTIALS for non-existent user', async function () {
      try {
        await authService.login(prisma, testTenant.id, 'nonexistent@test.com', 'password123', '127.0.0.1', 'test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).to.equal('INVALID_CREDENTIALS');
        expect(error.statusCode).to.equal(401);
      }
    });

    it('should throw INVALID_CREDENTIALS for wrong password', async function () {
      try {
        await authService.login(prisma, testTenant.id, 'user@test.com', 'wrongpassword', '127.0.0.1', 'test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).to.equal('INVALID_CREDENTIALS');
        expect(error.statusCode).to.equal(401);
      }
    });

    it('should throw ACCOUNT_LOCKED for locked user', async function () {
      await prisma.user.update({
        where: { id: testUser.id },
        data: { status: 'LOCKED' },
      });

      try {
        await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).to.equal('ACCOUNT_LOCKED');
        expect(error.statusCode).to.equal(401);
      }
    });

    it('should throw ACCOUNT_DISABLED for disabled user', async function () {
      await prisma.user.update({
        where: { id: testUser.id },
        data: { status: 'DISABLED' },
      });

      try {
        await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).to.equal('ACCOUNT_DISABLED');
        expect(error.statusCode).to.equal(401);
      }
    });
  });

  describe('login', function () {
    it('should successfully login user and create session', async function () {
      const result = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test-agent');

      expect(result).to.have.property('user');
      expect(result).to.have.property('accessToken');
      expect(result).to.have.property('refreshToken');
      expect(result).to.have.property('sessionId');
      expect(result.user.email).to.equal('user@test.com');
      expect(result.user.memberType).to.equal('EMPLOYEE');
    });

    it('should set lastLoginAt on successful login', async function () {
      const before = new Date();
      await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');
      const after = new Date();

      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(updatedUser.lastLoginAt).to.be.greaterThanOrEqual(before);
      expect(updatedUser.lastLoginAt).to.be.lessThanOrEqual(after);
    });

    it('should create audit log for login', async function () {
      await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');

      const logs = await prisma.auditLog.findMany({
        where: {
          tenantId: testTenant.id,
          action: 'LOGIN',
        },
      });

      expect(logs).to.have.lengthOf(1);
      expect(logs[0].actorUserId).to.equal(testUser.id);
    });

    it('should create session with sessionFamilyId equal to sessionId', async function () {
      const result = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');

      const session = await prisma.session.findUnique({
        where: { id: result.sessionId },
      });

      expect(session.sessionFamilyId).to.equal(session.id);
    });

    it('should return opaque refresh token in format sessionId.token', async function () {
      const result = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');

      expect(result.refreshToken).to.include('.');
      const [sessionId] = result.refreshToken.split('.');
      expect(sessionId).to.equal(result.sessionId);
    });

    it('should throw MFA_REQUIRED if user has MFA enabled', async function () {
      await prisma.user.update({
        where: { id: testUser.id },
        data: { mfaEnabled: true },
      });

      try {
        await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');
        expect.fail('Should have thrown MFA_REQUIRED');
      } catch (error) {
        expect(error.code).to.equal('MFA_REQUIRED');
      }
    });
  });

  describe('adminLogin', function () {
    it('should successfully login admin user', async function () {
      const result = await authService.adminLogin(prisma, testTenant.id, 'admin@test.com', 'password123', '127.0.0.1', 'test');

      expect(result).to.have.property('user');
      expect(result.user.memberType).to.equal('HR_ADMIN');
    });

    it('should throw FORBIDDEN for non-admin user', async function () {
      try {
        await authService.adminLogin(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');
        expect.fail('Should have thrown FORBIDDEN');
      } catch (error) {
        expect(error.code).to.equal('FORBIDDEN');
        expect(error.statusCode).to.equal(403);
      }
    });

    it('should create ADMIN_LOGIN audit log', async function () {
      await authService.adminLogin(prisma, testTenant.id, 'admin@test.com', 'password123', '127.0.0.1', 'test');

      const logs = await prisma.auditLog.findMany({
        where: {
          tenantId: testTenant.id,
          action: 'ADMIN_LOGIN',
        },
      });

      expect(logs).to.have.lengthOf(1);
    });

    it('should allow SUPER_ADMIN to login', async function () {
      await prisma.user.create({
        data: {
          tenantId: testTenant.id,
          email: 'superadmin@test.com',
          passwordHash: testUser.passwordHash,
          memberType: 'SUPER_ADMIN',
          status: 'ACTIVE',
        },
      });

      const result = await authService.adminLogin(prisma, testTenant.id, 'superadmin@test.com', 'password123', '127.0.0.1', 'test');

      expect(result.user.memberType).to.equal('SUPER_ADMIN');
    });
  });

  describe('refreshAccessToken', function () {
    it('should throw SESSION_NOT_FOUND for non-existent session', async function () {
      try {
        await authService.refreshAccessToken(prisma, testTenant.id, 'nonexistent-id', 'token');
        expect.fail('Should have thrown SESSION_NOT_FOUND');
      } catch (error) {
        expect(error.code).to.equal('SESSION_NOT_FOUND');
        expect(error.statusCode).to.equal(401);
      }
    });

    it('should throw TENANT_MISMATCH if tenant does not match', async function () {
      const otherTenant = await prisma.tenant.create({
        data: {
          tenantKey: `other-${Date.now()}`,
          name: 'Other Tenant',
          legalName: 'Other',
          displayName: 'Other',
          country: 'US',
          primaryContactEmail: 'other@test.com',
        },
      });

      const result = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');
      const [sessionId, rawToken] = result.refreshToken.split('.');

      try {
        await authService.refreshAccessToken(prisma, otherTenant.id, sessionId, rawToken);
        expect.fail('Should have thrown TENANT_MISMATCH');
      } catch (error) {
        expect(error.code).to.equal('TENANT_MISMATCH');
        expect(error.statusCode).to.equal(401);
      }
    });

    it('should throw TOKEN_REUSE on reuse of old refresh token', async function () {
      const loginResult = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');
      const [sessionId1, rawToken1] = loginResult.refreshToken.split('.');

      const refreshResult = await authService.refreshAccessToken(prisma, testTenant.id, sessionId1, rawToken1);
      expect(refreshResult).to.have.property('accessToken');

      try {
        await authService.refreshAccessToken(prisma, testTenant.id, sessionId1, rawToken1);
        expect.fail('Should have thrown TOKEN_REUSE');
      } catch (error) {
        expect(error.code).to.equal('TOKEN_REUSE');
        expect(error.statusCode).to.equal(401);
      }
    });

    it('should successfully refresh token and create new session', async function () {
      const loginResult = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');
      const [sessionId1, rawToken1] = loginResult.refreshToken.split('.');

      const refreshResult = await authService.refreshAccessToken(prisma, testTenant.id, sessionId1, rawToken1);

      expect(refreshResult).to.have.property('accessToken');
      expect(refreshResult).to.have.property('refreshToken');
      expect(refreshResult).to.have.property('sessionId');
      expect(refreshResult.sessionId).to.not.equal(sessionId1);
    });

    it('should create TOKEN_REFRESH audit log', async function () {
      const loginResult = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');
      const [sessionId, rawToken] = loginResult.refreshToken.split('.');

      await authService.refreshAccessToken(prisma, testTenant.id, sessionId, rawToken);

      const logs = await prisma.auditLog.findMany({
        where: {
          tenantId: testTenant.id,
          action: 'TOKEN_REFRESH',
        },
      });

      expect(logs.length).to.be.greaterThan(0);
    });

    it('should throw SESSION_EXPIRED for expired session', async function () {
      const loginResult = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');
      const [sessionId, rawToken] = loginResult.refreshToken.split('.');

      await prisma.session.update({
        where: { id: sessionId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      try {
        await authService.refreshAccessToken(prisma, testTenant.id, sessionId, rawToken);
        expect.fail('Should have thrown SESSION_EXPIRED');
      } catch (error) {
        expect(error.code).to.equal('SESSION_EXPIRED');
        expect(error.statusCode).to.equal(401);
      }
    });

    it('should handle invalid token gracefully', async function () {
      const loginResult = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');
      const [sessionId] = loginResult.refreshToken.split('.');

      try {
        await authService.refreshAccessToken(prisma, testTenant.id, sessionId, 'wrongtoken');
        expect.fail('Should throw an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('logout', function () {
    it('should revoke session', async function () {
      const loginResult = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');

      await authService.logout(prisma, testUser.id, loginResult.sessionId);

      const session = await prisma.session.findUnique({
        where: { id: loginResult.sessionId },
      });

      expect(session.revokedAt).to.not.be.null;
      expect(session.revokeReason).to.equal('LOGOUT');
    });

    it('should create LOGOUT audit log', async function () {
      const loginResult = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');

      await authService.logout(prisma, testUser.id, loginResult.sessionId);

      const logs = await prisma.auditLog.findMany({
        where: {
          action: 'LOGOUT',
        },
      });

      expect(logs.length).to.be.greaterThan(0);
    });
  });

  describe('logoutAll', function () {
    it('should revoke all user sessions', async function () {
      const loginResult1 = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test1');

      await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test2');

      await authService.logoutAll(prisma, testUser.id, loginResult1.sessionId);

      const sessions = await prisma.session.findMany({
        where: {
          userId: testUser.id,
        },
      });

      const allRevoked = sessions.every((s) => s.revokedAt !== null);
      expect(allRevoked).to.be.true;
    });

    it('should create LOGOUT_ALL audit log', async function () {
      const loginResult = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');

      await authService.logoutAll(prisma, testUser.id, loginResult.sessionId);

      const logs = await prisma.auditLog.findMany({
        where: {
          action: 'LOGOUT_ALL',
        },
      });

      expect(logs.length).to.be.greaterThan(0);
    });

    it('should throw USER_NOT_FOUND for non-existent user', async function () {
      try {
        await authService.logoutAll(prisma, 'nonexistent-id', 'session-id');
        expect.fail('Should have thrown USER_NOT_FOUND');
      } catch (error) {
        expect(error.code).to.equal('USER_NOT_FOUND');
      }
    });
  });

  describe('getCurrentUser', function () {
    it('should return current user data', async function () {
      const result = await authService.getCurrentUser(prisma, testUser.id);

      expect(result).to.have.property('id');
      expect(result).to.have.property('email');
      expect(result).to.have.property('memberType');
      expect(result).to.have.property('status');
      expect(result).to.have.property('permissions');
      expect(result.email).to.equal('user@test.com');
      expect(result.memberType).to.equal('EMPLOYEE');
    });

    it('should throw USER_NOT_FOUND for non-existent user', async function () {
      try {
        await authService.getCurrentUser(prisma, 'nonexistent-id');
        expect.fail('Should have thrown USER_NOT_FOUND');
      } catch (error) {
        expect(error.code).to.equal('USER_NOT_FOUND');
      }
    });
  });

  describe('getUserSessions', function () {
    it('should return list of user sessions', async function () {
      await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test1');
      await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test2');

      const sessions = await authService.getUserSessions(prisma, testUser.id);

      expect(sessions).to.be.an('array');
      expect(sessions.length).to.be.greaterThanOrEqual(2);
      expect(sessions[0]).to.have.property('id');
      expect(sessions[0]).to.have.property('ipAddress');
      expect(sessions[0]).to.have.property('isRevoked');
    });

    it('should mark revoked sessions correctly', async function () {
      const loginResult = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');

      await authService.logout(prisma, testUser.id, loginResult.sessionId);

      const sessions = await authService.getUserSessions(prisma, testUser.id);

      expect(sessions[0].isRevoked).to.be.true;
    });
  });

  describe('revokeSpecificSession', function () {
    it('should revoke specific session', async function () {
      const loginResult = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');

      await authService.revokeSpecificSession(prisma, testUser.id, loginResult.sessionId);

      const session = await prisma.session.findUnique({
        where: { id: loginResult.sessionId },
      });

      expect(session.revokedAt).to.not.be.null;
      expect(session.revokeReason).to.equal('USER_REVOKED');
    });

    it('should throw SESSION_NOT_FOUND for non-existent session', async function () {
      try {
        await authService.revokeSpecificSession(prisma, testUser.id, 'nonexistent-id');
        expect.fail('Should have thrown SESSION_NOT_FOUND');
      } catch (error) {
        expect(error.code).to.equal('SESSION_NOT_FOUND');
      }
    });

    it('should create REVOKE_SESSION audit log', async function () {
      const loginResult = await authService.login(prisma, testTenant.id, 'user@test.com', 'password123', '127.0.0.1', 'test');

      await authService.revokeSpecificSession(prisma, testUser.id, loginResult.sessionId);

      const logs = await prisma.auditLog.findMany({
        where: {
          action: 'REVOKE_SESSION',
        },
      });

      expect(logs.length).to.be.greaterThan(0);
    });
  });

});
