import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().cuid('Invalid department ID'),
});

export const listQuerySchema = z.object({
  includeArchived: z.boolean().default(false),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(255),
  parentId: z.string().cuid('Invalid parent department ID').optional(),
  departmentCode: z.string().max(50).optional(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().cuid('Invalid parent department ID').optional().nullable(),
  departmentCode: z.string().max(50).optional(),
});
