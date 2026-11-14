import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';
import { config } from '../config/index.js';

// fp() so the limiter applies to routes registered on the root instance; without it the
// plugin lived in an encapsulated child context with no routes and limited nothing.
// global: false — every browser request reaches us through the BFF's few egress IPs, so a
// per-IP global bucket would throttle the whole company together. Limits are per route.
// Off under NODE_ENV=test: the DB suite logs the same seeded users in dozens of times.
// ponytail: in-memory store, per process; pass `redis` (ioredis) here when running >1 instance.
export const rateLimitPlugin = fp(async (fastify, { enabled = config.env !== 'test' } = {}) => {
  if (!enabled) return;
  await fastify.register(fastifyRateLimit, {
    global: false,
    cache: 10000,
    // The plugin's default throws a plain object; the app's errorHandler only honours
    // coded errors, so a limited request surfaced as 500. Throw a coded 429 instead.
    errorResponseBuilder: (req, ctx) => Object.assign(
      new Error(`Too many attempts. Try again in ${ctx.after}.`),
      { statusCode: 429, code: 'RATE_LIMITED' },
    ),
  });
});

// Route `config.rateLimit` keyed by the account being targeted (email / OTP challenge /
// reset token), not the caller IP: credential stuffing targets accounts, and the IP is
// the shared BFF anyway. preHandler so the parsed body is available to the key.
export function perAccount(max, timeWindow) {
  return {
    max,
    timeWindow,
    hook: 'preHandler',
    keyGenerator: (req) => {
      const b = req.body ?? {};
      return `acct:${String(b.email ?? b.challengeId ?? b.token ?? req.ip).trim().toLowerCase()}`;
    },
  };
}
