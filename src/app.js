import Fastify from 'fastify';
import cookiePlugin from '@fastify/cookie';
import { config } from './config/index.js';
import prismaPlugin from './plugins/prisma.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { corsPlugin } from './plugins/cors.js';
import { helmetPlugin } from './plugins/helmet.js';
import { rateLimitPlugin } from './plugins/rateLimit.js';
import { requestIdPlugin } from './plugins/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { resolveTenant } from './middleware/resolveTenant.js';
import { attachRequestLogging } from './middleware/requestLogging.js';
import authRoutes from './modules/auth/auth.routes.js';
import logsRoutes from './modules/logs/logs.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import { managerDashboardRoutes } from './modules/dashboard/manager.routes.js';
import { employeeDashboardRoutes } from './modules/dashboard/employee.routes.js';
import { employeesRoutes } from './modules/employees/employees.routes.js';
import { departmentsRoutes } from './modules/departments/departments.routes.js';
import { holidaysRoutes } from './modules/holidays/holidays.routes.js';
import leaveRoutes from './modules/leave/leave.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import exportRoutes from './modules/export/export.routes.js';
import auditLogsRoutes from './modules/auditLogs/auditLogs.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';

export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.isDevelopment
        ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
        : undefined,
    },
  });

  // Register plugins
  await fastify.register(requestIdPlugin);
  await fastify.register(cookiePlugin);
  await fastify.register(prismaPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(swaggerPlugin);

  // Attach request logging
  await attachRequestLogging(fastify);

  // Global error handler
  fastify.setErrorHandler(errorHandler);

  // Register routes
  fastify.register(
    async (fastify) => {
      fastify.addHook('onRequest', resolveTenant);
      fastify.register(authRoutes);
      fastify.register(logsRoutes);
      fastify.register(analyticsRoutes);
      fastify.register(managerDashboardRoutes);
      fastify.register(employeeDashboardRoutes);
      fastify.register(employeesRoutes);
      fastify.register(departmentsRoutes);
      fastify.register(holidaysRoutes);
      fastify.register(leaveRoutes);
      fastify.register(attendanceRoutes);
      fastify.register(reportsRoutes);
      fastify.register(exportRoutes);
      fastify.register(auditLogsRoutes);
      fastify.register(settingsRoutes);
    },
    { prefix: config.apiPrefix },
  );

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  return fastify;
}
