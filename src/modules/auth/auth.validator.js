import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email').toLowerCase(),
  password: z.string().min(1, 'Password required'),
});

export const adminLoginSchema = loginSchema;

export const refreshSchema = z.object({
  // Refresh token comes from cookie, no body needed
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email').toLowerCase().trim(),
});

export const validateResetTokenSchema = z.object({
  token: z.string().min(1, 'Reset token required'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token required'),
  newPassword: z.string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const confirmResetPasswordSchema = resetPasswordSchema;

export const verifyOtpSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const resendOtpSchema = z.object({
  challengeId: z.string().min(1),
});
