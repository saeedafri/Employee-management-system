import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email').toLowerCase(),
  password: z.string().min(1, 'Password required'),
});

export const adminLoginSchema = loginSchema;

export const updateOwnMfaSchema = z.object({
  enabled: z.boolean(),
});

export const refreshSchema = z.object({
  // Refresh token comes from cookie, no body needed
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email').toLowerCase().trim(),
});

export const validateResetTokenSchema = z.object({
  token: z.string().min(1, 'Reset token required'),
});

const resetPasswordValueSchema = z.string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token required'),
  password: resetPasswordValueSchema.optional(),
  newPassword: resetPasswordValueSchema.optional(),
}).superRefine((data, ctx) => {
  if (!data.password && !data.newPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['password'],
      message: 'Password required',
    });
  }
}).transform((data) => ({
  token: data.token,
  newPassword: data.password ?? data.newPassword,
}));

export const confirmResetPasswordSchema = resetPasswordSchema;

export const verifyOtpSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const resendOtpSchema = z.object({
  challengeId: z.string().min(1),
});

export const registerSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name must be at least 2 characters'),
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  // ISO 3166-1 alpha-2. Optional; without it, country-tagged holidays can't reach employees
  // who have no legal entity yet (the resolver falls back to the company's country).
  country: z.string().trim().regex(/^[A-Za-z]{2}$/, 'Country must be a 2-letter ISO code').transform((c) => c.toUpperCase()).optional(),
});
