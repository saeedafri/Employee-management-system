import { successResponse, errorResponse } from '../../utils/response.js';
import * as otpService from './otp.service.js';
import * as otpValidator from './otp.validator.js';

export async function verifyOtpController(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const { challengeId, code } = await otpValidator.verifyOtpSchema.parseAsync(request.body);

    const result = await otpService.verifyOtp(tenantId, challengeId, code);

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
    const userId = request.user?.id;
    const { challengeId } = await otpValidator.resendOtpSchema.parseAsync(request.body);

    if (!userId) {
      return reply.code(401).send(
        errorResponse('UNAUTHORIZED', 'User not authenticated', {}, request.id),
      );
    }

    const result = await otpService.resendOtp(tenantId, challengeId, request.user.email);

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
        errorResponse(error.code, error.message, {}, request.id),
      );
    }
    request.log.error(error);
    throw error;
  }
}
