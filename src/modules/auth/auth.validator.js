import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email').toLowerCase(),
  password: z.string().min(1, 'Password required'),
});

export const adminLoginSchema = loginSchema;

export const refreshSchema = z.object({
  // Refresh token comes from cookie, no body needed
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email').toLowerCase(),
});

export const confirmResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const verifyOtpSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const resendOtpSchema = z.object({
  challengeId: z.string().min(1),
});
