import { z } from 'zod';

export const createLeaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1, 'Leave type is required'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
}).refine((data) => data.startDate <= data.endDate, {
  message: 'Start date must be before or equal to end date',
  path: ['endDate'],
});

export const getLeaveRequestsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['PENDING', 'APPROVED', 'DENIED', 'WITHDRAWN', 'CANCELLED']).optional(),
  leaveTypeId: z.string().optional(),
  employeeId: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export const approveLeaveRequestSchema = z.object({
  approverComment: z.string().max(500).optional(),
});

export const rejectLeaveRequestSchema = z.object({
  approverComment: z.string().min(10, 'Rejection reason must be at least 10 characters').max(500),
});
