import pino from 'pino';
import { config } from './config/index.js';
import { createApp } from './app.js';
import { startPayrollWorker } from './lib/payrollQueue.js';

const logger = pino();

async function start() {
  try {
    const app = await createApp();
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
