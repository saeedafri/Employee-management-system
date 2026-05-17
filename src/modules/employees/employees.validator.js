import { z } from 'zod';

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED']).optional(),
  location: z.string().optional(),
});

export const createEmployeeSchema = z.object({
  employeeCode: z.string().min(2).max(20),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  workEmail: z.string().email(),
  personalEmail: z.string().email().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z.string().optional(),
  designation: z.string().optional(),
  departmentId: z.string().optional(),
  managerId: z.string().optional(),
  joinedOn: z.coerce.date(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']).default('FULL_TIME'),
  location: z.string().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const idParamSchema = z.object({
  id: z.string().cuid(),
});
