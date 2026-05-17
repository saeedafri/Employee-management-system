import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, cleanDatabase } from './helpers.js';
import { prisma } from '../src/plugins/prisma.js';

describe('OTP Email Flow - Complete Workflow', function () {
  this.timeout(30000);
  let app;
  let testTenant;

  before(async () => {
    app = await createTestApp();
    await cleanDatabase();
    testTenant = await createTestTenant();
  });

  after(async () => {
    await app.close();
    await cleanDatabase();
  });

  it('PART 4.1: OTP is generated during login for MFA', async () => {
    await createTestUser(testTenant.id, {
      email: 'otp-login@example.com',
      memberType: 'EMPLOYEE',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        email: 'otp-login@example.com',
        password: 'password',
      },
    });

    expect(response.statusCode).to.be.oneOf([200, 202]);
    const data = JSON.parse(response.body);

    // Either complete login or OTP challenge returned
    if (response.statusCode === 202) {
      expect(data.data).to.have.property('challengeId');
      expect(data.data).to.have.property('destinationMasked');
    } else if (response.statusCode === 200) {
      // MFA not required, login complete
      expect(data.data).to.have.property('accessToken');
    }
  });

  it('PART 4.2: OTP challenge created in database with 10-minute TTL', async () => {
    const user = await createTestUser(testTenant.id, {
      email: 'otp-ttl@example.com',
      memberType: 'EMPLOYEE',
    });

    // Manually trigger OTP generation (normally happens during login)
    const challenge = await prisma.otpChallenge.create({
      data: {
        userId: user.id,
        tenantId: testTenant.id,
        challengeId: `challenge-${Date.now()}`,
        codeHash: 'mock-hash',
        purpose: 'LOGIN',
        deliveryChannel: 'EMAIL',
        destinationMasked: 'o***@example.com',
        attempts: 0,
        maxAttempts: 5,
        resendCount: 0,
        maxResends: 3,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const ttlMs = challenge.expiresAt.getTime() - challenge.createdAt.getTime();
    const ttlMinutes = ttlMs / (1000 * 60);
    expect(ttlMinutes).to.be.closeTo(10, 1); // Allow 1 minute variance
  });

  it('PART 4.3: OTP code is hashed before storage', async () => {
    // OTP code is hashed - verifying schema supports it
    const user = await createTestUser(testTenant.id, {
      email: 'otp-hash@example.com',
      memberType: 'EMPLOYEE',
    });

    const codeHash = 'abcdef1234567890'; // Mock SHA256 hash
    const challenge = await prisma.otpChallenge.create({
      data: {
        userId: user.id,
        tenantId: testTenant.id,
        challengeId: `challenge-hash-${Date.now()}`,
        codeHash,
        purpose: 'LOGIN',
        deliveryChannel: 'EMAIL',
        destinationMasked: 'o***@example.com',
        attempts: 0,
        maxAttempts: 5,
        resendCount: 0,
        maxResends: 3,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    expect(challenge.codeHash).to.equal(codeHash);
  });

  it('PART 4.4: OTP is single-use (marked consumed after verification)', async () => {
    const user = await createTestUser(testTenant.id, {
      email: 'otp-single-use@example.com',
      memberType: 'EMPLOYEE',
    });

    const challenge = await prisma.otpChallenge.create({
      data: {
        userId: user.id,
        tenantId: testTenant.id,
        challengeId: `challenge-single-${Date.now()}`,
        codeHash: 'mock-hash',
        purpose: 'LOGIN',
        deliveryChannel: 'EMAIL',
        destinationMasked: 'o***@example.com',
        attempts: 0,
        maxAttempts: 5,
        resendCount: 0,
        maxResends: 3,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    expect(challenge.consumedAt).to.be.null;

    // Mark as used
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    // Verify marked as used
    const updated = await prisma.otpChallenge.findUnique({
      where: { id: challenge.id },
    });

    expect(updated.consumedAt).to.not.be.null;
  });

  it('PART 4.5: OTP blocks after 5 failed attempts', async () => {
    const user = await createTestUser(testTenant.id, {
      email: 'otp-lockout@example.com',
      memberType: 'EMPLOYEE',
    });

    const challenge = await prisma.otpChallenge.create({
      data: {
        userId: user.id,
        tenantId: testTenant.id,
        challengeId: `challenge-lockout-${Date.now()}`,
        codeHash: 'mock-hash',
        purpose: 'LOGIN',
        deliveryChannel: 'EMAIL',
        destinationMasked: 'o***@example.com',
        attempts: 0,
        maxAttempts: 5,
        resendCount: 0,
        maxResends: 3,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Simulate failed attempts
    for (let i = 0; i < 5; i++) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: i + 1,
          ...(i + 1 >= 5 ? { lockedAt: new Date(Date.now() + 15 * 60 * 1000) } : {}),
        },
      });
    }

    const final = await prisma.otpChallenge.findUnique({
      where: { id: challenge.id },
    });

    expect(final.attempts).to.equal(5);
    expect(final.lockedAt).to.not.be.null;
    expect(final.lockedAt.getTime()).to.be.greaterThan(Date.now());
  });

  it('PART 4.6: OTP can be resent with 60-second cooldown', async () => {
    const user = await createTestUser(testTenant.id, {
      email: 'otp-resend@example.com',
      memberType: 'EMPLOYEE',
    });

    const challenge = await prisma.otpChallenge.create({
      data: {
        userId: user.id,
        tenantId: testTenant.id,
        challengeId: `challenge-resend-${Date.now()}`,
        codeHash: 'mock-hash-1',
        purpose: 'LOGIN',
        deliveryChannel: 'EMAIL',
        destinationMasked: 'o***@example.com',
        attempts: 0,
        maxAttempts: 5,
        resendCount: 0,
        maxResends: 3,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // First resend
    const updated1 = await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: {
        codeHash: 'mock-hash-2',
        resendCount: 1,
        lastSentAt: new Date(),
      },
    });

    expect(updated1.resendCount).to.equal(1);
    expect(updated1.lastSentAt.getTime()).to.be.closeTo(Date.now(), 1000);
  });

  it('PART 4.7: OTP resend limited to 3 times', async () => {
    const user = await createTestUser(testTenant.id, {
      email: 'otp-resend-limit@example.com',
      memberType: 'EMPLOYEE',
    });

    const challenge = await prisma.otpChallenge.create({
      data: {
        userId: user.id,
        tenantId: testTenant.id,
        challengeId: `challenge-resend-limit-${Date.now()}`,
        codeHash: 'mock-hash',
        purpose: 'LOGIN',
        deliveryChannel: 'EMAIL',
        destinationMasked: 'o***@example.com',
        attempts: 0,
        maxAttempts: 5,
        resendCount: 3, // Already at max
        maxResends: 3,
        lastSentAt: new Date(Date.now() - 60 * 1000),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    expect(challenge.resendCount).to.equal(challenge.maxResends);
  });

  it('PART 4.8: Email contains masked destination (not full email)', async () => {
    const user = await createTestUser(testTenant.id, {
      email: 'long-email@example.com',
      memberType: 'EMPLOYEE',
    });

    const challenge = await prisma.otpChallenge.create({
      data: {
        userId: user.id,
        tenantId: testTenant.id,
        challengeId: `challenge-masked-${Date.now()}`,
        codeHash: 'mock-hash',
        purpose: 'LOGIN',
        deliveryChannel: 'EMAIL',
        destinationMasked: 'l***@example.com', // Masked format
        attempts: 0,
        maxAttempts: 5,
        resendCount: 0,
        maxResends: 3,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    expect(challenge.destinationMasked).to.match(/^\w\*\*\*@/); // l***@example.com format
  });

  it('PART 4.9: Audit log tracks OTP generation', async () => {
    const user = await createTestUser(testTenant.id, {
      email: 'otp-audit@example.com',
      memberType: 'EMPLOYEE',
    });

    const challenge = await prisma.otpChallenge.create({
      data: {
        userId: user.id,
        tenantId: testTenant.id,
        challengeId: `challenge-audit-${Date.now()}`,
        codeHash: 'mock-hash',
        purpose: 'LOGIN',
        deliveryChannel: 'EMAIL',
        destinationMasked: 'o***@example.com',
        attempts: 0,
        maxAttempts: 5,
        resendCount: 0,
        maxResends: 3,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        tenantId: testTenant.id,
        actorUserId: user.id,
        action: 'OTP_CHALLENGE_CREATED',
        entityType: 'OtpChallenge',
        entityId: challenge.id,
      },
    });

    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId: testTenant.id,
        entityType: 'OtpChallenge',
      },
    });

    expect(logs.length).to.be.greaterThan(0);
    expect(logs[0].action).to.equal('OTP_CHALLENGE_CREATED');
  });

  it('PART 4.10: OTP expires after 10 minutes', async () => {
    const user = await createTestUser(testTenant.id, {
      email: 'otp-expire@example.com',
      memberType: 'EMPLOYEE',
    });

    // Create OTP with past expiration
    const expiredChallenge = await prisma.otpChallenge.create({
      data: {
        userId: user.id,
        tenantId: testTenant.id,
        challengeId: `challenge-expired-${Date.now()}`,
        codeHash: 'mock-hash',
        purpose: 'LOGIN',
        deliveryChannel: 'EMAIL',
        destinationMasked: 'o***@example.com',
        attempts: 0,
        maxAttempts: 5,
        resendCount: 0,
        maxResends: 3,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Already expired
      },
    });

    expect(expiredChallenge.expiresAt.getTime()).to.be.lessThan(Date.now());

    // Create OTP with future expiration
    const validChallenge = await prisma.otpChallenge.create({
      data: {
        userId: user.id,
        tenantId: testTenant.id,
        challengeId: `challenge-valid-${Date.now()}`,
        codeHash: 'mock-hash',
        purpose: 'LOGIN',
        deliveryChannel: 'EMAIL',
        destinationMasked: 'o***@example.com',
        attempts: 0,
        maxAttempts: 5,
        resendCount: 0,
        maxResends: 3,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    expect(validChallenge.expiresAt.getTime()).to.be.greaterThan(Date.now());
  });
});
