import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { rateLimitPlugin, perAccount } from '../src/plugins/rateLimit.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

// The limiter used to register inside an encapsulated child context (no fp) and the auth
// routes put `rateLimit` at the top level of route options, which @fastify/rate-limit v9
// never reads — so nothing was ever limited. This pins both halves of the wiring.
test('per-account limit applies to a route registered on the root instance', async () => {
  const app = Fastify();
  app.setErrorHandler(errorHandler); // the app's real handler: a limited request must stay 429, not 500
  await app.register(rateLimitPlugin, { enabled: true });
  app.post('/login', { config: { rateLimit: perAccount(2, '1 minute') } }, async () => ({ ok: true }));

  const hit = (email) => app.inject({ method: 'POST', url: '/login', payload: { email } });
  assert.equal((await hit('A@x.test')).statusCode, 200);
  assert.equal((await hit('a@x.test')).statusCode, 200);
  const limited = await hit('a@x.test');
  assert.equal(limited.statusCode, 429, 'third attempt on the same account (case-insensitive) is limited');
  assert.equal(JSON.parse(limited.body).error.code, 'RATE_LIMITED');
  assert.equal((await hit('b@x.test')).statusCode, 200, 'another account behind the same IP is not affected');
  await app.close();
});
