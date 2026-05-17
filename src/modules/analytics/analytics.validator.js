import { z } from 'zod';

export const attendanceParamsSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  department: z.string().optional(),
});

export const leaveParamsSchema = z.object({
  year: z.string().regex(/^\d{4}$/).transform(Number).optional(),
  department: z.string().optional(),
});

export const payrollParamsSchema = z.object({
  month: z.string().regex(/^\d{1,2}$/).transform(Number).optional(),
  year: z.string().regex(/^\d{4}$/).transform(Number).optional(),
});

export const departmentParamsSchema = z.object({
  departmentId: z.string().min(1),
});
