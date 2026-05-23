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
      await fastify.register(attendanceRoutes);
      await fastify.register(reportsRoutes);
      await fastify.register(exportRoutes);
      await fastify.register(auditLogsRoutes);
      await fastify.register(settingsRoutes);
    },
    { prefix: config.apiPrefix },
  );

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));
  fastify.get('/healthz', async () => ({ status: 'ok' }));

  // Temporary SMTP debug — remove after confirming email works
  fastify.get('/debug/test-email', async (request, reply) => {
    const nodemailer = (await import('nodemailer')).default;
    const { config: cfg } = await import('./config/index.js');
    const results = {};
    for (const port of [465, 587]) {
      try {
        const t = nodemailer.createTransport({
          host: cfg.smtpHost, port, secure: port === 465,
          auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 8000,
        });
        await t.verify();
        const info = await t.sendMail({
          from: cfg.smtpFrom, to: 'mohammadsaeedafri9@gmail.com',
          subject: `EMS SMTP Debug port ${port} — Render`,
          html: `<h2>SMTP works on port ${port}!</h2>`,
        });
        results[`port_${port}`] = { ok: true, messageId: info.messageId };
        break; // sent successfully, stop
      } catch (err) {
        results[`port_${port}`] = { ok: false, error: err.message, code: err.code };
      }
    }
    return reply.send({ host: cfg.smtpHost, user: cfg.smtpUser, results });
  });

  // Register swagger AFTER all routes are defined
  await fastify.register(swaggerPlugin);

  return fastify;
}
