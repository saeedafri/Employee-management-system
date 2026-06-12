import { z } from 'zod';

// Accepts string[] or scalar string (legacy transition → normalised to [string])
const deptIdArray = z.preprocess(
  (val) => (typeof val === 'string' && val.length > 0 ? [val] : val),
  z.array(z.string().min(1)).min(1, 'Department path must be a non-empty array'),
);

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED']).optional(),
  location: z.string().optional(),
});

export const createEmployeeSchema = z.object({
  employeeCode: z.string().min(2).max(20).optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  workEmail: z.string().email(),
  personalEmail: z.string().email().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z.string().optional(),
  designation: z.string().optional(),
  departmentId: deptIdArray,
  managerId: z.string().optional(),
  joinedOn: z.coerce.date(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']).default('FULL_TIME'),
  location: z.string().optional(),
  // Invitation fields (optional, backward-compatible)
  memberType: z.enum(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE', 'AUDITOR']).default('EMPLOYEE'),
  sendInvite: z.boolean().default(false),
  emailTarget: z.enum(['PERSONAL', 'WORK']).optional(),
});

export const sendInviteSchema = z.object({
  emailTarget: z.enum(['PERSONAL', 'WORK']).optional(),
});

// All fields optional for PATCH; if departmentId provided it must still be a valid non-empty array
export const updateEmployeeSchema = createEmployeeSchema.omit({ memberType: true, sendInvite: true, emailTarget: true }).partial().extend({
  departmentId: deptIdArray.optional(),
});

export const idParamSchema = z.object({
  id: z.string().cuid(),
});
