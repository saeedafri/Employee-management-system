import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { config } from '../config/index.js';

export async function swaggerPlugin(fastify) {
  await fastify.register(fastifySwagger, {
    swagger: {
      info: {
        title: config.appName,
        version: config.appVersion,
        description: 'Employee Management System Backend API - Production Grade Auth & Admin APIs',
        contact: {
          name: 'API Support',
          email: 'support@acme.test',
        },
      },
      host: config.isDevelopment ? `localhost:${config.port}` : 'employee-management-system-2b9q.onrender.com',
      basePath: config.apiPrefix,
      schemes: [config.isDevelopment ? 'http' : 'https'],
      securityDefinitions: {
        Bearer: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'JWT Access Token with Bearer scheme',
        },
        TenantKey: {
          type: 'apiKey',
          name: 'X-Tenant-Key',
          in: 'header',
          description: 'Tenant Key for multi-tenancy support',
        },
      },
      definitions: {
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              example: 'password123',
            },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                accessToken: {
                  type: 'string',
                  example: 'eyJhbGc...',
                },
                sessionId: {
                  type: 'string',
                  example: 'clm4x...',
                },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    memberType: { type: 'string' },
                  },
                },
                permissions: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'INVALID_CREDENTIALS',
                },
                message: {
                  type: 'string',
                  example: 'Invalid email or password',
                },
                details: {
                  type: 'object',
                },
              },
            },
            requestId: {
              type: 'string',
              example: 'req-xxx',
            },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            action: { type: 'string' },
            entityType: { type: 'string' },
            entityId: { type: 'string' },
            actorUserId: { type: 'string' },
            oldValuesJson: { type: 'object' },
            newValuesJson: { type: 'object' },
            ipAddress: { type: 'string' },
            userAgent: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  });

  await fastify.register(fastifySwaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      presets: [
        'swaggerUIBundle.presets.apis',
        'SwaggerUIStandalonePreset',
      ],
      layout: 'StandaloneLayout',
    },
  });
}
