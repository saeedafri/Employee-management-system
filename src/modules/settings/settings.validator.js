import { z } from 'zod';

export const getTenantConfigSchema = z.object({});

export const updateTenantConfigSchema = z.object({
  company_name: z.string().min(1).max(255).optional(),
  timezone: z.string().optional(),
  working_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  working_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const getEmailTemplatesSchema = z.object({});

export const updateEmailTemplateSchema = z.object({
  subject: z.string().min(1).max(255),
  body: z.string().min(10),
});

export const getRolesPermissionsSchema = z.object({});

export const updateRolesPermissionsSchema = z.object({
  role: z.string().min(1),
  permissions: z.array(z.string()).min(1),
});
