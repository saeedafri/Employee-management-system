import { ZodError } from 'zod';
import { errorResponse } from '../utils/response.js';

export async function errorHandler(error, request, reply) {
  const requestId = request.id;
  const logger = request.log;

  // Zod validation errors
  if (error instanceof ZodError) {
    const details = error.errors.reduce((acc, err) => {
      acc[err.path.join('.')] = err.message;
      return acc;
    }, {});

    return reply.code(400).send(
      errorResponse(
        'VALIDATION_ERROR',
        'Request validation failed',
        details,
        requestId,
      ),
    );
  }

  // Custom app errors
  if (error.code && error.message) {
    const statusCode = error.statusCode || 500;
    logger.error({ error, requestId }, error.message);
    return reply.code(statusCode).send(
      errorResponse(
        error.code,
        error.message,
        error.details || {},
        requestId,
      ),
    );
  }

  // Unhandled errors
  logger.error({ error, requestId }, 'Unhandled error');
  return reply.code(500).send(
    errorResponse(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred',
      {},
      requestId,
    ),
  );
}
