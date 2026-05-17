import { prisma } from '../plugins/prisma.js';
import { config } from '../config/index.js';

export async function resolveTenant(request, reply) {
  const tenantKey = request.headers['x-tenant-key'] || config.defaultTenantKey;

  if (!tenantKey) {
    return reply.code(400).send({
      success: false,
      error: {
        code: 'MISSING_TENANT',
        message: 'Tenant not specified. Use X-Tenant-Key header or configure DEFAULT_TENANT_KEY.',
      },
    });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { tenantKey },
  });

  if (!tenant) {
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
