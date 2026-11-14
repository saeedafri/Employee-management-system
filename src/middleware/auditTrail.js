import { recordAuditLog } from '../modules/auditLogs/auditLogs.service.js';
import { logger } from '../utils/logger.js';

// One audit row for every successful authenticated write, recorded where all writes pass
// through. Leave decisions, attendance, regularizations, holidays, departments, policy
// seeding and manual balance adjustments previously left no trail at all.
const SKIP = /\/(auth|notifications)\/|\/preview$|\/stream$/;
const SECRET = /pass(word)?|token|secret|^otp$|^code$|accountnumber|^iban$|^ifsc$|^pan(number)?$|aadhaar|^ssn$|^cvv$/i;
const MAX_JSON = 4000;

export function redact(value, depth = 0) {
  if (value === null || typeof value !== 'object' || depth > 3) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET.test(k) ? '[REDACTED]' : redact(v, depth + 1)]));
}

// "/api/v1/leave/requests/:id/approve" -> entityType "leave", action "PATCH leave/requests/:id/approve"
export function describe(method, routePath) {
  const path = routePath.replace(/^\/api\/v\d+\//, '');
  return { entityType: path.split('/')[0], action: `${method} ${path}` };
}

export function auditTrail(fastify) {
  fastify.addHook('onSend', async (request, reply, payload) => {
    const { method } = request;
    const route = request.routeOptions?.url ?? '';
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return payload;
    if (reply.statusCode >= 300 || !request.user?.sub || !request.tenant?.id || SKIP.test(route)) return payload;

    let createdId;
    if (typeof payload === 'string' && payload.length < 65536) {
      try { createdId = JSON.parse(payload)?.data?.id; } catch { /* not JSON */ }
    }
    const p = request.params ?? {};
    const entityId = String(p.id ?? p.employeeId ?? p.runId ?? p.key ?? p.type ?? createdId ?? '-');
    const { entityType, action } = describe(method, route);
    let body = redact(request.body ?? null);
    if (body && JSON.stringify(body).length > MAX_JSON) body = { truncated: true, keys: Object.keys(body) };

    recordAuditLog(request.tenant.id, request.user.sub, action, entityType, entityId, null, body, request.ip, request.headers['user-agent'] ?? null)
      .catch((err) => logger.warn({ type: 'audit_trail_failed', route, error: err.message }));
    return payload;
  });
}
