import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';

const TENANT_KEY = 'acme-corp-001';
const PASSWORD = 'Password123!';
const ROLE_PREFIX = 'CONTRACT_ROLE_';

let app;
let accessToken;

test.before(async () => {
  app = await createApp();
  await app.ready();

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT_KEY,
    },
    payload: {
      email: 'superadmin@acme.test',
      password: PASSWORD,
    },
  });

  assert.equal(loginResponse.statusCode, 200);
  accessToken = loginResponse.json().data.accessToken;
});

test.after(async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { tenantKey: TENANT_KEY },
    select: { id: true },
  });

  if (tenant) {
    await prisma.role.deleteMany({
      where: {
        tenantId: tenant.id,
        key: { startsWith: ROLE_PREFIX },
      },
    });
  }

  if (app) await app.close();
});

test('POST /settings/roles persists permissions and exposes custom role metadata', async () => {
  const roleKey = `${ROLE_PREFIX}${Date.now()}`;
  const permissions = ['employees:read', 'leave:approve'];

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/settings/roles',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    payload: {
      key: roleKey,
      name: 'Contract Role',
      permissions,
    },
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json();
  assert.equal(created.success, true);
  assert.equal(created.data.key, roleKey);
  assert.deepEqual([...created.data.permissions].sort(), [...permissions].sort());

  const matrixResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/settings/roles-permissions',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(matrixResponse.statusCode, 200);
  const matrix = matrixResponse.json().data;
  assert.deepEqual([...matrix.matrix[roleKey]].sort(), [...permissions].sort());
  assert.ok(
    matrix.customRoles.some((role) => role.key === roleKey && role.name === 'Contract Role'),
  );

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/settings/roles/${roleKey}`,
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(deleteResponse.statusCode, 200);
  assert.deepEqual(deleteResponse.json().data, { key: roleKey, status: 'deleted' });
});
