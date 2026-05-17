import { describe, it } from 'mocha';
import { expect } from 'chai';
import { hashPassword, verifyPassword, hashSHA256 } from '../../src/utils/hash.js';
import { generateId } from '../../src/utils/id.js';
import { createAccessToken, verifyToken } from '../../src/utils/token.js';
import { successResponse, errorResponse } from '../../src/utils/response.js';

describe('Utility Functions', function () {
  describe('Hash Utilities', function () {
    it('should hash password using argon2', async function () {
      const password = 'testPassword123!';
      const hash = await hashPassword(password);

      expect(hash).to.be.a('string');
      expect(hash).to.include('$argon2id$');
    });

    it('should verify correct password', async function () {
      const password = 'testPassword123!';
      const hash = await hashPassword(password);
      const matches = await verifyPassword(password, hash);

      expect(matches).to.be.true;
    });

    it('should reject incorrect password', async function () {
      const password = 'testPassword123!';
      const wrongPassword = 'wrongPassword456!';
      const hash = await hashPassword(password);
      const matches = await verifyPassword(wrongPassword, hash);

      expect(matches).to.be.false;
    });

    it('should generate consistent SHA256 hashes', async function () {
      const token = 'test-token-123';
      const hash1 = hashSHA256(token);
      const hash2 = hashSHA256(token);

      expect(hash1).to.equal(hash2);
      expect(hash1.length).to.equal(64);
    });

    it('should generate different hashes for different inputs', async function () {
      const hash1 = hashSHA256('token1');
      const hash2 = hashSHA256('token2');

      expect(hash1).to.not.equal(hash2);
    });
  });

  describe('ID Generation', function () {
    it('should generate 24-character hex string', function () {
      const id = generateId();

      expect(id).to.be.a('string');
      expect(id).to.have.lengthOf(24);
      expect(/^[0-9a-f]+$/.test(id)).to.be.true;
    });

    it('should generate unique IDs', function () {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).to.not.equal(id2);
    });
  });

  describe('JWT Token Utilities', function () {
    it('should create access token with payload', async function () {
      const payload = {
        sub: 'user-123',
        tenantId: 'tenant-456',
        memberType: 'EMPLOYEE',
        sessionId: 'session-789',
        permissions: ['read', 'write'],
      };

      const token = await createAccessToken(payload);

      expect(token).to.be.a('string');
      expect(token).to.include('.');
    });

    it('should verify valid access token', async function () {
      const payload = {
        sub: 'user-123',
        tenantId: 'tenant-456',
        memberType: 'EMPLOYEE',
        sessionId: 'session-789',
        permissions: ['read', 'write'],
      };

      const token = await createAccessToken(payload);
      const verified = await verifyToken(token);

      expect(verified).to.have.property('sub', 'user-123');
      expect(verified).to.have.property('tenantId', 'tenant-456');
      expect(verified).to.have.property('memberType', 'EMPLOYEE');
      expect(verified).to.have.property('sessionId', 'session-789');
    });

    it('should reject invalid token', async function () {
      try {
        await verifyToken('invalid.token.string');
        expect.fail('Should throw error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should reject expired token', async function () {
      const payload = {
        sub: 'user-123',
        tenantId: 'tenant-456',
        memberType: 'EMPLOYEE',
        sessionId: 'session-789',
        permissions: [],
        exp: Math.floor(Date.now() / 1000) - 3600,
      };

      const token = await createAccessToken(payload);

      try {
        await verifyToken(token);
        expect.fail('Should throw error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should include payload properties in token', async function () {
      const payload = {
        sub: 'user-123',
        tenantId: 'tenant-456',
        memberType: 'HR_ADMIN',
        sessionId: 'session-789',
        permissions: ['admin', 'read', 'write', 'delete'],
      };

      const token = await createAccessToken(payload);
      const verified = await verifyToken(token);

      expect(verified.permissions).to.include('admin');
      expect(verified.permissions).to.include('read');
    });
  });

  describe('Response Utilities', function () {
    it('should create success response', function () {
      const data = { id: '123', name: 'Test' };
      const meta = { count: 1 };
      const response = successResponse(data, meta);

      expect(response).to.have.property('success', true);
      expect(response).to.have.property('data', data);
      expect(response).to.have.property('meta', meta);
    });

    it('should create success response with default empty metadata', function () {
      const data = { id: '123', name: 'Test' };
      const response = successResponse(data);

      expect(response).to.have.property('success', true);
      expect(response).to.have.property('data', data);
      expect(response).to.have.property('meta');
      expect(response.meta).to.be.an('object');
    });

    it('should create error response with requestId', function () {
      const response = errorResponse('INVALID_INPUT', 'Invalid input provided', { field: 'email' }, 'req-123');

      expect(response).to.have.property('success', false);
      expect(response.error).to.have.property('code', 'INVALID_INPUT');
      expect(response.error).to.have.property('message', 'Invalid input provided');
      expect(response.error).to.have.property('details');
      expect(response.error).to.have.property('requestId', 'req-123');
    });

    it('should create error response without requestId', function () {
      const response = errorResponse('SERVER_ERROR', 'An error occurred');

      expect(response).to.have.property('success', false);
      expect(response.error).to.have.property('code', 'SERVER_ERROR');
      expect(response.error).to.have.property('message', 'An error occurred');
      expect(response.error).to.not.have.property('requestId');
    });
  });
});
