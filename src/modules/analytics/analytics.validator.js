import { z } from 'zod';

export const summaryQuerySchema = z.object({
  departmentId: z.string().optional(),
}).strict();

export const attendanceQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  departmentId: z.string().optional(),
}).strict();

export const headcountQuerySchema = z.object({
  excludeInactive: z.string().transform(v => v === 'true').optional(),
}).strict();

export const recentActivityQuerySchema = z.object({
  action: z.string().optional(),
  limit: z.string().transform(Number).refine(n => n > 0 && n <= 100).optional(),
}).strict();

export const leaveSummaryQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/).transform(Number).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'DENIED']).optional(),
}).strict();
