import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as logsService from '../../src/modules/logs/logs.service.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('Logs Service Unit Tests', function () {
  this.timeout(10000);
  let testTenant;
  let testUser;

  beforeEach(async function () {
    await prisma.logEntry.deleteMany({});
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
        email: 'user@test.com',
        passwordHash: 'hash',
        memberType: 'EMPLOYEE',
        status: 'ACTIVE',
      },
    });
  });

  afterEach(async function () {
    await prisma.logEntry.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.tenant.deleteMany({});
  });

  describe('createLog', function () {
    it('should create a log entry', async function () {
      const log = await logsService.createLog(
        testTenant.id,
        'error',
        'Error',
        '#FF0000',
        'auth',
        'Test error message',
        'req-123',
        testUser.id,
        { key: 'value' },
      );

      expect(log).to.have.property('id');
      expect(log.level).to.equal('error');
      expect(log.levelLabel).to.equal('Error');
      expect(log.levelColor).to.equal('#FF0000');
      expect(log.module).to.equal('auth');
      expect(log.message).to.equal('Test error message');
    });

    it('should include formatted IST timestamp', async function () {
      const log = await logsService.createLog(
        testTenant.id,
        'info',
        'Info',
        '#0000FF',
        'test',
        'Test message',
        'req-123',
        testUser.id,
        {},
      );

      expect(log).to.have.property('timestampIstDisplay');
      expect(log.timestampIstDisplay).to.match(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/);
    });

    it('should include UTC timestamp', async function () {
      const log = await logsService.createLog(
        testTenant.id,
        'info',
        'Info',
        '#0000FF',
        'test',
        'Test message',
        'req-123',
        testUser.id,
        {},
      );

      expect(log).to.have.property('timestampUtc');
      expect(log.timestampUtc).to.be.a('string');
    });

    it('should support null metadata', async function () {
      const log = await logsService.createLog(
        testTenant.id,
        'info',
        'Info',
        '#0000FF',
        'test',
        'Test message',
        'req-123',
        null,
        null,
      );

      expect(log).to.have.property('id');
      expect(log.actorUserId).to.be.null;
    });
  });

  describe('getLogs', function () {
    beforeEach(async function () {
      await logsService.createLog(
        testTenant.id,
        'error',
        'Error',
        '#FF0000',
        'auth',
        'Auth error',
        'req-1',
        testUser.id,
        {},
      );

      await logsService.createLog(
        testTenant.id,
        'warn',
        'Warn',
        '#FFA500',
        'user',
        'User warning',
        'req-2',
        testUser.id,
        {},
      );

      await logsService.createLog(
        testTenant.id,
        'info',
        'Info',
        '#0000FF',
        'auth',
        'Auth info',
        'req-3',
        testUser.id,
        {},
      );
    });

    it('should retrieve all logs for tenant', async function () {
      const logs = await logsService.getLogs(testTenant.id);

      expect(logs).to.be.an('array');
      expect(logs.length).to.equal(3);
    });

    it('should filter logs by level', async function () {
      const logs = await logsService.getLogs(testTenant.id, { level: 'error' });

      expect(logs.length).to.equal(1);
      expect(logs[0].level).to.equal('error');
    });

    it('should filter logs by module', async function () {
      const logs = await logsService.getLogs(testTenant.id, { module: 'auth' });

      expect(logs.length).to.equal(2);
      expect(logs[0].module).to.equal('auth');
    });

    it('should filter logs by actorUserId', async function () {
      const logs = await logsService.getLogs(testTenant.id, { actorUserId: testUser.id });

      expect(logs.length).to.equal(3);
    });

    it('should respect limit and offset', async function () {
      const logs = await logsService.getLogs(testTenant.id, { limit: 2, offset: 0 });

      expect(logs.length).to.equal(2);
    });

    it('should return logs ordered by most recent first', async function () {
      const logs = await logsService.getLogs(testTenant.id);

      const timestamp0 = new Date(logs[0].timestampUtc);
      const timestampLast = new Date(logs[logs.length - 1].timestampUtc);
      expect(timestamp0.getTime()).to.be.greaterThanOrEqual(timestampLast.getTime());
    });

    it('should filter by date range', async function () {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const logs = await logsService.getLogs(testTenant.id, {
        startDate: yesterday.toISOString(),
        endDate: tomorrow.toISOString(),
      });

      expect(logs.length).to.equal(3);
    });
  });

  describe('getLogById', function () {
    it('should retrieve log by ID', async function () {
      const createdLog = await logsService.createLog(
        testTenant.id,
        'error',
        'Error',
        '#FF0000',
        'auth',
        'Test error',
        'req-123',
        testUser.id,
        {},
      );

      const log = await logsService.getLogById(testTenant.id, createdLog.id);

      expect(log).to.not.be.null;
      expect(log.id).to.equal(createdLog.id);
      expect(log.message).to.equal('Test error');
    });

    it('should return null for non-existent log', async function () {
      const log = await logsService.getLogById(testTenant.id, 'nonexistent-id');

      expect(log).to.be.null;
    });

    it('should not retrieve logs from other tenants', async function () {
      const otherTenant = await prisma.tenant.create({
        data: {
          tenantKey: `other-${Date.now()}`,
          name: 'Other Tenant',
          legalName: 'Other',
          displayName: 'Other',
          country: 'US',
          primaryContactEmail: 'other@test.com',
        },
      });

      const createdLog = await logsService.createLog(
        testTenant.id,
        'error',
        'Error',
        '#FF0000',
        'auth',
        'Test error',
        'req-123',
        testUser.id,
        {},
      );

      const log = await logsService.getLogById(otherTenant.id, createdLog.id);

      expect(log).to.be.null;
    });
  });

  describe('getLogsForExport', function () {
    beforeEach(async function () {
      await logsService.createLog(
        testTenant.id,
        'error',
        'Error',
        '#FF0000',
        'auth',
        'Auth error',
        'req-1',
        testUser.id,
        {},
      );

      await logsService.createLog(
        testTenant.id,
        'warn',
        'Warn',
        '#FFA500',
        'user',
        'User warning',
        'req-2',
        testUser.id,
        {},
      );
    });

    it('should retrieve all logs for export', async function () {
      const logs = await logsService.getLogsForExport(testTenant.id);

      expect(logs).to.be.an('array');
      expect(logs.length).to.equal(2);
    });

    it('should filter export logs by level', async function () {
      const logs = await logsService.getLogsForExport(testTenant.id, { level: 'error' });

      expect(logs.length).to.equal(1);
      expect(logs[0].level).to.equal('error');
    });

    it('should filter export logs by module', async function () {
      const logs = await logsService.getLogsForExport(testTenant.id, { module: 'auth' });

      expect(logs.length).to.equal(1);
    });

    it('should not have pagination limits for export', async function () {
      const logs = await logsService.getLogsForExport(testTenant.id);

      expect(logs.length).to.equal(2);
    });
  });

  describe('formatLogEntry', function () {
    it('should format log entry with correct structure', async function () {
      const log = await logsService.createLog(
        testTenant.id,
        'error',
        'Error',
        '#FF0000',
        'auth',
        'Test error',
        'req-123',
        testUser.id,
        { key: 'value' },
      );

      expect(log).to.have.all.keys(
        'id',
        'level',
        'levelLabel',
        'levelColor',
        'module',
        'message',
        'requestId',
        'actorUserId',
        'tenantId',
        'metadata',
        'timestampUtc',
        'timestampIstDisplay',
      );
    });

    it('should include actor email in formatted output', async function () {
      const log = await logsService.createLog(
        testTenant.id,
        'error',
        'Error',
        '#FF0000',
        'auth',
        'Test error',
        'req-123',
        testUser.id,
        {},
      );

      const retrieved = await logsService.getLogById(testTenant.id, log.id);
      expect(retrieved).to.have.property('id');
    });
  });

  describe('timestamp formatting', function () {
    it('should format IST timestamp correctly', async function () {
      const log = await logsService.createLog(
        testTenant.id,
        'info',
        'Info',
        '#0000FF',
        'test',
        'Test',
        'req-1',
        null,
        {},
      );

      expect(log.timestampIstDisplay).to.match(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2} (AM|PM) IST/);
    });

    it('should provide UTC ISO timestamp', async function () {
      const log = await logsService.createLog(
        testTenant.id,
        'info',
        'Info',
        '#0000FF',
        'test',
        'Test',
        'req-1',
        null,
        {},
      );

      expect(log.timestampUtc).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
