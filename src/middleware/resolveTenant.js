import { prisma } from '../plugins/prisma.js';
import { config } from '../config/index.js';

// Routes that resolve their tenant from the request body (email lookup) instead
// of requiring an X-Tenant-Key header up-front. The login controller does this.
const TENANT_OPTIONAL_ROUTES = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/admin/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/validate-reset-token',
  '/api/v1/auth/verify-otp',
  '/api/v1/auth/resend-otp',
]);

// Decode a JWT payload without verifying the signature. The `authenticate`
// middleware (which runs after this one on protected routes) verifies properly;
// we only need tenantId here to look up the tenant. A forged token gets caught
// at authenticate time.
function tenantIdFromAuthHeader(authHeader) {
  if (!authHeader) return null;
  const raw = authHeader.replace(/^Bearer\s+/i, '').trim();
  const match = raw.match(/^(eyJ[A-Za-z0-9_\-]+)\.(eyJ[A-Za-z0-9_\-]+)\.[A-Za-z0-9_\-]+/);
  if (!match) return null;
  try {
    const payload = JSON.parse(Buffer.from(match[2], 'base64url').toString('utf8'));
    return payload?.tenantId || null;
  } catch {
    return null;
  }
}

export async function resolveTenant(request, reply) {
  const path = request.routeOptions?.url || request.url.split('?')[0];
  const isTenantOptional = TENANT_OPTIONAL_ROUTES.has(path);

  // Resolution order: explicit header → JWT payload → DEFAULT_TENANT_KEY env
  let tenantKey = request.headers['x-tenant-key'] || null;
  let tenantId = null;
  if (!tenantKey) {
    tenantId = tenantIdFromAuthHeader(request.headers.authorization);
  }
  if (!tenantKey && !tenantId) {
    tenantKey = config.defaultTenantKey || null;
  }

  if (!tenantKey && !tenantId) {
    if (isTenantOptional) return; // login controllers will resolve tenant themselves
    return reply.code(400).send({
      success: false,
      error: {
        code: 'MISSING_TENANT',
        message: 'Tenant not specified. Send X-Tenant-Key header, or log in via /auth/login to obtain a token that carries it.',
      },
    });
  }

  const tenant = await prisma.tenant.findUnique({
    where: tenantId ? { id: tenantId } : { tenantKey },
  });

  if (!tenant) {
    if (isTenantOptional) return; // let the login controller try email-based resolution
    return reply.code(400).send({
      success: false,
      error: {
        code: 'INVALID_TENANT',
        message: 'Tenant not found',
      },
    });
  }

  request.tenant = {
    id: tenant.id,
    tenantKey: tenant.tenantKey,
    name: tenant.name,
    timezone: tenant.timezone,
  };
}
