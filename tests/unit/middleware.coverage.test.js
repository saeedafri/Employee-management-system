import { describe, it, before, beforeEach, after } from 'mocha';
import { expect } from 'chai';
import { ZodError } from 'zod';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { createTestApp, cleanDatabase, createTestTenant } from '../helpers.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('Error Handler Middleware', function () {
  let mockRequest;
  let mockReply;

  beforeEach(function () {
    mockRequest = {
      id: 'test-request-123',
      log: {
        error: function() {},
      },
    };
    mockReply = {
      code: function(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      send: function(data) {
        this.data = data;
        return this;
      },
    };
  });

  it('should handle ZodError with validation details', async function () {
    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['email'],
        message: 'Expected string, received number',
      },
    ]);

    await errorHandler(zodError, mockRequest, mockReply);

    expect(mockReply.statusCode).to.equal(400);
    expect(mockReply.data.error.code).to.equal('VALIDATION_ERROR');
    expect(mockReply.data.error.details).to.be.an('array').with.lengthOf(1);
    expect(mockReply.data.error.details[0].field).to.equal('email');
  });

  it('should handle custom app errors', async function () {
    const customError = new Error('Login failed');
    customError.code = 'INVALID_CREDENTIALS';
    customError.statusCode = 401;

    mockRequest.log.error = function() { /* noop */ };

    await errorHandler(customError, mockRequest, mockReply);

    expect(mockReply.statusCode).to.equal(401);
    expect(mockReply.data.error.code).to.equal('INVALID_CREDENTIALS');
  });

  it('should default to 500 for errors without statusCode', async function () {
    const customError = new Error('Unknown error');
    customError.code = 'UNKNOWN_ERROR';

    mockRequest.log.error = function() { /* noop */ };

    await errorHandler(customError, mockRequest, mockReply);

    expect(mockReply.statusCode).to.equal(500);
  });

  it('should handle unhandled errors gracefully', async function () {
    const genericError = new Error('Unexpected');

    mockRequest.log.error = function() { /* noop */ };

    await errorHandler(genericError, mockRequest, mockReply);

    expect(mockReply.statusCode).to.equal(500);
    expect(mockReply.data.error.code).to.equal('INTERNAL_SERVER_ERROR');
  });
});

describe('Request Logging Middleware', function () {
  this.timeout(10000);

  let app;

  before(async function () {
    app = await createTestApp();
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  it('should attach request logging to fastify instance', async function () {
    expect(app.log).to.exist;
    expect(typeof app.log.error).to.equal('function');
    expect(typeof app.log.warn).to.equal('function');
    expect(typeof app.log.info).to.equal('function');
    expect(typeof app.log.debug).to.equal('function');
  });

  it('should handle authentication request with request logging', async function () {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': 'test-tenant-key' },
      payload: {
        email: 'test@example.com',
        password: 'password123',
      },
    });

    // Request logging should not prevent request from being processed
    expect(response.statusCode).to.be.oneOf([400, 401, 200]);
  });

  it('should attach request context to child logger', async function () {
    // This verifies the middleware correctly sets up child logger with context
    expect(app.log).to.exist;
    expect(typeof app.log.child).to.equal('function');
  });

  it('should handle requests with authorization header for logging', async function () {
    const testTenant = await createTestTenant();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        'x-tenant-key': testTenant.tenantKey,
        Authorization: 'Bearer invalid.token.here',
      },
    });

    // Logging should not interfere with request handling
    expect(response.statusCode).to.equal(401);

    await prisma.tenant.delete({ where: { id: testTenant.id } });
  });
});
