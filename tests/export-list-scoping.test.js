/**
 * BE-3 — `GET /export/list` was `authenticate`-only and unfiltered, so an
 * EMPLOYEE saw all 7 tenant jobs (including EMPLOYEES bulk exports they never
 * requested) plus each job's storage path. The download was already correctly
 * 403'd, so no file content escaped — but the job list itself should not be
 * visible, and `file_url` should not be in the list response at all.
 *
 * Run: node --test --experimental-test-module-mocks tests/export-list-scoping.test.js
 */
import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../src/modules/auth/permissionCatalogue.js';

const JOBS = [
  { jobId: 'j1', createdById: 'user-hr', exportType: 'EMPLOYEES', format: 'csv', status: 'SUCCESS', fileUrl: 'cloudinary://ems/t1/exports/j1', errorMessage: null, createdAt: new Date(), completedAt: new Date() },
  { jobId: 'j2', createdById: 'user-priya', exportType: 'LEAVE', format: 'csv', status: 'SUCCESS', fileUrl: 'cloudinary://ems/t1/exports/j2', errorMessage: null, createdAt: new Date(), completedAt: new Date() },
];

const prismaStub = {
  exportJob: {
    findMany: async ({ where }) => JOBS.filter((job) => !where.createdById || job.createdById === where.createdById),
    count: async ({ where }) => JOBS.filter((job) => !where.createdById || job.createdById === where.createdById).length,
  },
};

let listExports;

before(async () => {
  mock.module('../src/plugins/prisma.js', {
    namedExports: { prisma: prismaStub },
    defaultExport: async () => {},
  });
  ({ listExports } = await import('../src/modules/export/export.controller.js'));
});

function callAs(memberType, userId) {
  let captured;
  const request = {
    tenant: { id: 't1' },
    query: {},
    id: 'req-1',
    log: { error: () => {} },
    user: { id: userId, memberType, permissions: [...DEFAULT_PERMISSIONS_BY_ROLE[memberType]] },
  };
  const reply = {
    send: (payload) => { captured = payload; return reply; },
    code: () => reply,
    status: () => reply,
  };
  return listExports(request, reply).then(() => captured.data);
}

describe('GET /export/list is scoped to the caller', () => {
  it('EMPLOYEE sees only the jobs they requested', async () => {
    const data = await callAs('EMPLOYEE', 'user-priya');
    assert.deepEqual(data.exports.map((job) => job.job_id), ['j2']);
  });

  it('HR_ADMIN (holds the export keys) still sees every job', async () => {
    const data = await callAs('HR_ADMIN', 'user-hr');
    assert.equal(data.exports.length, JOBS.length);
  });

  it('never returns the storage path', async () => {
    for (const role of ['EMPLOYEE', 'HR_ADMIN']) {
      const data = await callAs(role, `user-${role}`);
      for (const job of data.exports) {
        assert.ok(!('file_url' in job), `${role}: file_url must not be in the list response`);
      }
    }
  });
});
