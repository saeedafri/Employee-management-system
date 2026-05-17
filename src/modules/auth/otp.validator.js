import { z } from 'zod';

export const verifyOtpSchema = z.object({
  challengeId: z.string().min(1, 'Challenge ID is required'),
  code: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits'),
});

export const resendOtpSchema = z.object({
  challengeId: z.string().min(1, 'Challenge ID is required'),
});
