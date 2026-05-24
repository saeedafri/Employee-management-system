import { z } from 'zod';

export const listAuditLogsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  user_email: z.string().email().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  from_date: z.coerce.date().optional(),
  to_date: z.coerce.date().optional(),
});

export const getAuditLogSchema = z.object({
  id: z.string().min(1),
});

export const dpiaReportSchema = z.object({
  from_date: z.coerce.date(),
  to_date: z.coerce.date(),
});

export const exportAuditLogsSchema = z.object({
  from_date: z.coerce.date().optional(),
  to_date: z.coerce.date().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});
