import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().cuid('Invalid department ID'),
});

export const listQuerySchema = z.object({
  includeArchived: z.boolean().default(false),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(255),
  // Root departments send parentId: null — must be nullable, not just optional.
  parentId: z.string().cuid('Invalid parent department ID').optional().nullable(),
  departmentCode: z.string().max(50).optional(),
  headEmployeeId: z.string().cuid('Invalid head employee ID').optional().nullable(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().cuid('Invalid parent department ID').optional().nullable(),
  departmentCode: z.string().max(50).optional(),
  headEmployeeId: z.string().cuid('Invalid head employee ID').optional().nullable(),
});

export const addDepartmentMembersSchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1, 'employeeIds must be a non-empty array'),
});
