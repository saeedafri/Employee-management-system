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
  const config = await settingsRepository.getTenantConfig(tenantId);

  return {
    company_name: config.companyName,
    timezone: config.timezone,
    working_hours_start: config.workingHoursStart,
    working_hours_end: config.workingHoursEnd,
    fiscal_year_start: config.fiscalYearStart,
  };
}

export async function updateTenantConfig(tenantId, data) {
  const config = await settingsRepository.updateTenantConfig(tenantId, data);

  return {
    company_name: config.companyName,
    timezone: config.timezone,
    working_hours_start: config.workingHoursStart,
    working_hours_end: config.workingHoursEnd,
    fiscal_year_start: config.fiscalYearStart,
  };
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
