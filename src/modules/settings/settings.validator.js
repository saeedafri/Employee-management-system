import { z } from 'zod';

export const getTenantConfigSchema = z.object({});

export const updateTenantConfigSchema = z.object({
  // Tenant model fields
  legalName: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  country: z.string().min(2).optional(),
  defaultCurrency: z.string().length(3).optional(),
  primaryContactEmail: z.string().email().optional(),
  supportPhone: z.string().optional(),
  logoUrl: z.string().optional(),
  // TenantConfig operational fields
  company_name: z.string().min(1).max(255).optional(),
  timezone: z.string().optional(),
  working_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  working_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  invite_email_target: z.enum(['PERSONAL', 'WORK']).optional(),
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
