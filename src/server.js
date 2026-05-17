import { config } from './config/index.js';
import { createApp } from './app.js';

async function main() {
  try {
    const fastify = await createApp();
    await fastify.listen({ port: config.port, host: '0.0.0.0' });

    fastify.log.info({
      msg: 'Server started',
      appName: config.appName,
      version: config.appVersion,
      port: config.port,
      env: config.env,
      docsUrl: `http://localhost:${config.port}/docs`,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

main();
