import { z } from 'zod';

export const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  note: z.string().max(500).optional(),
});

export const checkOutSchema = z.object({
  note: z.string().max(500).optional(),
});

export const getAttendanceRecordsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export const regularizationRequestSchema = z.object({
  attendanceDate: z.coerce.date(),
  type: z.enum(['LATE', 'MISSED_CHECKOUT', 'EARLY_CHECKOUT']),
  reason: z.string().min(20, 'Reason must be at least 20 characters').max(500),
});

export const getAttendanceSummarySchema = z.object({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export const approveRegularizationSchema = z.object({
  reviewerComment: z.string().max(500).optional(),
});

export const denyRegularizationSchema = z.object({
  reviewerComment: z.string().min(10, 'Comment must be at least 10 characters').max(500),
});
