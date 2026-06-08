import { authenticate } from '../../middleware/authenticate.js';
import {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  reassignAndDelete,
  getDepartmentEmployees,
} from './departments.controller.js';

export default async function departmentsRoutes(fastify) {
  fastify.addHook('onRequest', authenticate);

  fastify.get(
    '/departments',
    {
      schema: {
        tags: ['Departments'],
        description: 'Get all departments with hierarchical tree',
        querystring: {
          type: 'object',
          properties: {
            includeArchived: { type: 'boolean', default: false },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    listDepartments,
  );

  fastify.get(
    '/departments/:id',
    {
      schema: {
        tags: ['Departments'],
        description: 'Get department detail with headcount, sub-departments, and employee list',
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 200: { type: 'object', additionalProperties: true } },
      },
    },
    getDepartment,
  );

  fastify.post(
    '/departments',
    {
      schema: {
        tags: ['Departments'],
        description: 'Create new department (HR_ADMIN only)',
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            parentId: { type: 'string', nullable: true },
            departmentCode: { type: 'string' },
            headEmployeeId: { type: 'string', nullable: true },
          },
        },
        response: {
          201: { type: 'object', additionalProperties: true },
        },
      },
    },
    createDepartment,
  );

  fastify.patch(
    '/departments/:id',
    {
      schema: {
        tags: ['Departments'],
        description: 'Update department (HR_ADMIN only)',
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
            name: { type: 'string' },
            parentId: { type: 'string', nullable: true },
            departmentCode: { type: 'string' },
            headEmployeeId: { type: 'string', nullable: true },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    updateDepartment,
  );

  fastify.delete(
    '/departments/:id',
    {
      schema: {
        tags: ['Departments'],
        description: 'Delete/archive department (HR_ADMIN only)',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    deleteDepartment,
  );

  fastify.post(
    '/departments/:id/reassign-and-delete',
    {
      schema: {
        tags: ['Departments'],
        description: 'Reassign all employees to another department, then archive this one',
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['reassignEmployeesTo'],
          properties: { reassignEmployeesTo: { type: 'string' } },
        },
        response: { 200: { type: 'object', additionalProperties: true } },
      },
    },
    reassignAndDelete,
  );

  fastify.get(
    '/departments/:id/employees',
    {
      schema: {
        tags: ['Departments'],
        description: 'List employees in a department (paginated)',
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 20 },
            search: { type: 'string' },
          },
        },
        response: { 200: { type: 'object', additionalProperties: true } },
      },
    },
    getDepartmentEmployees,
  );
}
