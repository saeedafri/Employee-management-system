import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { prisma } from '../../src/plugins/prisma.js';
import * as authRepository from '../../src/modules/auth/auth.repository.js';
import { hashPassword } from '../../src/utils/hash.js';

describe('Auth Repository Coverage', function () {
  this.timeout(10000);

  let testTenant;
  let testUser;

  beforeEach(async function () {
    await prisma.session.deleteMany({});
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
        email: 'test@test.com',
        passwordHash: hashedPassword,
        memberType: 'EMPLOYEE',
        status: 'ACTIVE',
      },
    });
  });

  describe('findUserByEmail', function () {
    it('should find user by email', async function () {
      const user = await authRepository.findUserByEmail(prisma, testTenant.id, 'test@test.com');
      expect(user).to.exist;
      expect(user.email).to.equal('test@test.com');
    });

    it('should return null for non-existent email', async function () {
      const user = await authRepository.findUserByEmail(prisma, testTenant.id, 'nonexistent@test.com');
      expect(user).to.be.null;
    });

    it('should include user roles', async function () {
      const user = await authRepository.findUserByEmail(prisma, testTenant.id, 'test@test.com');
      expect(user).to.have.property('userRoles');
      expect(user.userRoles).to.be.an('array');
    });
  });

  describe('findUserById', function () {
    it('should find user by id', async function () {
      const user = await authRepository.findUserById(prisma, testUser.id);
      expect(user).to.exist;
      expect(user.id).to.equal(testUser.id);
    });

    it('should return null for non-existent id', async function () {
      const user = await authRepository.findUserById(prisma, 'nonexistent-id');
      expect(user).to.be.null;
    });

    it('should include user roles in findUserById', async function () {
      const user = await authRepository.findUserById(prisma, testUser.id);
      expect(user).to.have.property('userRoles');
    });
  });

  describe('Session Operations', function () {
    it('should create session', async function () {
      const sessionData = {
        id: 'test-session-' + Date.now(),
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: 'family-1',
        refreshTokenHash: 'hash-' + Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const session = await authRepository.createSession(prisma, sessionData);
      expect(session).to.exist;
      expect(session.userId).to.equal(testUser.id);
    });

    it('should find session by id', async function () {
      const sessionData = {
        id: 'test-session-' + Date.now(),
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: 'family-1',
        refreshTokenHash: 'hash-' + Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const created = await authRepository.createSession(prisma, sessionData);
      const found = await authRepository.findSessionById(prisma, created.id);

      expect(found).to.exist;
      expect(found.id).to.equal(created.id);
    });

    it('should find session by id and user', async function () {
      const sessionData = {
        id: 'test-session-' + Date.now(),
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: 'family-1',
        refreshTokenHash: 'hash-' + Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const created = await authRepository.createSession(prisma, sessionData);
      const found = await authRepository.findSessionByIdAndUser(prisma, created.id, testUser.id);

      expect(found).to.exist;
      expect(found.userId).to.equal(testUser.id);
    });

    it('should not find revoked session by id and user', async function () {
      const sessionData = {
        id: 'test-session-' + Date.now(),
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: 'family-1',
        refreshTokenHash: 'hash-' + Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const created = await authRepository.createSession(prisma, sessionData);
      await authRepository.revokeSession(prisma, created.id, 'TEST');

      const found = await authRepository.findSessionByIdAndUser(prisma, created.id, testUser.id);
      expect(found).to.be.null;
    });

    it('should update session', async function () {
      const sessionData = {
        id: 'test-session-' + Date.now(),
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: 'family-1',
        refreshTokenHash: 'hash-' + Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const created = await authRepository.createSession(prisma, sessionData);
      const updated = await authRepository.updateSession(prisma, created.id, {
        ipAddress: '192.168.1.1',
      });

      expect(updated.ipAddress).to.equal('192.168.1.1');
    });

    it('should find user sessions', async function () {
      const sessionData1 = {
        id: 'session-1-' + Date.now(),
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: 'family-1',
        refreshTokenHash: 'hash-1-' + Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'agent-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const sessionData2 = {
        id: 'session-2-' + Date.now(),
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: 'family-1',
        refreshTokenHash: 'hash-2-' + Date.now(),
        ipAddress: '127.0.0.2',
        userAgent: 'agent-2',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      await authRepository.createSession(prisma, sessionData1);
      await authRepository.createSession(prisma, sessionData2);

      const sessions = await authRepository.findUserSessions(prisma, testUser.id);
      expect(sessions).to.be.an('array');
      expect(sessions.length).to.be.greaterThanOrEqual(2);
    });

    it('should revoke single session', async function () {
      const sessionData = {
        id: 'test-session-' + Date.now(),
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: 'family-1',
        refreshTokenHash: 'hash-' + Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const created = await authRepository.createSession(prisma, sessionData);
      const revoked = await authRepository.revokeSession(prisma, created.id, 'LOGOUT');

      expect(revoked.revokedAt).to.exist;
      expect(revoked.revokeReason).to.equal('LOGOUT');
    });

    it('should revoke all user sessions', async function () {
      const sessionData = {
        id: 'test-session-' + Date.now(),
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: 'family-1',
        refreshTokenHash: 'hash-' + Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      await authRepository.createSession(prisma, sessionData);

      await authRepository.revokeUserSessions(prisma, testUser.id, 'LOGOUT_ALL');

      const sessions = await authRepository.findUserSessions(prisma, testUser.id);
      const allRevoked = sessions.every(s => s.revokedAt !== null);
      expect(allRevoked).to.be.true;
    });

    it('should revoke session family', async function () {
      const familyId = 'family-' + Date.now();
      const sessionData1 = {
        id: 'session-1-' + Date.now(),
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: familyId,
        refreshTokenHash: 'hash-1-' + Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'agent-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const sessionData2 = {
        id: 'session-2-' + Date.now(),
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: familyId,
        refreshTokenHash: 'hash-2-' + Date.now(),
        ipAddress: '127.0.0.2',
        userAgent: 'agent-2',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      await authRepository.createSession(prisma, sessionData1);
      await authRepository.createSession(prisma, sessionData2);

      await authRepository.revokeSessionFamily(prisma, familyId, 'TOKEN_REUSE');

      const sessions = await authRepository.findUserSessions(prisma, testUser.id);
      const familySessions = sessions.filter(s => s.sessionFamilyId === familyId);
      const allRevoked = familySessions.every(s => s.revokedAt !== null);
      expect(allRevoked).to.be.true;
    });

    it('should find session by id with family', async function () {
      const sessionData = {
        id: 'test-session-' + Date.now(),
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: 'family-test',
        refreshTokenHash: 'hash-' + Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const created = await authRepository.createSession(prisma, sessionData);
      const found = await authRepository.findSessionByIdWithFamily(prisma, created.id);

      expect(found).to.exist;
      expect(found.sessionFamilyId).to.equal('family-test');
    });
  });

  describe('Password Reset Token Operations', function () {
    it('should create password reset token', async function () {
      const tokenData = {
        tokenHash: 'hash-' + Date.now(),
        userId: testUser.id,
        tenantId: testTenant.id,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
      };

      const token = await authRepository.createPasswordResetToken(prisma, tokenData);
      expect(token).to.exist;
      expect(token.usedAt).to.be.null;
    });

    it('should find password reset token', async function () {
      const tokenHash = 'hash-' + Date.now();
      const tokenData = {
        tokenHash,
        userId: testUser.id,
        tenantId: testTenant.id,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
      };

      await authRepository.createPasswordResetToken(prisma, tokenData);
      const found = await authRepository.findPasswordResetToken(prisma, tokenHash);

      expect(found).to.exist;
      expect(found.tokenHash).to.equal(tokenHash);
    });

    it('should update password reset token', async function () {
      const tokenHash = 'hash-' + Date.now();
      const tokenData = {
        tokenHash,
        userId: testUser.id,
        tenantId: testTenant.id,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
      };

      const created = await authRepository.createPasswordResetToken(prisma, tokenData);
      const updated = await authRepository.updatePasswordResetToken(prisma, created.id, {
        usedAt: new Date(),
      });

      expect(updated.usedAt).to.not.be.null;
    });
  });

  describe('OTP Challenge Operations', function () {
    it('should create otp challenge', async function () {
      const otpData = {
        challengeId: 'challenge-' + Date.now(),
        userId: testUser.id,
        tenantId: testTenant.id,
        codeHash: 'code-hash-' + Date.now(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
      };

      const challenge = await authRepository.createOtpChallenge(prisma, otpData);
      expect(challenge).to.exist;
      expect(challenge.consumedAt).to.be.null;
    });

    it('should find otp challenge', async function () {
      const challengeId = 'challenge-' + Date.now();
      const otpData = {
        challengeId,
        userId: testUser.id,
        tenantId: testTenant.id,
        codeHash: 'code-hash-' + Date.now(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
      };

      await authRepository.createOtpChallenge(prisma, otpData);
      const found = await authRepository.findOtpChallenge(prisma, challengeId);

      expect(found).to.exist;
      expect(found.challengeId).to.equal(challengeId);
    });

    it('should update otp challenge', async function () {
      const challengeId = 'challenge-' + Date.now();
      const otpData = {
        challengeId,
        userId: testUser.id,
        tenantId: testTenant.id,
        codeHash: 'code-hash-' + Date.now(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
      };

      await authRepository.createOtpChallenge(prisma, otpData);
      const updated = await authRepository.updateOtpChallenge(prisma, challengeId, {
        consumedAt: new Date(),
        attempts: 1,
      });

      expect(updated.consumedAt).to.not.be.null;
      expect(updated.attempts).to.equal(1);
    });
  });

  describe('Audit Log Operations', function () {
    it('should create audit log', async function () {
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
      expect(log).to.exist;
      expect(log.action).to.equal('LOGIN');
      expect(log.actorUserId).to.equal(testUser.id);
    });
  });
});
