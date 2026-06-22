import Fastify from 'fastify';
import cookiePlugin from '@fastify/cookie';
import multipart from '@fastify/multipart';
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
import departmentsRoutes from './modules/departments/departments.routes.js';
import holidaysRoutes from './modules/holidays/holidays.routes.js';
import leaveRoutes from './modules/leave/leave.routes.js';
import leaveEngineRoutes from './modules/leave/leaveEngine.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import exportRoutes from './modules/export/export.routes.js';
import auditLogsRoutes from './modules/auditLogs/auditLogs.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import payrollRoutes from './modules/payroll/payroll.routes.js';
import recruitmentRoutes from './modules/recruitment/recruitment.routes.js';
import performanceRoutes from './modules/performance/performance.routes.js';
import assetsRoutes from './modules/assets/assets.routes.js';
import announcementsRoutes from './modules/announcements/announcements.routes.js';
import timesheetsRoutes from './modules/timesheets/timesheets.routes.js';
import timesheetsConfigRoutes from './modules/timesheets/timesheetsConfig.routes.js';

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

  // Register plugins (order matters - swagger goes last after routes)
  await fastify.register(requestIdPlugin);
  await fastify.register(cookiePlugin);
  await fastify.register(prismaPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB limit

  // Attach request logging
  await attachRequestLogging(fastify);

  // Global error handler
  fastify.setErrorHandler(errorHandler);

  // Register routes (MUST await all nested registrations)
  await fastify.register(
    async (fastify) => {
      fastify.addHook('onRequest', resolveTenant);
      await fastify.register(authRoutes);
      await fastify.register(logsRoutes);
      await fastify.register(analyticsRoutes);
      await fastify.register(managerDashboardRoutes);
      await fastify.register(employeeDashboardRoutes);
      await fastify.register(employeesRoutes);
      await fastify.register(departmentsRoutes);
      await fastify.register(holidaysRoutes);
      await fastify.register(leaveRoutes);
      await fastify.register(leaveEngineRoutes);
      await fastify.register(attendanceRoutes);
      await fastify.register(reportsRoutes);
      await fastify.register(exportRoutes);
      await fastify.register(auditLogsRoutes);
      await fastify.register(settingsRoutes);
      await fastify.register(notificationsRoutes);
      await fastify.register(searchRoutes);
      await fastify.register(payrollRoutes);
      await fastify.register(recruitmentRoutes);
      await fastify.register(performanceRoutes);
      await fastify.register(assetsRoutes);
      await fastify.register(announcementsRoutes);
      await fastify.register(timesheetsRoutes);
      await fastify.register(timesheetsConfigRoutes);
    },
    { prefix: config.apiPrefix },
  );

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));
  fastify.get('/healthz', async () => ({ status: 'ok' }));


  // Register swagger AFTER all routes are defined
  await fastify.register(swaggerPlugin);

  return fastify;
}

