import { describe, it } from 'mocha';
import { expect } from 'chai';
import { getPaginationParams, buildPaginationMeta } from '../../src/utils/pagination.js';
import { generateOTP, parseOTPInput } from '../../src/utils/otp.js';
import { canManageUser } from '../../src/modules/auth/auth.policy.js';

describe('Pagination Utilities', function () {
  describe('getPaginationParams', function () {
    it('should return default pagination when no query provided', function () {
      const params = getPaginationParams({});

      expect(params).to.have.property('page', 1);
      expect(params).to.have.property('limit', 20);
      expect(params).to.have.property('skip', 0);
    });

    it('should parse page and limit from query', function () {
      const params = getPaginationParams({ page: '3', limit: '50' });

      expect(params.page).to.equal(3);
      expect(params.limit).to.equal(50);
      expect(params.skip).to.equal(100);
    });

    it('should enforce minimum page of 1', function () {
      const params = getPaginationParams({ page: '0' });

      expect(params.page).to.equal(1);
      expect(params.skip).to.equal(0);
    });

    it('should enforce minimum limit of 1 when provided', function () {
      const params = getPaginationParams({ limit: '0' });

      expect(params.limit).to.be.greaterThanOrEqual(1);
    });

    it('should enforce maximum limit of 100', function () {
      const params = getPaginationParams({ limit: '200' });

      expect(params.limit).to.equal(100);
    });

    it('should calculate correct skip for pagination', function () {
      const params = getPaginationParams({ page: '5', limit: '25' });

      expect(params.skip).to.equal(100);
    });
  });

  describe('buildPaginationMeta', function () {
    it('should build pagination metadata', function () {
      const meta = buildPaginationMeta(150, 2, 25);

      expect(meta).to.have.property('total', 150);
      expect(meta).to.have.property('page', 2);
      expect(meta).to.have.property('limit', 25);
      expect(meta).to.have.property('totalPages', 6);
    });

    it('should indicate has next page correctly', function () {
      const meta1 = buildPaginationMeta(100, 2, 25);
      const meta2 = buildPaginationMeta(100, 4, 25);

      expect(meta1.hasNextPage).to.be.true;
      expect(meta2.hasNextPage).to.be.false;
    });

    it('should indicate has previous page correctly', function () {
      const meta1 = buildPaginationMeta(100, 1, 25);
      const meta2 = buildPaginationMeta(100, 3, 25);

      expect(meta1.hasPreviousPage).to.be.false;
      expect(meta2.hasPreviousPage).to.be.true;
    });

    it('should calculate total pages correctly', function () {
      const meta1 = buildPaginationMeta(100, 1, 25);
      const meta2 = buildPaginationMeta(101, 1, 25);

      expect(meta1.totalPages).to.equal(4);
      expect(meta2.totalPages).to.equal(5);
    });
  });
});

describe('OTP Utilities', function () {
  describe('generateOTP', function () {
    it('should generate 6-digit OTP', function () {
      const otp = generateOTP();

      expect(otp).to.be.a('string');
      expect(otp).to.have.lengthOf(6);
      expect(/^\d+$/.test(otp)).to.be.true;
    });

    it('should generate OTP within valid range', function () {
      const otp = parseInt(generateOTP(), 10);

      expect(otp).to.be.greaterThanOrEqual(100000);
      expect(otp).to.be.lessThan(1000000);
    });

    it('should generate different OTPs on subsequent calls', function () {
      const otp1 = generateOTP();
      const otp2 = generateOTP();

      expect(otp1).to.not.equal(otp2);
    });
  });

  describe('parseOTPInput', function () {
    it('should parse valid 6-digit OTP', function () {
      const result = parseOTPInput('123456');

      expect(result).to.equal('123456');
    });

    it('should extract digits from formatted input', function () {
      const result = parseOTPInput('123-456');

      expect(result).to.equal('123456');
    });

    it('should extract digits from spaced input', function () {
      const result = parseOTPInput('123 456');

      expect(result).to.equal('123456');
    });

    it('should return null for less than 6 digits', function () {
      const result = parseOTPInput('12345');

      expect(result).to.be.null;
    });

    it('should return null for non-numeric input', function () {
      const result = parseOTPInput('abcdef');

      expect(result).to.be.null;
    });

    it('should truncate to 6 digits if more provided', function () {
      const result = parseOTPInput('1234567890');

      expect(result).to.equal('123456');
    });

    it('should handle mixed alphanumeric input', function () {
      const result = parseOTPInput('1a2b3c4d5e6f');

      expect(result).to.equal('123456');
    });
  });
});

describe('Auth Policies', function () {
  describe('canManageUser', function () {
    it('should allow SUPER_ADMIN to manage any user', function () {
      const superAdmin = { memberType: 'SUPER_ADMIN', sub: 'admin-1' };
      const targetUserId = 'user-2';

      const result = canManageUser(superAdmin, targetUserId);

      expect(result).to.be.true;
    });

    it('should allow user to manage themselves', function () {
      const user = { memberType: 'EMPLOYEE', sub: 'user-1' };
      const targetUserId = 'user-1';

      const result = canManageUser(user, targetUserId);

      expect(result).to.be.true;
    });

    it('should reject EMPLOYEE managing different user', function () {
      const user = { memberType: 'EMPLOYEE', sub: 'user-1' };
      const targetUserId = 'user-2';

      const result = canManageUser(user, targetUserId);

      expect(result).to.be.false;
    });

    it('should reject HR_ADMIN managing different user', function () {
      const admin = { memberType: 'HR_ADMIN', sub: 'admin-1' };
      const targetUserId = 'user-1';

      const result = canManageUser(admin, targetUserId);

      expect(result).to.be.false;
    });

    it('should allow HR_ADMIN to manage themselves', function () {
      const admin = { memberType: 'HR_ADMIN', sub: 'admin-1' };
      const targetUserId = 'admin-1';

      const result = canManageUser(admin, targetUserId);

      expect(result).to.be.true;
    });
  });
});
