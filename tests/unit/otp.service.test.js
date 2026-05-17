import { describe, it, beforeEach, after } from 'mocha';
import { expect } from 'chai';
import { prisma } from '../../src/plugins/prisma.js';
import * as otpService from '../../src/modules/auth/otp.service.js';
import { hashSHA256 } from '../../src/utils/hash.js';

describe('OTP Service', function () {
  this.timeout(10000);

  let testTenant;
  let testUser;

  beforeEach(async function () {
    await prisma.otpChallenge.deleteMany({});
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

    testUser = await prisma.user.create({
      data: {
        tenantId: testTenant.id,
        email: 'test@test.com',
        passwordHash: 'hash',
        memberType: 'EMPLOYEE',
        status: 'ACTIVE',
      },
    });
  });

  after(async function () {
    await prisma.otpChallenge.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.tenant.deleteMany({});
  });

  describe('generateOtp', function () {
    it('should generate OTP challenge with masked destination', async function () {
      const result = await otpService.generateOtp(testTenant.id, testUser.id, 'test@test.com');

      expect(result.success).to.be.true;
      expect(result.challengeId).to.exist;
      expect(result.destinationMasked).to.include('*');
      expect(result.expiresIn).to.equal(600);
    });

    it('should create audit log for OTP generation', async function () {
      await otpService.generateOtp(testTenant.id, testUser.id, 'test@test.com');

      const logs = await prisma.auditLog.findMany({
        where: { tenantId: testTenant.id },
      });

      const generatedLog = logs.find(l => l.action === 'OTP_CHALLENGE_CREATED');
      expect(generatedLog).to.exist;
    });

    it('should create OTP challenge in database', async function () {
      const result = await otpService.generateOtp(testTenant.id, testUser.id, 'test@test.com');

      const challenge = await prisma.otpChallenge.findFirst({
        where: { challengeId: result.challengeId },
      });

      expect(challenge).to.exist;
      expect(challenge.userId).to.equal(testUser.id);
      expect(challenge.purpose).to.equal('LOGIN');
      expect(challenge.deliveryChannel).to.equal('EMAIL');
    });
  });

  describe('verifyOtp', function () {
    it('should verify valid OTP code', async function () {
      const result = await otpService.generateOtp(testTenant.id, testUser.id, 'test@test.com');

      const challenge = await prisma.otpChallenge.findFirst({
        where: { challengeId: result.challengeId },
      });

      const code = '123456';
      const codeHash = hashSHA256(code);
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { codeHash },
      });

      const verifyResult = await otpService.verifyOtp(testTenant.id, result.challengeId, code);

      expect(verifyResult.valid).to.be.true;
      expect(verifyResult.challengeId).to.equal(result.challengeId);
    });

    it('should reject invalid OTP code', async function () {
      const result = await otpService.generateOtp(testTenant.id, testUser.id, 'test@test.com');

      try {
        await otpService.verifyOtp(testTenant.id, result.challengeId, '999999');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.code).to.equal('OTP_INVALID');
      }
    });

    it('should reject expired OTP', async function () {
      const challenge = await prisma.otpChallenge.create({
        data: {
          userId: testUser.id,
          tenantId: testTenant.id,
          challengeId: `challenge_${Date.now()}`,
          codeHash: hashSHA256('123456'),
          purpose: 'LOGIN',
          deliveryChannel: 'EMAIL',
          destinationMasked: 't***@test.com',
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      try {
        await otpService.verifyOtp(testTenant.id, challenge.challengeId, '123456');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.code).to.equal('OTP_EXPIRED');
      }
    });

    it('should reject already used OTP', async function () {
      const challenge = await prisma.otpChallenge.create({
        data: {
          userId: testUser.id,
          tenantId: testTenant.id,
          challengeId: `challenge_${Date.now()}`,
          codeHash: hashSHA256('123456'),
          purpose: 'LOGIN',
          deliveryChannel: 'EMAIL',
          destinationMasked: 't***@test.com',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          consumedAt: new Date(),
        },
      });

      try {
        await otpService.verifyOtp(testTenant.id, challenge.challengeId, '123456');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.code).to.equal('OTP_ALREADY_USED');
      }
    });

    it('should lock challenge after max attempts', async function () {
      const challenge = await prisma.otpChallenge.create({
        data: {
          userId: testUser.id,
          tenantId: testTenant.id,
          challengeId: `challenge_${Date.now()}`,
          codeHash: hashSHA256('123456'),
          purpose: 'LOGIN',
          deliveryChannel: 'EMAIL',
          destinationMasked: 't***@test.com',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          maxAttempts: 3,
        },
      });

      for (let i = 0; i < 3; i++) {
        try {
          await otpService.verifyOtp(testTenant.id, challenge.challengeId, '999999');
        } catch (error) {
          // Expected failure
        }
      }

      try {
        await otpService.verifyOtp(testTenant.id, challenge.challengeId, '123456');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.code).to.equal('OTP_LOCKED');
        expect(error.statusCode).to.equal(429);
      }
    });

    it('should mark OTP as consumed after verification', async function () {
      const result = await otpService.generateOtp(testTenant.id, testUser.id, 'test@test.com');

      const challenge = await prisma.otpChallenge.findFirst({
        where: { challengeId: result.challengeId },
      });

      const code = '123456';
      const codeHash = hashSHA256(code);
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { codeHash },
      });

      await otpService.verifyOtp(testTenant.id, result.challengeId, code);

      const updatedChallenge = await prisma.otpChallenge.findUnique({
        where: { id: challenge.id },
      });

      expect(updatedChallenge.consumedAt).to.not.be.null;
    });
  });

  describe('resendOtp', function () {
    it('should resend OTP and increment resend count', async function () {
      const result = await otpService.generateOtp(testTenant.id, testUser.id, 'test@test.com');

      // Update lastSentAt to bypass cooldown (simulate time passing)
      await prisma.otpChallenge.update({
        where: { challengeId: result.challengeId },
        data: { lastSentAt: new Date(Date.now() - 61000) },
      });

      const resendResult = await otpService.resendOtp(testTenant.id, result.challengeId, 'test@test.com');

      expect(resendResult.success).to.be.true;
      expect(resendResult.destinationMasked).to.exist;
    });

    it('should reject resend on consumed OTP', async function () {
      const challenge = await prisma.otpChallenge.create({
        data: {
          userId: testUser.id,
          tenantId: testTenant.id,
          challengeId: `challenge_${Date.now()}`,
          codeHash: hashSHA256('123456'),
          purpose: 'LOGIN',
          deliveryChannel: 'EMAIL',
          destinationMasked: 't***@test.com',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          consumedAt: new Date(),
        },
      });

      try {
        await otpService.resendOtp(testTenant.id, challenge.challengeId, 'test@test.com');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.code).to.equal('OTP_ALREADY_USED');
      }
    });

    it('should reject resend on expired OTP', async function () {
      const challenge = await prisma.otpChallenge.create({
        data: {
          userId: testUser.id,
          tenantId: testTenant.id,
          challengeId: `challenge_${Date.now()}`,
          codeHash: hashSHA256('123456'),
          purpose: 'LOGIN',
          deliveryChannel: 'EMAIL',
          destinationMasked: 't***@test.com',
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      try {
        await otpService.resendOtp(testTenant.id, challenge.challengeId, 'test@test.com');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.code).to.equal('OTP_EXPIRED');
      }
    });

    it('should reject resend after max resends', async function () {
      const challenge = await prisma.otpChallenge.create({
        data: {
          userId: testUser.id,
          tenantId: testTenant.id,
          challengeId: `challenge_${Date.now()}`,
          codeHash: hashSHA256('123456'),
          purpose: 'LOGIN',
          deliveryChannel: 'EMAIL',
          destinationMasked: 't***@test.com',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          resendCount: 3,
          maxResends: 3,
        },
      });

      try {
        await otpService.resendOtp(testTenant.id, challenge.challengeId, 'test@test.com');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.code).to.equal('OTP_RESEND_LIMIT_EXCEEDED');
        expect(error.statusCode).to.equal(429);
      }
    });
  });
});
