export function requireAnalyticsPermission(request, reply, done) {
  const { memberType } = request.user || {};
  const permissions = request.user?.permissions || [];

  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(memberType)) {
    reply.code(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Analytics access restricted to HR admins' },
    });
    return;
  }

  if (!permissions.includes('analytics:read')) {
    reply.code(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'User lacks analytics:read permission' },
    });
    return;
  }

  done();
}
