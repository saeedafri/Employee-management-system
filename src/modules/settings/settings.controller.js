import { successResponse, errorResponse } from '../../utils/response.js';
import * as settingsService from './settings.service.js';
import * as settingsValidator from './settings.validator.js';
import * as integrationsService from './integrations.service.js';

export async function getTenantConfig(request, reply) {
  try {
    const tenantId = request.tenant.id;

    const config = await settingsService.getTenantConfig(tenantId);

    return reply.send(successResponse(config));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function updateTenantConfig(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const body = settingsValidator.updateTenantConfigSchema.parse(request.body);

    const config = await settingsService.updateTenantConfig(tenantId, body);

    await request.log.info({
      action: 'TENANT_CONFIG_UPDATED',
      fields: Object.keys(body),
    });

    return reply.send(successResponse(config));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function getEmailTemplates(request, reply) {
  try {
    const tenantId = request.tenant.id;

    const templates = await settingsService.getEmailTemplates(tenantId);

    return reply.send(successResponse(templates));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function updateEmailTemplate(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const { type } = request.params;

    const body = settingsValidator.updateEmailTemplateSchema.parse(request.body);

    const template = await settingsService.updateEmailTemplate(tenantId, type, body);

    await request.log.info({
      action: 'EMAIL_TEMPLATE_UPDATED',
      template_type: type,
    });

    return reply.send(successResponse(template));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function getRolePermissions(request, reply) {
  try {
    const tenantId = request.tenant.id;

    const rolePermissions = await settingsService.getRolePermissions(tenantId);

    return reply.send(successResponse(rolePermissions));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function updateRolePermissions(request, reply) {
  try {
    const tenantId = request.tenant.id;

    const body = settingsValidator.updateRolesPermissionsSchema.parse(request.body);

    const result = await settingsService.updateRolePermissions(tenantId, body.role, body.permissions);

    await request.log.info({
      action: 'ROLE_PERMISSIONS_UPDATED',
      role: body.role,
      permission_count: body.permissions.length,
    });

    return reply.send(successResponse(result));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}
const wrap = (fn) => async (req, rep) => {
  try { return rep.send(successResponse(await fn(req, rep))); }
  catch (e) { return rep.status(e.statusCode || 500).send(errorResponse(e.code || 'ERROR', e.message, {}, req.id)); }
};

export const getBranding = wrap(async (req) => settingsService.getBranding(req.tenant.id));
export const updateBranding = wrap(async (req) => settingsService.updateBranding(req.tenant.id, req.body));
export const getAttendanceRules = wrap(async (req) => settingsService.getAttendanceRules(req.tenant.id));
export const updateAttendanceRules = wrap(async (req) => settingsService.updateAttendanceRules(req.tenant.id, req.body));
export const getAuthSettings = wrap(async (req) => settingsService.getAuthSettings(req.tenant.id));
export const updateAuthSettings = wrap(async (req) => settingsService.updateAuthSettings(req.tenant.id, req.body));
export const getNotificationPreferences = wrap(async (req) => settingsService.getNotificationPreferences(req.tenant.id, req.user.sub));
export const updateNotificationPreferences = wrap(async (req) => settingsService.updateNotificationPreferences(req.tenant.id, req.user.sub, req.body));
export const getLeaveTypes = wrap(async (req) => { const { getLeaveTypes: fn } = await import('../leave/leave.service.js'); return fn(req.tenant.id); });
export const createLeaveType = wrap(async (req) => { const { createLeaveType: fn } = await import('../leave/leave.service.js'); return fn(req.tenant.id, req.body); });
export const updateLeaveType = wrap(async (req) => { const { updateLeaveType: fn } = await import('../leave/leave.service.js'); return fn(req.tenant.id, req.params.id, req.body); });
export const deleteLeaveType = wrap(async (req, rep) => { const { deleteLeaveType: fn } = await import('../leave/leave.service.js'); const r = await fn(req.tenant.id, req.params.id); rep.code(200); return r; });
export const createRole = wrap(async (req, rep) => { rep.code(201); return settingsService.createRole(req.tenant.id, req.body); });
export const deleteRole = wrap(async (req) => settingsService.deleteRole(req.tenant.id, req.params.key));
export const assignUsersToRole = wrap(async (req) => settingsService.assignUsersToRole(req.tenant.id, req.params.key, req.body.userIds));

export const getEmailIntegration = wrap(async (req) => integrationsService.getEmailIntegration(req.tenant.id));
export const updateEmailIntegration = wrap(async (req) => integrationsService.updateEmailIntegration(req.tenant.id, req.body));
export const getEmailIntegrationStats = wrap(async (req) => integrationsService.getEmailIntegrationStats(req.tenant.id));
export const getStorageIntegration = wrap(async (req) => integrationsService.getStorageIntegration(req.tenant.id));
export const updateStorageIntegration = wrap(async (req) => integrationsService.updateStorageIntegration(req.tenant.id, req.body));
export const testStorageIntegration = wrap(async (req) => integrationsService.testStorageIntegration(req.tenant.id));
export const listWebhooks = wrap(async (req) => integrationsService.listWebhooks(req.tenant.id));
export const createWebhook = wrap(async (req, rep) => { rep.code(201); return integrationsService.createWebhook(req.tenant.id, req.body); });
export const updateWebhook = wrap(async (req) => {
  const data = await integrationsService.updateWebhook(req.tenant.id, req.params.id, req.body);
  if (!data) { const e = new Error('Webhook not found'); e.code = 'NOT_FOUND'; e.statusCode = 404; throw e; }
  return data;
});
export const deleteWebhook = wrap(async (req) => integrationsService.deleteWebhook(req.tenant.id, req.params.id));
export const testWebhook = wrap(async (req) => {
  const data = await integrationsService.testWebhook(req.tenant.id, req.params.id);
  if (!data) { const e = new Error('Webhook not found'); e.code = 'NOT_FOUND'; e.statusCode = 404; throw e; }
  return data;
});
