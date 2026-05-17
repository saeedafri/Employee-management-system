import { successResponse, errorResponse } from '../../utils/response.js';
import { prisma } from '../../plugins/prisma.js';
import * as otpService from './otp.service.js';
import * as otpValidator from './otp.validator.js';
import * as authService from './auth.service.js';

export async function verifyOtpController(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const { challengeId, code } = await otpValidator.verifyOtpSchema.parseAsync(request.body);
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] || '';

    const result = await otpService.verifyOtp(tenantId, challengeId, code);

    // If this was an MFA login verification, complete the login
    if (result.purpose === 'LOGIN') {
      const loginResult = await authService.completeMfaLogin(prisma, tenantId, result.userId, ip, userAgent);

      // Set refresh token cookie
      reply.setCookie('refreshToken', loginResult.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return reply.send(
        successResponse({
          accessToken: loginResult.accessToken,
          user: loginResult.user,
          permissions: loginResult.permissions,
          sessionId: loginResult.sessionId,
        }),
      );
    }

    // For other purposes, just return verification success
    return reply.send(
      successResponse({
        valid: result.valid,
        challengeId: result.challengeId,
      }),
    );
  } catch (error) {
    if (error.code && error.statusCode) {
      return reply.code(error.statusCode).send(
        errorResponse(error.code, error.message, {}, request.id),
      );
    }
    request.log.error(error);
    throw error;
  }
}

export async function resendOtpController(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const { challengeId } = await otpValidator.resendOtpSchema.parseAsync(request.body);

    // Get challenge to find the user email
    const challenge = await prisma.otpChallenge.findFirst({
      where: { tenantId, challengeId },
      include: { user: true },
    });

    if (!challenge) {
      return reply.code(400).send(
        errorResponse('OTP_CHALLENGE_NOT_FOUND', 'OTP challenge not found', {}, request.id),
      );
    }

    const result = await otpService.resendOtp(tenantId, challengeId, challenge.user.email);

    return reply.code(202).send(
      successResponse(
        {
          success: true,
          destinationMasked: result.destinationMasked,
          expiresIn: result.expiresIn,
        },
        { message: 'OTP has been resent to your registered email' },
      ),
    );
  } catch (error) {
    if (error.code && error.statusCode) {
      return reply.code(error.statusCode).send(
        errorResponse(error.code, error.message, error.details || {}, request.id),
      );
    }
    request.log.error(error);
    throw error;
  }
}
