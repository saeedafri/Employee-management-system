import { config } from './config/index.js';
import { createApp } from './app.js';

async function main() {
  try {
    const fastify = await createApp();
    await fastify.listen({ port: config.port, host: '0.0.0.0' });

    console.log(`
🚀 ${config.appName} v${config.appVersion}
📡 Server running at http://localhost:${config.port}
📚 API docs at http://localhost:${config.port}/docs
🌍 Environment: ${config.env}
    `);
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

main();
