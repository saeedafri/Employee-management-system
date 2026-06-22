import { successResponse, errorResponse } from '../../utils/response.js';
import * as passwordResetService from './passwordReset.service.js';
import * as authValidator from './auth.validator.js';

export async function forgotPasswordController(request, reply) {
  try {
    const tenantId = request.tenant?.id ?? null;

    const { email } = await authValidator.forgotPasswordSchema.parseAsync(request.body);
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] || '';

    await passwordResetService.requestPasswordReset(tenantId, email, ip, userAgent);

    return reply.code(202).send(
      successResponse({
        message: 'If that email exists, a reset link was sent',
      }),
    );
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function validateResetTokenController(request, reply) {
  try {
    const tenantId = request.tenant?.id ?? null;
    const { token } = await authValidator.validateResetTokenSchema.parseAsync(request.query);

    const result = await passwordResetService.validateResetToken(tenantId, token);

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
    const tenantId = request.tenant?.id ?? null;
    const { token, newPassword } = await authValidator.resetPasswordSchema.parseAsync(request.body);
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] || '';

    const result = await passwordResetService.completePasswordReset(tenantId, token, newPassword, ip, userAgent);

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
