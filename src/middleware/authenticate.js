import { verifyToken } from '../utils/token.js';
import { errorResponse } from '../utils/response.js';
import { prisma } from '../plugins/prisma.js';

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
    if (!payload?.sessionId || !payload?.sub || !payload?.tenantId) {
      throw new Error('Session revoked or expired');
    }

    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: { id: true, userId: true, tenantId: true, revokedAt: true },
    });

    if (
      !session
      || session.userId !== payload.sub
      || session.tenantId !== payload.tenantId
      || session.revokedAt
      || (request.tenant?.id && request.tenant.id !== session.tenantId)
    ) {
      throw new Error('Session revoked or expired');
    }

    // The JWT carries the user id as `sub`, but 23 call sites across export,
    // leave, timesheets and comp-off read `request.user.id` -- every one of them
    // was silently `undefined`, and every column they fed is nullable, so the
    // values went to NULL without erroring. `sub` IS `User.id` (minted from
    // `user.id`, and the session check above compares it to `session.userId`),
    // so normalising it here fixes all of them at the one place they route
    // through, rather than 23 separate `.sub` edits that the next call site
    // would get wrong again.
    request.user = { ...payload, id: payload.sub };
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

// Lets the route manifest distinguish an authenticate-only route from a public
// one; an empty permission list means different things in each case.
authenticate.isAuthGuard = true;
