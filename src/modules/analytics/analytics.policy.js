const MANAGER_ALLOWED_PATHS = ['/api/v1/analytics/department-performance'];

export function requireAnalyticsPermission(request, reply, done) {
  const { memberType } = request.user || {};

  const isManagerAllowed = memberType === 'MANAGER' && MANAGER_ALLOWED_PATHS.includes(request.url.split('?')[0]);

  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(memberType) && !isManagerAllowed) {
    reply.code(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Analytics access restricted to HR admins' },
    });
    return;
  }

  done();
}
