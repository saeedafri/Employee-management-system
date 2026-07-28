import pino from 'pino';
import { config } from './config/index.js';
import { createApp } from './app.js';
import { startPayrollWorker } from './lib/payrollQueue.js';
import { syncPermissionCatalogue } from './modules/auth/permissionSync.js';
import { installProcessErrorHandlers, recordProcessError } from './utils/processMonitor.js';
import { prisma } from './plugins/prisma.js';

const logger = pino();

installProcessErrorHandlers(async (entry) => {
  try {
    // Best-effort persist crash-class events (no tenant — use first active tenant if any).
    const tenant = await prisma.tenant.findFirst({ select: { id: true } });
    if (!tenant) return;
    await prisma.logEntry.create({
      data: {
        tenantId: tenant.id,
        level: entry.kind === 'warning' ? 'WARN' : 'ERROR',
        levelLabel: entry.kind === 'warning' ? 'Warning' : 'Error',
        levelColor: entry.kind === 'warning' ? 'yellow' : 'red',
        module: 'process',
        message: `[${entry.kind}] ${entry.message}`,
        metadataJson: { stack: entry.stack, at: entry.at },
      },
    });
  } catch (err) {
    recordProcessError('persist_failed', err);
  }
});

async function start() {
  try {
    const app = await createApp();
    // Top up every tenant's permission catalogue before serving traffic, so a
    // deploy that adds permission keys never 403s roles that should hold them.
    await syncPermissionCatalogue(app.log);
    // Start the in-process BullMQ worker for payroll CALCULATING (no-op without Redis).
    startPayrollWorker();
    await app.listen({ port: config.port, host: '0.0.0.0' });

    app.log.info({
      msg: 'Server started',
      appName: config.appName,
      version: config.appVersion,
      port: config.port,
      env: config.env,
      docsUrl: `http://localhost:${config.port}/docs`,
    });
  } catch (error) {
    logger.error(error, 'Server startup failed');
    process.exit(1);
  }
}

if (!process.env.VERCEL) {
  await start();
}
