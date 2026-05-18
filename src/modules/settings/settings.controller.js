import { successResponse, errorResponse } from '../../utils/response.js';
import * as settingsService from './settings.service.js';
import * as settingsValidator from './settings.validator.js';

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
    const userId = request.user.id;

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
