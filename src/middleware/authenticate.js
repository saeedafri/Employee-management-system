import { verifyToken } from '../utils/token.js';
import { errorResponse } from '../utils/response.js';

export async function authenticate(request, reply) {
  try {
    // Accept token from Authorization header (Swagger/Postman) OR accessToken cookie (browser)
    const raw = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || '';
    const jwtMatch = raw.match(/^(eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
    const headerToken = jwtMatch ? jwtMatch[1] : raw;
    const token = headerToken || request.cookies?.accessToken || '';

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
    // SUPER_ADMIN bypasses all role checks — they have unrestricted access by definition.
    if (memberType === 'SUPER_ADMIN') return;
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
