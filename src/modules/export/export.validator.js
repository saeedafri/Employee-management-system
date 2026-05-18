import { z } from 'zod';

export const exportEmployeesSchema = z.object({
  format: z.enum(['csv', 'excel', 'json']).default('csv'),
  department_id: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).optional(),
  include_archived: z.boolean().default(false),
});

export const exportAttendanceSchema = z.object({
  format: z.enum(['csv', 'excel', 'json']).default('csv'),
  from_date: z.coerce.date(),
  to_date: z.coerce.date(),
  department_id: z.string().optional(),
});

export const exportLeaveSchema = z.object({
  format: z.enum(['csv', 'excel', 'json']).default('csv'),
  from_date: z.coerce.date(),
  to_date: z.coerce.date(),
  leave_type: z.string().optional(),
  status: z.enum(['APPROVED', 'REJECTED', 'PENDING', 'WITHDRAWN', 'CANCELLED']).optional(),
});

export const downloadExportSchema = z.object({
  job_id: z.string().min(1),
});

export const listExportsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['QUEUED', 'PROCESSING', 'SUCCESS', 'FAILED']).optional(),
});
