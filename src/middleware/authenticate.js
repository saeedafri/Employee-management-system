import { verifyToken } from '../utils/token.js';
import { errorResponse } from '../utils/response.js';

export async function authenticate(request, reply) {
  try {
    // Strip "Bearer " prefix (case-insensitive) then extract just the JWT part
    // (guards against users accidentally pasting extra JSON text after the token)
    const raw = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || '';
    const jwtMatch = raw.match(/^(eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)/);
    const token = jwtMatch ? jwtMatch[1] : raw;
    if (!token) {
      return reply.code(401).send(
        errorResponse(
          'UNAUTHORIZED',
          'Missing access token',
          {},
          request.id,
        ),
      );
    }

    const payload = await verifyToken(token);
    request.user = payload;
  } catch (error) {
    return reply.code(401).send(
      errorResponse(
        'INVALID_TOKEN',
        error.message,
        {},
        request.id,
      ),
    );
  }
}

export function authorize(allowedRoles = []) {
  return async (request, reply) => {
    const memberType = request.user?.memberType;
    if (!memberType || !allowedRoles.includes(memberType)) {
      return reply.code(403).send(
        errorResponse(
          'FORBIDDEN',
          'Insufficient permissions for this action',
          { requiredRoles: allowedRoles, userRole: memberType },
          request.id,
        ),
      );
    }
  };
}
