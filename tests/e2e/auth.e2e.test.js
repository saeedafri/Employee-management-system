import { describe, it, beforeEach, before } from 'mocha';
import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, cleanDatabase } from '../helpers.js';

describe('Auth E2E Tests', function () {
  this.timeout(15000);

  let app;
  let testTenant;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    testTenant = await createTestTenant();
    await createTestUser(testTenant.id, {
      email: 'user@example.com',
      memberType: 'EMPLOYEE',
    });
    await createTestUser(testTenant.id, {
      email: 'admin@example.com',
      memberType: 'HR_ADMIN',
    });
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  describe('E2E: Complete Login and Session Flow', function () {
    it('should login and access protected endpoints', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'user@example.com',
          password: 'password',
        },
      });

      expect(loginResponse.statusCode).to.equal(200);
      const loginData = JSON.parse(loginResponse.body);
      const accessToken = loginData.data.accessToken;
      const refreshToken = loginResponse.cookies[0].value;

      expect(accessToken).to.be.a('string');
      expect(refreshToken).to.be.a('string');

      // Verify user can access protected endpoint
      const meResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(meResponse.statusCode).to.equal(200);
      const meData = JSON.parse(meResponse.body);
      expect(meData.data.email).to.equal('user@example.com');
    });
  });

  describe('E2E: Multi-Session Management', function () {
    it('should handle multiple concurrent sessions for same user', async function () {
      const login1 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { email: 'user@example.com', password: 'password' },
      });

      const token1 = JSON.parse(login1.body).data.accessToken;

      const login2 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { email: 'user@example.com', password: 'password' },
      });

      const token2 = JSON.parse(login2.body).data.accessToken;

      // Both tokens should work
      const me1 = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token1}`,
        },
      });

      const me2 = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token2}`,
        },
      });

      expect(me1.statusCode).to.equal(200);
      expect(me2.statusCode).to.equal(200);

      // List sessions should show both
      const sessions = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token1}`,
        },
      });

      const sessionsData = JSON.parse(sessions.body);
      expect(sessionsData.data.length).to.be.greaterThanOrEqual(2);
    });
  });

  describe('E2E: Session Revocation', function () {
    it('should revoke specific session', async function () {
      const login1 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { email: 'user@example.com', password: 'password' },
      });

      const login1Data = JSON.parse(login1.body);
      const sessionId1 = login1Data.data.sessionId;
      const token1 = login1Data.data.accessToken;

      // Revoke session 1
      const revoke = await app.inject({
        method: 'DELETE',
        url: `/api/v1/auth/sessions/${sessionId1}`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token1}`,
        },
      });

      expect(revoke.statusCode).to.equal(200);
    });
  });

  describe('E2E: Admin-Only Logs Access', function () {
    it('should allow admin to access logs but reject employee', async function () {
      const adminLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { email: 'admin@example.com', password: 'password' },
      });

      const adminToken = JSON.parse(adminLogin.body).data.accessToken;

      const employeeLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { email: 'user@example.com', password: 'password' },
      });

      const employeeToken = JSON.parse(employeeLogin.body).data.accessToken;

      // Admin can access logs
      const adminLogs = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(adminLogs.statusCode).to.equal(200);

      // Employee cannot access logs
      const employeeLogs = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(employeeLogs.statusCode).to.equal(403);
    });
  });

  describe('E2E: Logout All Sessions', function () {
    it('should logout all sessions', async function () {
      const login1 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { email: 'user@example.com', password: 'password' },
      });

      const token1 = JSON.parse(login1.body).data.accessToken;

      // Logout all
      const logoutAll = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token1}`,
        },
      });

      expect(logoutAll.statusCode).to.equal(200);
    });
  });

  describe('E2E: Admin Login Restrictions', function () {
    it('should allow admin login for HR_ADMIN', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/admin/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { email: 'admin@example.com', password: 'password' },
      });

      expect(response.statusCode).to.equal(200);
    });

    it('should reject admin login for EMPLOYEE', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/admin/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { email: 'user@example.com', password: 'password' },
      });

      expect(response.statusCode).to.equal(403);
    });
  });
});
