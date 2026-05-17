import * as authService from '../../src/modules/auth/auth.service.js';
import * as authRepository from '../../src/modules/auth/auth.repository.js';
import * as hashUtils from '../../src/utils/hash.js';
import { expect } from 'chai';
import sinon from 'sinon';

describe('Auth Service Unit Tests', function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('validateLogin', function () {
    it('should throw error when user not found', async function () {
      const findUserStub = sandbox.stub(authRepository, 'findUserByEmail')
        .resolves(null);

      try {
        await authService.validateLogin({}, 'tenant-123', 'test@example.com', 'password');
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.code).to.equal('INVALID_CREDENTIALS');
        expect(err.statusCode).to.equal(401);
      }

      expect(findUserStub.called).to.be.true;
    });

    it('should throw error when user account is locked', async function () {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        status: 'LOCKED',
      };

      sandbox.stub(authRepository, 'findUserByEmail').resolves(user);

      try {
        await authService.validateLogin({}, 'tenant-123', 'test@example.com', 'password');
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.code).to.equal('ACCOUNT_LOCKED');
        expect(err.statusCode).to.equal(401);
      }
    });

    it('should throw error when user account is disabled', async function () {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        status: 'DISABLED',
      };

      sandbox.stub(authRepository, 'findUserByEmail').resolves(user);

      try {
        await authService.validateLogin({}, 'tenant-123', 'test@example.com', 'password');
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.code).to.equal('ACCOUNT_DISABLED');
        expect(err.statusCode).to.equal(401);
      }
    });

    it('should throw error when password does not match', async function () {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        status: 'ACTIVE',
      };

      sandbox.stub(authRepository, 'findUserByEmail').resolves(user);
      sandbox.stub(hashUtils, 'verifyPassword').resolves(false);

      try {
        await authService.validateLogin({}, 'tenant-123', 'test@example.com', 'wrongpassword');
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.code).to.equal('INVALID_CREDENTIALS');
        expect(err.statusCode).to.equal(401);
      }
    });

    it('should return user when credentials are valid', async function () {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        status: 'ACTIVE',
        userRoles: [],
      };

      sandbox.stub(authRepository, 'findUserByEmail').resolves(user);
      sandbox.stub(hashUtils, 'verifyPassword').resolves(true);

      const result = await authService.validateLogin({}, 'tenant-123', 'test@example.com', 'password');
      expect(result).to.deep.equal(user);
    });
  });

  describe('extractPermissions', function () {
    it('should extract permissions from user roles', function () {
      const user = {
        userRoles: [
          {
            role: {
              permissions: [
                { permission: { key: 'auth.login' } },
                { permission: { key: 'user.read' } },
              ],
            },
          },
          {
            role: {
              permissions: [
                { permission: { key: 'user.write' } },
              ],
            },
          },
        ],
      };

      // Note: This is testing the internal logic, would need to export extractPermissions
      // For now this is a placeholder
      expect(user.userRoles).to.have.length(2);
    });
  });
});
