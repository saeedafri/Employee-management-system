import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().cuid('Invalid holiday ID'),
});

export const listQuerySchema = z.object({
  year: z.number().int().min(1900).max(2100).optional(),
  country: z.string().max(100).optional(), // exact location match (back-compat)
  countryCode: z.string().max(8).optional(), // Phase 7.3 — ISO alpha-2; fuzzy applicability filter
});

export const createHolidaySchema = z.object({
  holidayDate: z.string().date('Invalid date format'),
  name: z.string().min(1, 'Holiday name is required').max(255),
  location: z.string().max(255).optional(),
  isOptional: z.boolean().default(false),
});

export const updateHolidaySchema = z.object({
  holidayDate: z.string().date('Invalid date format').optional(),
  name: z.string().min(1).max(255).optional(),
  isOptional: z.boolean().optional(),
});
