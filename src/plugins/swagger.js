import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { config } from '../config/index.js';

export async function swaggerPlugin(fastify) {
  await fastify.register(fastifySwagger, {
    mode: 'dynamic',
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
      paths: {
        '/auth/login': {
          post: {
            tags: ['Authentication'],
            summary: 'User login',
            parameters: [
              {
                in: 'body',
                name: 'body',
                required: true,
                schema: { $ref: '#/definitions/LoginRequest' },
              },
            ],
            responses: {
              200: {
                description: 'Login successful',
                schema: { $ref: '#/definitions/LoginResponse' },
              },
              400: { description: 'Invalid credentials' },
            },
          },
        },
        '/auth/logout': {
          post: {
            tags: ['Authentication'],
            summary: 'User logout',
            security: [{ Bearer: [] }],
            responses: { 200: { description: 'Logged out successfully' } },
          },
        },
        '/auth/me': {
          get: {
            tags: ['Authentication'],
            summary: 'Get current user profile',
            security: [{ Bearer: [] }],
            responses: { 200: { description: 'User profile' } },
          },
        },
        '/employees': {
          get: {
            tags: ['Employees'],
            summary: 'List all employees',
            security: [{ Bearer: [] }],
            parameters: [
              { in: 'query', name: 'page', type: 'number' },
              { in: 'query', name: 'limit', type: 'number' },
            ],
            responses: { 200: { description: 'Employee list' } },
          },
          post: {
            tags: ['Employees'],
            summary: 'Create new employee',
            security: [{ Bearer: [] }],
            responses: { 201: { description: 'Employee created' } },
          },
        },
        '/employees/{id}': {
          get: {
            tags: ['Employees'],
            summary: 'Get employee details',
            security: [{ Bearer: [] }],
            parameters: [{ in: 'path', name: 'id', type: 'string', required: true }],
            responses: { 200: { description: 'Employee details' } },
          },
          patch: {
            tags: ['Employees'],
            summary: 'Update employee',
            security: [{ Bearer: [] }],
            parameters: [{ in: 'path', name: 'id', type: 'string', required: true }],
            responses: { 200: { description: 'Employee updated' } },
          },
          delete: {
            tags: ['Employees'],
            summary: 'Delete employee',
            security: [{ Bearer: [] }],
            parameters: [{ in: 'path', name: 'id', type: 'string', required: true }],
            responses: { 204: { description: 'Employee deleted' } },
          },
        },
        '/departments': {
          get: {
            tags: ['Departments'],
            summary: 'List departments',
            security: [{ Bearer: [] }],
            responses: { 200: { description: 'Department list' } },
          },
          post: {
            tags: ['Departments'],
            summary: 'Create department',
            security: [{ Bearer: [] }],
            responses: { 201: { description: 'Department created' } },
          },
        },
        '/attendance/check-in': {
          post: {
            tags: ['Attendance'],
            summary: 'Check in',
            security: [{ Bearer: [] }],
            responses: { 200: { description: 'Check in recorded' } },
          },
        },
        '/attendance/check-out': {
          post: {
            tags: ['Attendance'],
            summary: 'Check out',
            security: [{ Bearer: [] }],
            responses: { 200: { description: 'Check out recorded' } },
          },
        },
        '/attendance/records': {
          get: {
            tags: ['Attendance'],
            summary: 'Get attendance records',
            security: [{ Bearer: [] }],
            responses: { 200: { description: 'Attendance records' } },
          },
        },
        '/leave/balance': {
          get: {
            tags: ['Leave'],
            summary: 'Get leave balance',
            security: [{ Bearer: [] }],
            responses: { 200: { description: 'Leave balance' } },
          },
        },
        '/leave/requests': {
          get: {
            tags: ['Leave'],
            summary: 'Get leave requests',
            security: [{ Bearer: [] }],
            responses: { 200: { description: 'Leave requests' } },
          },
          post: {
            tags: ['Leave'],
            summary: 'Create leave request',
            security: [{ Bearer: [] }],
            responses: { 201: { description: 'Leave request created' } },
          },
        },
        '/health': {
          get: {
            tags: ['Health'],
            summary: 'Health check',
            responses: { 200: { description: 'Server is healthy' } },
          },
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
    },
  });
}
