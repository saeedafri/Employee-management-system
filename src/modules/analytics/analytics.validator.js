import { z } from 'zod';

export const summaryQuerySchema = z.object({});

export const attendanceQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).optional(),
});

export const headcountQuerySchema = z.object({});

export const recentActivityQuerySchema = z.object({
  limit: z.string().transform(Number).optional(),
});

export const leaveSummaryQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).optional(),
});
