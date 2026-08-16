/**
 * BE-3 — `GET /export/list` must not disclose jobs the caller did not create.
 *
 * WHY THIS TEST LOOKS THE WAY IT DOES. The previous version of this file passed
 * while production leaked every job to every role. It built the request by hand:
 *
 *     user: { id: userId, memberType, permissions: [...] }
 *
 * `authenticate` never produces an `id`. The JWT carries the user id as `sub`
 * and `middleware/authenticate.js` assigned the payload verbatim, so the real
 * `request.user.id` was `undefined`, the repository's truthy guard dropped the
 * filter, and the query widened to the whole tenant. The test asserted against a
 * fixture that did not exist in production, so it could not fail.
 *
 * So this version mints a REAL token and drives it through the REAL middleware
 * via app.inject. `request.user` is whatever authenticate actually builds. If the
 * `sub`→`id` normalisation is removed, these tests fail.
 *
 * Run: node --test --experimental-test-module-mocks tests/export-list-scoping.test.js
 */
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../src/modules/auth/permissionCatalogue.js';

const TENANT = { id: 'tenant-1', tenantKey: 'acme-corp-001', name: 'Acme Corp', slug: 'acme' };
const HR_USER = 'user-hr';
const EMPLOYEE_USER = 'user-priya';

// Two jobs created by HR. The employee created nothing — they cannot: all three
// POST /export/* routes require an export permission they do not hold.
const JOBS = [
  { id: '1', jobId: 'job-hr-1', createdById: HR_USER, exportType: 'EMPLOYEES', format: 'csv', status: 'SUCCESS', fileUrl: 'cloudinary://ems/t1/exports/job-hr-1', errorMessage: null, createdAt: new Date(), completedAt: new Date() },
  { id: '2', jobId: 'job-hr-2', createdById: HR_USER, exportType: 'LEAVE', format: 'csv', status: 'SUCCESS', fileUrl: 'cloudinary://ems/t1/exports/job-hr-2', errorMessage: null, createdAt: new Date(), completedAt: new Date() },
  // One job the employee did create, to prove scoping returns rather than blanks.
  { id: '3', jobId: 'job-emp-1', createdById: EMPLOYEE_USER, exportType: 'ATTENDANCE', format: 'csv', status: 'SUCCESS', fileUrl: null, errorMessage: null, createdAt: new Date(), completedAt: new Date() },
  // A pre-fix row: created before createdById was recorded. Must stay invisible
  // to non-privileged callers rather than falling through the filter.
  { id: '4', jobId: 'job-legacy', createdById: null, exportType: 'EMPLOYEES', format: 'csv', status: 'SUCCESS', fileUrl: null, errorMessage: null, createdAt: new Date(), completedAt: new Date() },
];

const matches = (job, where) => {
  if (!('createdById' in where)) return true;
  return job.createdById === where.createdById;
};

function stubPrisma() {
  return new Proxy({
    tenant: { findUnique: async () => TENANT, findFirst: async () => TENANT },
    session: {
      findUnique: async ({ where }) => ({
        id: where.id,
        userId: where.id.replace(/^sess-/, ''),
        tenantId: TENANT.id,
        revokedAt: null,
      }),
    },
    exportJob: {
      findMany: async ({ where }) => JOBS.filter((job) => matches(job, where)),
      count: async ({ where }) => JOBS.filter((job) => matches(job, where)).length,
    },
    $disconnect: async () => {},
  }, { get: (t, p) => (p in t ? t[p] : new Proxy({}, { get: () => async () => null })) });
}

let app;
let createAccessToken;

before(async () => {
  process.env.NODE_ENV = 'test';
  mock.module('../src/plugins/prisma.js', {
    namedExports: { prisma: stubPrisma() },
    defaultExport: async () => {},
  });
  ({ createAccessToken } = await import('../src/utils/token.js'));
  const { createApp } = await import('../src/app.js');
  app = await createApp();
  await app.ready();
});

after(async () => { if (app) await app.close(); });

/** A token shaped exactly like the ones auth.service.js mints — `sub`, no `id`. */
async function tokenFor(userId, memberType) {
  return createAccessToken({
    sub: userId,
    tenantId: TENANT.id,
    memberType,
    employeeId: `emp-${userId}`,
    sessionId: `sess-${userId}`,
    permissions: [...DEFAULT_PERMISSIONS_BY_ROLE[memberType]],
  });
}

async function listAs(userId, memberType) {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/export/list?page=1&limit=50',
    headers: {
      'x-tenant-key': TENANT.tenantKey,
      authorization: `Bearer ${await tokenFor(userId, memberType)}`,
    },
  });
  return { status: response.statusCode, body: response.json() };
}

describe('GET /export/list — scoping survives the real auth path', () => {
  it('an EMPLOYEE cannot see a job created by HR', async () => {
    const { status, body } = await listAs(EMPLOYEE_USER, 'EMPLOYEE');
    assert.equal(status, 200);
    const ids = body.data.exports.map((job) => job.job_id);
    assert.ok(!ids.includes('job-hr-1'), `leaked HR job: ${ids.join(', ')}`);
    assert.ok(!ids.includes('job-hr-2'), `leaked HR job: ${ids.join(', ')}`);
  });

  it('an EMPLOYEE still sees the job they did create', async () => {
    const { body } = await listAs(EMPLOYEE_USER, 'EMPLOYEE');
    assert.deepEqual(body.data.exports.map((job) => job.job_id), ['job-emp-1']);
  });

  it('pre-fix rows with a NULL createdById stay hidden from non-privileged callers', async () => {
    const { body } = await listAs(EMPLOYEE_USER, 'EMPLOYEE');
    assert.ok(!body.data.exports.some((job) => job.job_id === 'job-legacy'));
  });

  it('HR_ADMIN, holding the export keys, still sees every job including legacy rows', async () => {
    const { status, body } = await listAs(HR_USER, 'HR_ADMIN');
    assert.equal(status, 200);
    assert.equal(body.data.exports.length, JOBS.length);
  });

  it('never returns the storage path', async () => {
    for (const [user, role] of [[EMPLOYEE_USER, 'EMPLOYEE'], [HR_USER, 'HR_ADMIN']]) {
      const { body } = await listAs(user, role);
      for (const job of body.data.exports) {
        assert.ok(!('file_url' in job), `${role}: file_url must not be in the list response`);
      }
    }
  });
});

describe('authenticate normalises the user id', () => {
  it('exposes request.user.id from the JWT sub claim', async () => {
    // Asserted through behaviour rather than by inspecting the object: the
    // employee's scoped listing can only match if `.id` resolved to `sub`.
    const { body } = await listAs(EMPLOYEE_USER, 'EMPLOYEE');
    assert.equal(body.data.exports.length, 1, 'scoping only works when sub→id lands');
  });
});

describe('the repository refuses to be under-specified', () => {
  it('throws instead of widening when a scoped listing has no createdById', async () => {
    const { listExportJobs } = await import('../src/modules/export/export.repository.js');
    await assert.rejects(
      () => listExportJobs(TENANT.id, 1, 10, null, { all: false, createdById: undefined }),
      /non-empty createdById/,
      'an undefined scope must throw, not silently return every row',
    );
    await assert.rejects(
      () => listExportJobs(TENANT.id, 1, 10, null, {}),
      /scope must be/,
    );
  });
});
