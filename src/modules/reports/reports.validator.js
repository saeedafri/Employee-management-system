import { z } from 'zod';

export const attendanceReportSchema = z.object({
  from_date: z.coerce.date().optional(),
  to_date: z.coerce.date().optional(),
  department_id: z.string().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const leavesReportSchema = z.object({
  from_date: z.coerce.date().optional(),
  to_date: z.coerce.date().optional(),
  leave_type: z.string().optional(),
  department_id: z.string().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const payrollReportSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  department_id: z.string().optional(),
});

export const scheduleReportSchema = z.object({
  report_type: z.enum(['attendance', 'leaves', 'payroll']),
  frequency: z.enum(['WEEKLY', 'MONTHLY']),
  email_recipients: z.array(z.string().email()).min(1),
});

export const updateScheduledReportSchema = z.object({
  frequency: z.enum(['WEEKLY', 'MONTHLY']).optional(),
  email_recipients: z.array(z.string().email()).min(1).optional(),
  is_active: z.boolean().optional(),
});

export const listScheduledReportsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const exportHistorySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['SUCCESS', 'FAILED']).optional(),
});
