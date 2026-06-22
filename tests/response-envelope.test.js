import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { errorResponse } from '../src/utils/response.js';
import { requestIdPlugin } from '../src/plugins/requestId.js';

test('errorResponse preserves contract for explicit details and requestId', () => {
  const response = errorResponse(
    'VALIDATION_ERROR',
    'Request validation failed',
    [{ field: 'email', message: 'Invalid email' }],
    'req-123',
  );

  assert.deepEqual(response, {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: [{ field: 'email', message: 'Invalid email' }],
      requestId: 'req-123',
    },
  });
});

test('errorResponse tolerates legacy third-argument requestId calls', () => {
  const response = errorResponse('FORBIDDEN', 'Not allowed', 'req-legacy');

  assert.deepEqual(response, {
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Not allowed',
      details: {},
      requestId: 'req-legacy',
    },
  });
});

test('requestIdPlugin exposes request.id, request.requestId, and x-request-id', async () => {
  const app = Fastify();
  await app.register(requestIdPlugin);
  app.get('/probe', async (request) => ({
    id: request.id,
    requestId: request.requestId,
  }));

  const response = await app.inject({
    method: 'GET',
    url: '/probe',
    headers: { 'x-request-id': 'req-probe' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { id: 'req-probe', requestId: 'req-probe' });
  assert.equal(response.headers['x-request-id'], 'req-probe');

  await app.close();
});
