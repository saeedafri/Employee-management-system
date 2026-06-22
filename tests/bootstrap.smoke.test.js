// Phase 0.1 — Bootstrap verify.
// Proves the existing Fastify app boots end-to-end (plugins + Prisma + routes +
// Swagger register without throwing) and the health endpoints answer.
// Runner: Node's built-in test runner (`node --test`) — the runner this repo uses.
//
// Requires a reachable LOCAL database (docker compose up + ems_test). NEVER run
// against the live Hostinger/Render DB.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';

let app;

before(async () => {
  app = await createApp();
  await app.ready();
});

after(async () => {
  if (app) await app.close();
});

test('app boots and GET /health returns { status: "ok" }', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, 'ok');
});

test('GET /healthz returns { status: "ok" }', async () => {
  const res = await app.inject({ method: 'GET', url: '/healthz' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, 'ok');
});

test('Swagger UI is served at /docs', async () => {
  const res = await app.inject({ method: 'GET', url: '/docs' });
  // @fastify/swagger-ui serves the UI at /docs (200) or redirects to /docs/ (3xx).
  assert.ok(
    res.statusCode === 200 || (res.statusCode >= 300 && res.statusCode < 400),
    `expected 200 or redirect from /docs, got ${res.statusCode}`,
  );
});

test('Prisma can reach the configured database', async () => {
  const rows = await prisma.$queryRaw`SELECT 1 AS ok`;
  assert.equal(Number(rows[0]?.ok), 1);
});
