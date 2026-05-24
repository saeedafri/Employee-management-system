import * as settingsRepository from './settings.repository.js';

class AppError extends Error {
  constructor(message, code, statusCode = 400, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function getTenantConfig(tenantId) {
  const { tenant, config } = await settingsRepository.getTenantConfig(tenantId);

  return {
    // Tenant-level fields (company identity)
    legalName: tenant?.legalName ?? null,
    displayName: tenant?.displayName ?? null,
    country: tenant?.country ?? null,
    defaultCurrency: tenant?.defaultCurrency ?? null,
    primaryContactEmail: tenant?.primaryContactEmail ?? null,
    supportPhone: tenant?.supportPhone ?? null,
    logoUrl: tenant?.logoUrl ?? null,
    // TenantConfig operational fields
    company_name: config?.companyName ?? tenant?.name ?? null,
    timezone: config?.timezone ?? tenant?.timezone ?? null,
    working_hours_start: config?.workingHoursStart ?? null,
    working_hours_end: config?.workingHoursEnd ?? null,
    fiscal_year_start: config?.fiscalYearStart ?? null,
  };
}

export async function updateTenantConfig(tenantId, data) {
  const promises = [];

  const tenantFields = ['legalName', 'displayName', 'country', 'defaultCurrency', 'primaryContactEmail', 'supportPhone', 'logoUrl'];
  const hasTenantFields = tenantFields.some((f) => data[f] !== undefined);
  if (hasTenantFields) {
    promises.push(settingsRepository.updateTenantFields(tenantId, data));
  }

  const configFields = ['company_name', 'timezone', 'working_hours_start', 'working_hours_end'];
  const hasConfigFields = configFields.some((f) => data[f] !== undefined);
  if (hasConfigFields) {
    promises.push(settingsRepository.updateTenantConfig(tenantId, data));
  }

  await Promise.all(promises);
  return getTenantConfig(tenantId);
}

export async function getEmailTemplates(tenantId) {
  const templates = await settingsRepository.getEmailTemplates(tenantId);

  return {
    templates: templates.map((t) => ({
      id: t.id,
      type: t.type,
      subject: t.subject,
      body: t.body,
    })),
  };
}

export async function updateEmailTemplate(tenantId, type, data) {
  const template = await settingsRepository.updateEmailTemplate(tenantId, type, data);

  return {
    id: template.id,
    type: template.type,
    subject: template.subject,
    body: template.body,
  };
}

export async function getRolePermissions(tenantId) {
  const matrix = await settingsRepository.getRolePermissions(tenantId);

  const roles = Object.keys(matrix);
  const permissionSet = new Set(Object.values(matrix).flat());

  return {
    roles,
    permissions: Array.from(permissionSet).sort(),
    matrix,
  };
}

export async function updateRolePermissions(tenantId, roleKey, permissions) {
  if (roleKey === 'SUPER_ADMIN') {
    throw new AppError(
      'Cannot modify SUPER_ADMIN permissions',
      'CANNOT_LOCK_OUT_SUPER_ADMIN',
      403,
    );
  }

  try {
    await settingsRepository.updateRolePermissions(tenantId, roleKey, permissions);

    return {
      role: roleKey,
      permissions,
    };
  } catch (error) {
    if (error.message.includes('not found')) {
      throw new AppError('Role not found', 'ROLE_NOT_FOUND', 404);
    }
    throw error;
  }
}
