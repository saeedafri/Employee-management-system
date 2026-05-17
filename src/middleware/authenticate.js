import { verifyToken } from '../utils/token.js';
import { errorResponse } from '../utils/response.js';

export async function authenticate(request, reply) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
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
