import { authenticate } from '../../middleware/authenticate.js';
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  exportEmployees,
} from './employees.controller.js';

export async function employeesRoutes(fastify) {
  fastify.addHook('onRequest', authenticate);

  fastify.get(
    '/employees',
    {
      schema: {
        tags: ['Employees'],
        description: 'List employees with pagination and filters',
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 20 },
            search: { type: 'string' },
            departmentId: { type: 'string' },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED'] },
            location: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  data: { type: 'array' },
                  pagination: { type: 'object' },
                },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    listEmployees,
  );

  fastify.get(
    '/employees/:id',
    {
      schema: {
        tags: ['Employees'],
        description: 'Get employee details',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    getEmployee,
  );

  fastify.post(
    '/employees',
    {
      schema: {
        tags: ['Employees'],
        description: 'Create new employee',
        body: {
          type: 'object',
          required: ['employeeCode', 'firstName', 'lastName', 'workEmail', 'joinedOn'],
          properties: {
            employeeCode: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            workEmail: { type: 'string' },
            personalEmail: { type: 'string' },
            phone: { type: 'string' },
            designation: { type: 'string' },
            departmentId: { type: 'string' },
            managerId: { type: 'string' },
            joinedOn: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    createEmployee,
  );

  fastify.patch(
    '/employees/:id',
    {
      schema: {
        tags: ['Employees'],
        description: 'Update employee',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            designation: { type: 'string' },
            departmentId: { type: 'string' },
            managerId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    updateEmployee,
  );

  fastify.delete(
    '/employees/:id',
    {
      schema: {
        tags: ['Employees'],
        description: 'Soft delete employee',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    deleteEmployee,
  );

  fastify.get(
    '/employees/export/csv',
    {
      schema: {
        tags: ['Employees'],
        description: 'Export employees as CSV',
        response: {
          200: {
            type: 'string',
          },
        },
      },
    },
    exportEmployees,
  );
}
