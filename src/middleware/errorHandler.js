import { ZodError } from 'zod';
import { errorResponse } from '../utils/response.js';
import { createLog } from '../modules/logs/logs.service.js';

// 5xx responses are written to the tenant's LogEntry so GET /logs (the Logs screen) shows
// them. Fire-and-forget: a failed log write must never change the response. Requests with
// no tenant (public auth routes before tenant resolution) stay in stdout only.
function persistServerError(request, error, statusCode) {
  const tenantId = request.tenant?.id ?? request.user?.tenantId;
  if (!tenantId) return;
  const route = request.routeOptions?.url ?? request.url.split('?')[0];
  const module = route.match(/^\/api\/v\d+\/([^/]+)/)?.[1] ?? 'app';
  createLog(tenantId, 'ERROR', 'Error', 'red', module, String(error.message ?? error).slice(0, 500), request.id,
    request.user?.id ?? null, {
      method: request.method, route, statusCode, name: error.name, code: error.code ?? null,
      stack: error.stack?.split('\n').slice(0, 8).join('\n') ?? null,
    }).catch((err) => request.log.warn({ err }, 'could not persist error log'));
}

export async function errorHandler(error, request, reply) {
  const requestId = request.id;
  const logger = request.log;

  // Fastify body-parse errors (empty JSON body, wrong content-type, etc.)
  if (error.code && error.code.startsWith('FST_ERR_CTP')) {
    return reply.code(400).send(
      errorResponse('INVALID_REQUEST', 'Invalid or malformed request body', null, requestId),
    );
  }

  if (error.statusCode === 400 && !error.validation) {
    return reply.code(400).send(
      errorResponse('INVALID_REQUEST', 'Invalid or malformed request', null, requestId),
    );
  }

  // Fastify AJV schema validation errors
  if (error.code === 'FST_ERR_VALIDATION' && error.validation) {
    const details = error.validation.map((v) => ({
      field: v.instancePath ? v.instancePath.replace(/^\//, '').replace(/\//g, '.') : (v.params?.missingProperty || 'unknown'),
      message: v.message,
    }));

    return reply.code(422).send(
      errorResponse(
        'VALIDATION_ERROR',
        'Request validation failed',
        details,
        requestId,
      ),
    );
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const details = error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    return reply.code(422).send(
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
    if (statusCode >= 500) persistServerError(request, error, statusCode);
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
  persistServerError(request, error, 500);
  return reply.code(500).send(
    errorResponse(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred',
      {},
      requestId,
    ),
  );
}
