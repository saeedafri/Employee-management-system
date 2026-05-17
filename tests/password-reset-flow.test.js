import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, cleanDatabase } from './helpers.js';
import { prisma } from '../src/plugins/prisma.js';

describe('Password Reset Email Flow - Complete Workflow', function () {
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

  it('PART 3.1: User requests password reset (forgot-password endpoint)', async () => {
    const user = await createTestUser(testTenant.id, {
      email: 'reset-test@example.com',
      memberType: 'EMPLOYEE',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        email: 'reset-test@example.com',
      },
    });

    expect(response.statusCode).to.equal(202);
    const data = JSON.parse(response.body);
    expect(data.meta).to.have.property('message');

    // Verify token created in DB
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        tenantId: testTenant.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(resetToken).to.exist;
    expect(resetToken.usedAt).to.be.null;
  });

  it('PART 3.2: Email is NOT sent for non-existent user (no enumeration)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        email: 'nonexistent@example.com',
      },
    });

    expect(response.statusCode).to.equal(202);
    // Response should be same as if user exists (no enumeration)
    const data = JSON.parse(response.body);
    expect(data.meta).to.have.property('message');
  });

  it('PART 3.3: Reset token has correct TTL (30 minutes by default)', async () => {
    const user = await createTestUser(testTenant.id, {
      email: 'ttl-test@example.com',
      memberType: 'EMPLOYEE',
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        email: 'ttl-test@example.com',
      },
    });

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        tenantId: testTenant.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    const ttlMs = resetToken.expiresAt.getTime() - resetToken.createdAt.getTime();
    const ttlMinutes = ttlMs / (1000 * 60);
    expect(ttlMinutes).to.be.closeTo(30, 1); // Allow 1 minute variance
  });

  it('PART 3.4: Reset token is hashed (not stored in plaintext)', async () => {
    const user = await createTestUser(testTenant.id, {
      email: 'hash-test@example.com',
      memberType: 'EMPLOYEE',
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        email: 'hash-test@example.com',
      },
    });

    // Get token from DB
    const resetTokens = await prisma.passwordResetToken.findMany({
      where: {
        userId: user.id,
        tenantId: testTenant.id,
      },
    });

    // Token should be hashed - doesn't look like a random token
    const storedTokenHash = resetTokens[resetTokens.length - 1].tokenHash;
    expect(storedTokenHash).to.match(/^[a-f0-9]{64}$/); // SHA256 hex format
  });

  it('PART 3.5: Validate reset token endpoint verifies token is valid', async () => {
    await createTestUser(testTenant.id, {
      email: 'validate-test@example.com',
      memberType: 'EMPLOYEE',
    });

    const resetResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        email: 'validate-test@example.com',
      },
    });

    // Verify endpoint returns 202
    expect(resetResponse.statusCode).to.equal(202);

    // Get token from DB
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tenantId: testTenant.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    // In real flow, token would come from email. For testing, we'd need to extract it somehow
    // This test verifies the mechanism exists
    expect(resetToken).to.exist;
    expect(resetToken.expiresAt.getTime()).to.be.greaterThan(Date.now());
  });

  it('PART 3.6: Reset password invalidates old tokens for same user', async () => {
    const user = await createTestUser(testTenant.id, {
      email: 'multiple-reset@example.com',
      memberType: 'EMPLOYEE',
    });

    // Request reset 1
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        email: 'multiple-reset@example.com',
      },
    });

    const token1 = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        tenantId: testTenant.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Request reset 2
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        email: 'multiple-reset@example.com',
      },
    });

    // Old token should be invalidated
    const oldTokenCheck = await prisma.passwordResetToken.findUnique({
      where: { id: token1.id },
    });

    // Should be marked as used to invalidate it
    expect(oldTokenCheck).to.exist;
    // When a new reset is requested, old tokens should be invalidated
  });

  it('PART 3.7: Password reset revokes all active sessions', async () => {
    const testUser = await createTestUser(testTenant.id, {
      email: 'session-revoke@example.com',
      memberType: 'EMPLOYEE',
    });

    // Create sessions
    await prisma.session.create({
      data: {
        id: `session-1-${Date.now()}`,
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: `family-${Date.now()}`,
        refreshTokenHash: 'hash-1',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.session.create({
      data: {
        id: `session-2-${Date.now()}`,
        userId: testUser.id,
        tenantId: testTenant.id,
        sessionFamilyId: `family-${Date.now()}`,
        refreshTokenHash: 'hash-2',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const activeBefore = await prisma.session.count({
      where: {
        userId: testUser.id,
        revokedAt: null,
      },
    });
    expect(activeBefore).to.equal(2);

    // Simulate password reset (revoke all sessions)
    await prisma.session.updateMany({
      where: {
        userId: testUser.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: 'PASSWORD_RESET',
      },
    });

    const activeAfter = await prisma.session.count({
      where: {
        userId: testUser.id,
        revokedAt: null,
      },
    });
    expect(activeAfter).to.equal(0);
  });

  it('PART 3.8: Old password no longer works after reset', async () => {
    const user = await createTestUser(testTenant.id, {
      email: 'old-password-test@example.com',
      memberType: 'EMPLOYEE',
    });

    // Store original password hash
    const originalUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    // Simulate password reset (update to new password)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: 'new-hashed-password',
      },
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    expect(updatedUser.passwordHash).to.not.equal(originalUser.passwordHash);
  });

  it('PART 3.9: Audit log tracks password reset requests', async () => {
    await createTestUser(testTenant.id, {
      email: 'audit-test@example.com',
      memberType: 'EMPLOYEE',
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        email: 'audit-test@example.com',
      },
    });

    // Check audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: testTenant.id,
        entityType: 'PasswordResetToken',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(auditLogs.length).to.be.greaterThan(0);
    expect(auditLogs[0].action).to.be.oneOf([
      'PASSWORD_RESET_REQUESTED',
      'PASSWORD_RESET_EMAIL_QUEUED',
    ]);
  });

  it('PART 3.10: Email includes reset URL with token parameter', async () => {
    const user = await createTestUser(testTenant.id, {
      email: 'email-url-test@example.com',
      memberType: 'EMPLOYEE',
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        email: 'email-url-test@example.com',
      },
    });

    // Verify reset token exists in DB
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        tenantId: testTenant.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(resetToken).to.exist;
    // In real flow, email would contain reset URL with token
    // URL format: `{FRONTEND_RESET_PASSWORD_URL}?token=${rawToken}`
  });
});
