import { authenticate } from '../../middleware/authenticate.js';
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
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
            parentId: { type: 'string' },
            departmentCode: { type: 'string' },
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
            parentId: { type: 'string' },
            departmentCode: { type: 'string' },
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
}
