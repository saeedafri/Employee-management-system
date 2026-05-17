import { describe, it, before, beforeEach, after } from 'mocha';
import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, createTestOtpChallenge, cleanDatabase } from '../helpers.js';
import { hashSHA256 } from '../../src/utils/hash.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('OTP E2E Tests', function () {
  this.timeout(15000);

  let app;
  let testTenant;
  let testUser;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    testTenant = await createTestTenant();
    testUser = await createTestUser(testTenant.id, {
      email: 'user@test.com',
      memberType: 'EMPLOYEE',
    });
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  it('E2E: Complete OTP verification flow', async function () {
    // Step 1: Create OTP challenge
    const { challenge, code } = await createTestOtpChallenge(testUser.id, testTenant.id, testUser.email);

    // Verify challenge exists and has correct properties
    expect(challenge.challengeId).to.exist;
    expect(challenge.purpose).to.equal('LOGIN');
    expect(challenge.deliveryChannel).to.equal('EMAIL');
    expect(challenge.destinationMasked).to.include('*');
    expect(challenge.consumedAt).to.be.null;

    // Step 2: Attempt to verify with wrong code (should increment attempts)
    let response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        challengeId: challenge.challengeId,
        code: '999999',
      },
    });

    expect(response.statusCode).to.equal(400);
    let body = JSON.parse(response.payload);
    expect(body.error.code).to.equal('OTP_INVALID');

    // Step 3: Verify with correct code
    // Update challenge with the correct code hash
    const codeHash = hashSHA256(code);
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { codeHash },
    });

    response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        challengeId: challenge.challengeId,
        code,
      },
    });

    expect(response.statusCode).to.equal(200);
    body = JSON.parse(response.payload);
    // For LOGIN purpose OTP verification
    // The response should contain user and session information
    expect(body.success).to.be.true;
    // At minimum, we should have data returned
    expect(body).to.have.property('data');

    // Step 4: Verify that challenge is now consumed
    const updatedChallenge = await prisma.otpChallenge.findUnique({
      where: { id: challenge.id },
    });

    expect(updatedChallenge.consumedAt).to.not.be.null;

    // Step 5: Attempt to verify again (should fail - already used)
    response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        challengeId: challenge.challengeId,
        code,
      },
    });

    expect(response.statusCode).to.equal(400);
    body = JSON.parse(response.payload);
    expect(body.error.code).to.equal('OTP_ALREADY_USED');

    // Step 6: Verify that audit log was created for OTP verification
    const auditLogs = await prisma.auditLog.findMany({
      where: { tenantId: testTenant.id },
    });

    const otpVerifiedLog = auditLogs.find(l => l.action === 'OTP_VERIFICATION_SUCCEEDED');
    expect(otpVerifiedLog).to.exist;
  });

  it('E2E: OTP auto-lock after max attempts', async function () {
    const { challenge } = await createTestOtpChallenge(testUser.id, testTenant.id, testUser.email);

    // Make 5 failed attempts (maxAttempts = 5)
    for (let i = 0; i < 5; i++) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-otp',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          challengeId: challenge.challengeId,
          code: '999999',
        },
      });

      expect(response.statusCode).to.equal(400);
    }

    // 6th attempt should be locked
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        challengeId: challenge.challengeId,
        code: '123456',
      },
    });

    expect(response.statusCode).to.equal(429);
    const body = JSON.parse(response.payload);
    expect(body.error.code).to.equal('OTP_LOCKED');

    // Verify lock was set in database
    const lockedChallenge = await prisma.otpChallenge.findUnique({
      where: { id: challenge.id },
    });

    expect(lockedChallenge.lockedAt).to.not.be.null;
  });

  it('E2E: Expired OTP cannot be verified', async function () {
    // Create an expired challenge
    const challengeId = `challenge_${Date.now()}`;
    await prisma.otpChallenge.create({
      data: {
        userId: testUser.id,
        tenantId: testTenant.id,
        challengeId,
        codeHash: hashSHA256('123456'),
        purpose: 'LOGIN',
        deliveryChannel: 'EMAIL',
        destinationMasked: 't***@test.com',
        expiresAt: new Date(Date.now() - 1000), // Already expired
        attempts: 0,
        maxAttempts: 5,
        resendCount: 0,
        maxResends: 3,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        challengeId,
        code: '123456',
      },
    });

    expect(response.statusCode).to.equal(400);
    const body = JSON.parse(response.payload);
    expect(body.error.code).to.equal('OTP_EXPIRED');
  });
});
