import sharp from 'sharp';
import { successResponse, errorResponse } from '../../utils/response.js';
import * as settingsService from './settings.service.js';
import * as settingsValidator from './settings.validator.js';
import * as integrationsService from './integrations.service.js';
import { uploadToCloudinary, isCloudinaryConfigured } from '../../utils/cloudinary.js';

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

const MAX_LOGO_BYTES = 1 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

export async function updateBranding(request, reply) {
  const tenantId = request.tenant.id;
  let body = {};
  let logoFile = null;

  const contentType = request.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        if (part.fieldname !== 'logo') { await part.toBuffer().catch(() => null); continue; }
        if (!ALLOWED_LOGO_TYPES.has(part.mimetype)) {
          await part.toBuffer().catch(() => null);
          return reply.code(422).send(errorResponse('INVALID_FILE_TYPE', 'Logo must be PNG, JPEG, WebP, or SVG.', {}, request.id));
        }
        const buffer = await part.toBuffer();
        if (buffer.length > MAX_LOGO_BYTES) {
          return reply.code(422).send(errorResponse('FILE_TOO_LARGE', 'Logo must be 1 MB or smaller.', {}, request.id));
        }
        logoFile = { buffer, filename: part.filename, mimetype: part.mimetype };
      } else {
        body[part.fieldname] = part.value;
      }
    }
  } else {
    body = request.body || {};
  }

  const updateData = {};
  if (body.logo_url !== undefined) updateData.logo_url = body.logo_url;
  if (body.primary_color_hex !== undefined && body.primary_color_hex !== '') {
    const color = String(body.primary_color_hex).trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return reply.code(422).send(errorResponse('VALIDATION_ERROR', 'Invalid primary_color_hex. Expected format #RRGGBB.', { details: [{ field: 'primary_color_hex', message: 'Expected #RRGGBB' }] }, request.id));
    }
    updateData.primary_color_hex = color;
  }

  if (logoFile) {
    if (!isCloudinaryConfigured()) {
      return reply.code(503).send(errorResponse('STORAGE_NOT_CONFIGURED', 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.', {}, request.id));
    }
    try {
      let uploadBuffer = logoFile.buffer;
      let resourceType = 'image';
      if (logoFile.mimetype !== 'image/svg+xml') {
        uploadBuffer = await sharp(logoFile.buffer).webp({ quality: 90 }).toBuffer();
      } else {
        resourceType = 'raw';
      }
      const uploaded = await uploadToCloudinary(uploadBuffer, {
        folder: `ems/${tenantId}/branding`,
        publicId: 'logo',
        resourceType,
      });
      updateData.logo_url = uploaded.url;
    } catch (uploadErr) {
      request.log.error({ uploadErr }, 'Branding logo upload failed');
      return reply.code(502).send(errorResponse('UPLOAD_FAILED', 'Logo upload failed. Please try again.', {}, request.id));
    }
  }

  try {
    const result = await settingsService.updateBranding(tenantId, updateData);
    return reply.send(successResponse(result));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.code(error.statusCode || 400).send(errorResponse(error.code, error.message, error.details || {}, request.id));
    }
    throw error;
  }
}
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
