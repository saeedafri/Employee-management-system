import { successResponse, errorResponse } from '../../utils/response.js';
import * as passwordResetService from './passwordReset.service.js';
import * as authValidator from './auth.validator.js';

export async function forgotPasswordController(request, reply) {
  try {
    const { id: tenantId } = request.tenant;

    const { email } = await authValidator.forgotPasswordSchema.parseAsync(request.body);
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] || '';

    await passwordResetService.requestPasswordReset(tenantId, email, ip, userAgent);

    return reply.code(202).send(
      successResponse(
        null,
        { message: 'If an account exists with this email, you will receive a password reset link shortly' },
      ),
    );
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function validateResetTokenController(request, reply) {
  try {
    const { token } = await authValidator.validateResetTokenSchema.parseAsync(request.query);

    const result = await passwordResetService.validateResetToken(token);

    return reply.send(
      successResponse(
        {
          valid: result.valid,
          expiresAt: result.expiresAt,
          emailMasked: result.emailMasked,
        },
      ),
    );
  } catch (error) {
    if (error.code && error.statusCode) {
      return reply.code(error.statusCode).send(
        errorResponse(
          error.code,
          error.message,
          {},
          request.id,
        ),
      );
    }
    request.log.error(error);
    throw error;
  }
}

export async function resetPasswordController(request, reply) {
  try {
    const { token, newPassword } = await authValidator.resetPasswordSchema.parseAsync(request.body);
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] || '';

    const result = await passwordResetService.completePasswordReset(token, newPassword, ip, userAgent);

    return reply.send(
      successResponse(
        {
          success: result.success,
          message: 'Your password has been reset successfully. You can now log in with your new password.',
        },
      ),
    );
  } catch (error) {
    if (error.code && error.statusCode) {
      return reply.code(error.statusCode).send(
        errorResponse(
          error.code,
          error.message,
          {},
          request.id,
        ),
      );
    }
    request.log.error(error);
    throw error;
  }
}
