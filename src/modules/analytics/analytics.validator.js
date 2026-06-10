import { z } from 'zod';

const commonFilters = {
  departmentId: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
};

export const summaryQuerySchema = z.object({ ...commonFilters });

export const attendanceQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).optional(),
  ...commonFilters,
});

export const headcountQuerySchema = z.object({ ...commonFilters });

export const recentActivityQuerySchema = z.object({
  limit: z.string().transform(Number).optional(),
  ...commonFilters,
});

export const leaveSummaryQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).optional(),
  ...commonFilters,
});
