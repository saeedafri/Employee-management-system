import { prisma } from '../plugins/prisma.js';
import { config } from '../config/index.js';

/**
 * Multi-tenant resolution middleware.
 *
 * Resolution order (first match wins):
 *   1. Subdomain from Host header  — acme.yourems.com → slug "acme"
 *   2. X-Tenant-Key header         — explicit key for API/Postman/Swagger
 *   3. JWT payload tenantId        — for already-authenticated requests (no header needed)
 *   4. DEFAULT_TENANT_KEY env var  — dev/testing fallback
 *
 * Routes in TENANT_OPTIONAL_ROUTES skip the "missing tenant" error — their
 * controllers resolve tenant themselves from the email address in the body.
 */

const TENANT_OPTIONAL_ROUTES = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/admin/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/validate-reset-token',
  '/api/v1/auth/reset-password/validate',
  '/api/v1/auth/verify-otp',
  '/api/v1/auth/resend-otp',
]);

/**
 * Extract tenant slug from Host header when APP_DOMAIN is configured.
 * "acme.yourems.com" with appDomain="yourems.com" → "acme"
 * "localhost:3000" or "yourems.com" (no subdomain) → null
 */
function slugFromHost(host) {
  if (!config.appDomain || !host) return null;
  const hostname = host.split(':')[0].toLowerCase();
  const root = config.appDomain.toLowerCase();
  // Must end with .appDomain and have something before the dot
  if (!hostname.endsWith('.' + root)) return null;
  const sub = hostname.slice(0, hostname.length - root.length - 1);
  // Reject empty, www, api — those aren't tenant subdomains
  if (!sub || sub === 'www' || sub === 'api' || sub === 'app') return null;
  return sub;
}

/**
 * Decode JWT payload without verifying signature.
 * authenticate() verifies properly; we only need tenantId here for routing.
 * A forged token is caught at authenticate() time before any data is touched.
 */
function tenantIdFromJwt(jwt) {
  const match = jwt?.match(/^eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/);
  if (!match) return null;
  try {
    const payload = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
    return payload?.tenantId || null;
  } catch {
    return null;
  }
}

function tenantIdFromAuthHeader(authHeader) {
  if (!authHeader) return null;
  const raw = authHeader.replace(/^Bearer\s+/i, '').trim();
  return tenantIdFromJwt(raw);
}

export async function resolveTenant(request, reply) {
  const path = request.routeOptions?.url || request.url.split('?')[0];
  const isTenantOptional = TENANT_OPTIONAL_ROUTES.has(path);

  // Layer 1: Subdomain (slug lookup)
  const slug = slugFromHost(request.headers.host);

  // Layer 2: Explicit header key
  const tenantKey = !slug ? (request.headers['x-tenant-key'] || null) : null;

  // Layer 3: JWT payload tenantId — from Authorization header OR accessToken cookie
  const tenantId = (!slug && !tenantKey)
    ? (tenantIdFromAuthHeader(request.headers.authorization) || tenantIdFromJwt(request.cookies?.accessToken))
    : null;

  // Layer 4: Default key from env
  const fallbackKey = (!slug && !tenantKey && !tenantId)
    ? (config.defaultTenantKey || null)
    : null;

  const hasAnyIdentifier = slug || tenantKey || tenantId || fallbackKey;

  if (!hasAnyIdentifier) {
    if (isTenantOptional) return;
    return reply.code(400).send({
      success: false,
      error: {
        code: 'MISSING_TENANT',
        message: 'Tenant context missing. Options: use a company subdomain, send X-Tenant-Key header, or log in first (JWT carries tenant automatically).',
      },
    });
  }

  // Build Prisma where clause — prefer more specific identifiers first
  let where;
  if (slug) {
    where = { slug };
  } else if (tenantKey || fallbackKey) {
    where = { tenantKey: tenantKey || fallbackKey };
  } else {
    where = { id: tenantId };
  }

  const tenant = await prisma.tenant.findUnique({ where });

  if (!tenant) {
    if (isTenantOptional) return;
    const hint = slug
      ? `No tenant with subdomain "${slug}".`
      : tenantKey
        ? `No tenant with key "${tenantKey}".`
        : 'Tenant not found.';
    return reply.code(400).send({
      success: false,
      error: { code: 'INVALID_TENANT', message: hint },
    });
  }

  if (tenant.deletedAt) {
    return reply.code(403).send({
      success: false,
      error: { code: 'TENANT_INACTIVE', message: 'This organization account is no longer active.' },
    });
  }

  request.tenant = {
    id: tenant.id,
    tenantKey: tenant.tenantKey,
    slug: tenant.slug,
    name: tenant.name,
    timezone: tenant.timezone,
  };
}
