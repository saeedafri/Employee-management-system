import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { config } from '../config/index.js';

export async function swaggerPlugin(fastify) {
  await fastify.register(fastifySwagger, {
    swagger: {
      info: {
        title: config.appName,
        version: config.appVersion,
        description: 'Employee Management System Backend API',
      },
      host: `localhost:${config.port}`,
      basePath: config.apiPrefix,
      schemes: [config.isDevelopment ? 'http' : 'https'],
      securityDefinitions: {
        Bearer: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
        },
      },
    },
  });

  await fastify.register(fastifySwaggerUI, {
    routePrefix: '/docs',
  });
}
