import { describe, it, beforeEach, after } from 'mocha';
import { expect } from 'chai';
import { prisma } from '../../src/plugins/prisma.js';
import * as passwordResetService from '../../src/modules/auth/passwordReset.service.js';
import * as authRepository from '../../src/modules/auth/auth.repository.js';
import { hashPassword, hashSHA256 } from '../../src/utils/hash.js';
import { generateRefreshToken } from '../../src/utils/token.js';

describe('Password Reset Service', function () {
  this.timeout(10000);

  let testTenant;
  let testUser;

  beforeEach(async function () {
    await prisma.passwordResetToken.deleteMany({});
    await prisma.auditLog.deleteMany({});
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

  after(async function () {
    await prisma.passwordResetToken.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.tenant.deleteMany({});
  });

  describe('requestPasswordReset', function () {
    it('should create password reset token for valid email', async function () {
      const result = await passwordResetService.requestPasswordReset(
        testTenant.id,
        testUser.email,
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).to.be.true;

      const tokens = await prisma.passwordResetToken.findMany({
        where: { userId: testUser.id },
      });
      expect(tokens.length).to.equal(1);
    });

    it('should not error for non-existent email', async function () {
      const result = await passwordResetService.requestPasswordReset(
        testTenant.id,
        'nonexistent@test.com',
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).to.be.true;
    });

    it('should invalidate old tokens', async function () {
      const rawToken1 = generateRefreshToken();
      const tokenHash1 = hashSHA256(rawToken1);

      await authRepository.createPasswordResetToken(prisma, {
        userId: testUser.id,
        tenantId: testTenant.id,
        tokenHash: tokenHash1,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      await passwordResetService.requestPasswordReset(
        testTenant.id,
        testUser.email,
        '127.0.0.1',
        'Test Agent',
      );

      const tokens = await prisma.passwordResetToken.findMany({
        where: { userId: testUser.id },
      });

      const oldToken = tokens.find(t => t.tokenHash === tokenHash1);
      expect(oldToken.usedAt).to.not.be.null;
    });

    it('should record audit log', async function () {
      await passwordResetService.requestPasswordReset(
        testTenant.id,
        testUser.email,
        '127.0.0.1',
        'Test Agent',
      );

      const logs = await prisma.auditLog.findMany({
        where: { tenantId: testTenant.id },
      });

      expect(logs.length).to.be.greaterThan(0);
      const resetLog = logs.find(l => l.action === 'PASSWORD_RESET_REQUESTED');
      expect(resetLog).to.exist;
    });
  });

  describe('validateResetToken', function () {
    it('should validate valid token', async function () {
      const rawToken = generateRefreshToken();
      const tokenHash = hashSHA256(rawToken);

      await authRepository.createPasswordResetToken(prisma, {
        userId: testUser.id,
        tenantId: testTenant.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      const result = await passwordResetService.validateResetToken(rawToken);

      expect(result.valid).to.be.true;
      expect(result.emailMasked).to.include('t**t@test.com');
    });

    it('should reject invalid token', async function () {
      try {
        await passwordResetService.validateResetToken('invalid-token');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.code).to.equal('RESET_TOKEN_INVALID');
      }
    });

    it('should reject already used token', async function () {
      const rawToken = generateRefreshToken();
      const tokenHash = hashSHA256(rawToken);

      await authRepository.createPasswordResetToken(prisma, {
        userId: testUser.id,
        tenantId: testTenant.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        usedAt: new Date(),
      });

      try {
        await passwordResetService.validateResetToken(rawToken);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.code).to.equal('RESET_TOKEN_ALREADY_USED');
      }
    });

    it('should reject expired token', async function () {
      const rawToken = generateRefreshToken();
      const tokenHash = hashSHA256(rawToken);

      await authRepository.createPasswordResetToken(prisma, {
        userId: testUser.id,
        tenantId: testTenant.id,
        tokenHash,
        expiresAt: new Date(Date.now() - 1000),
      });

      try {
        await passwordResetService.validateResetToken(rawToken);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.code).to.equal('RESET_TOKEN_EXPIRED');
      }
    });
  });

  describe('completePasswordReset', function () {
    it('should reset password and revoke sessions', async function () {
      const rawToken = generateRefreshToken();
      const tokenHash = hashSHA256(rawToken);

      await authRepository.createPasswordResetToken(prisma, {
        userId: testUser.id,
        tenantId: testTenant.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      await authRepository.createSession(prisma, {
        id: 'session-1',
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: 'family-1',
        refreshTokenHash: 'hash-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const newPassword = 'NewPassword123!';
      const result = await passwordResetService.completePasswordReset(
        rawToken,
        newPassword,
        '127.0.0.1',
        'Test Agent',
      );

      expect(result.success).to.be.true;

      const updatedUser = await authRepository.findUserById(prisma, testUser.id);
      expect(updatedUser.passwordHash).to.not.equal(testUser.passwordHash);

      const sessions = await authRepository.findUserSessions(prisma, testUser.id);
      const revokedSession = sessions.find(s => s.id === 'session-1');
      expect(revokedSession.revokedAt).to.not.be.null;

      const token = await authRepository.findPasswordResetToken(prisma, tokenHash);
      expect(token.usedAt).to.not.be.null;
    });

    it('should reject invalid token', async function () {
      try {
        await passwordResetService.completePasswordReset('invalid', 'NewPassword123!', '127.0.0.1', 'Test Agent');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.code).to.equal('RESET_TOKEN_INVALID');
      }
    });
  });
});
