import pino from 'pino';
import { config } from './config/index.js';
import { createApp } from './app.js';
import { startPayrollWorker } from './lib/payrollQueue.js';
import { syncPermissionCatalogue } from './modules/auth/permissionSync.js';
import { initSseFanout } from './utils/sseClients.js';
import { isLocalUrl, EMAIL_LINK_SETTINGS } from './utils/publicUrl.js';
import { installProcessErrorHandlers } from './utils/processMonitor.js';

const logger = pino();

// Process-level crashes belong to no tenant: they stay in the in-memory ring buffer
// (operator-only via /ops/process). They used to be written under whichever tenant
// findFirst() returned, so one customer's stack traces showed in another's /logs.
installProcessErrorHandlers();

async function start() {
  try {
    const app = await createApp();
    // Top up every tenant's permission catalogue before serving traffic, so a
    // deploy that adds permission keys never 403s roles that should hold them.
    await syncPermissionCatalogue(app.log);
    // Cross-instance SSE delivery. No-ops without REDIS_URL, so single-container
    // deployments are unaffected.
    await initSseFanout();
    // Start the in-process BullMQ worker for payroll CALCULATING (no-op without Redis).
    startPayrollWorker();
    await app.listen({ port: config.port, host: '0.0.0.0' });

    // Surface unusable email links at boot rather than when an employee clicks a dead
    // invite. Logged, not fatal: a bad link must not take the whole API down.
    if (config.isProduction) {
      for (const [envName, configKey] of EMAIL_LINK_SETTINGS) {
        if (isLocalUrl(config[configKey])) {
          app.log.error({
            msg: `${envName} points at localhost — invite/reset emails will be refused`,
            envName,
            value: config[configKey],
          });
        }
      }
    }

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
