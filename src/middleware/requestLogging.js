const sensitiveFields = [
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'accessToken',
  'authorization',
  'cookie',
  'otp',
  'codeHash',
  'tokenHash',
  'refreshTokenHash',
];

function redactSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const redacted = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in redacted) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactSensitive(redacted[key]);
    }
  }

  return redacted;
}

export async function attachRequestLogging(fastify) {
  // Override logger to redact sensitive fields
  const originalLog = fastify.log;
  const sensitiveLogMethods = ['error', 'warn', 'info', 'debug', 'trace'];

  sensitiveLogMethods.forEach(method => {
    const original = originalLog[method].bind(originalLog);
    fastify.log[method] = function(...args) {
      const redactedArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          return redactSensitive(arg);
        }
        return arg;
      });
      return original(...redactedArgs);
    };
  });

  // Attach context to each request
  fastify.addHook('onRequest', async (request, _reply) => {
    request.log = request.log.child({
      requestId: request.id,
      tenantId: request.tenant?.id || null,
      userId: request.user?.sub || null,
    });
  });
}
