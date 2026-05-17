import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, cleanDatabase } from '../helpers.js';

describe('Auth Routes Integration Tests', function () {
  this.timeout(10000);

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
      email: 'test@example.com',
      memberType: 'EMPLOYEE',
      passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$dGVzdA$o5IIR5YvuDHRlGxJuXWBwJjNdJNjhYkE0T6PkZVb7Xc',  // password: 'password'
    });
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  describe('POST /auth/login', function () {
    it('should successfully login with valid credentials', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data).to.have.property('accessToken');
      expect(body.data).to.have.property('sessionId');
      expect(body.data).to.have.property('user');
    });

    it('should return 401 for non-existent user', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password',
        },
      });

      expect(response.statusCode).to.equal(401);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.false;
    });

    it('should return 401 for wrong password', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).to.equal(401);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.false;
    });

    it('should not return passwordHash in response', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const body = JSON.parse(response.body);
      expect(body.data.user).to.not.have.property('passwordHash');
    });
  });

  describe('POST /auth/admin/login', function () {
    it('should reject non-admin users', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/admin/login',
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      expect(response.statusCode).to.equal(403);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.false;
      expect(body.error.code).to.equal('FORBIDDEN');
    });
  });

  describe('GET /auth/me', function () {
    it('should require valid access token', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).to.equal(401);
    });

    it('should return current user with valid token', async function () {
      // Login first
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const loginBody = JSON.parse(loginResponse.body);
      const accessToken = loginBody.data.accessToken;

      // Get current user
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data.email).to.equal('test@example.com');
    });
  });

  describe('POST /auth/logout', function () {
    it('should logout current session', async function () {
      // Login first
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const loginBody = JSON.parse(loginResponse.body);
      const accessToken = loginBody.data.accessToken;

      // Logout
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data.message).to.include('successfully');
    });
  });
});
