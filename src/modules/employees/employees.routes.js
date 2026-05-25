import { authenticate, authorize } from '../../middleware/authenticate.js';
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  exportEmployees,
  uploadDocument,
  listDocuments,
  deleteDocument,
  bulkDeactivate,
  bulkExport,
  presignDocument,
  confirmDocument,
  downloadDocument,
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
          200: { type: 'object', additionalProperties: true },
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
          200: { type: 'object', additionalProperties: true },
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
          required: ['firstName', 'lastName', 'workEmail', 'joinedOn'],
          properties: {
            employeeCode: { type: 'string', description: 'Auto-generated as EMP-0001 if omitted' },
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
          201: { type: 'object', additionalProperties: true },
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
          200: { type: 'object', additionalProperties: true },
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
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    deleteEmployee,
  );

  // Document upload — multipart/form-data
  fastify.post(
    '/employees/:id/documents',
    {
      schema: {
        tags: ['Employees'],
        description: 'Upload a document for an employee (Cloudinary storage). Send as multipart/form-data.',
        consumes: ['multipart/form-data'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: {
            documentType: {
              type: 'string',
              enum: ['PASSPORT', 'ID_CARD', 'RESUME', 'OFFER_LETTER', 'CONTRACT', 'CERTIFICATE', 'OTHER'],
              default: 'OTHER',
            },
          },
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    },
    uploadDocument,
  );

  fastify.get(
    '/employees/:id/documents',
    {
      schema: {
        tags: ['Employees'],
        description: 'List documents for an employee',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: { 200: { type: 'object', additionalProperties: true } },
      },
    },
    listDocuments,
  );

  fastify.delete(
    '/employees/:id/documents/:docId',
    {
      schema: {
        tags: ['Employees'],
        description: 'Delete an employee document (HR/Admin only)',
        params: {
          type: 'object',
          required: ['id', 'docId'],
          properties: { id: { type: 'string' }, docId: { type: 'string' } },
        },
        response: { 200: { type: 'object', additionalProperties: true } },
      },
      onRequest: [authorize(['HR_ADMIN', 'SUPER_ADMIN'])],
    },
    deleteDocument,
  );

  fastify.get(
    '/employees/next-code',
    {
      schema: {
        tags: ['Employees'],
        description: 'Get the next auto-generated employee code (for Add Employee form)',
        response: { 200: { type: 'object', additionalProperties: true } },
      },
    },
    async (request, reply) => {
      const { getNextEmployeeCode } = await import('./employees.service.js');
      const result = await getNextEmployeeCode(request.tenant.id);
      reply.code(200).send(result);
    },
  );

  fastify.get(
    '/employees/export/csv',
    {
      schema: {
        tags: ['Employees'],
        description: 'Export employees as CSV',
        response: {
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    exportEmployees,
  );

  // ── Bulk operations ──────────────────────────────────────────────────────────

  fastify.post(
    '/employees/bulk/deactivate',
    {
      schema: {
        tags: ['Employees'],
        description: 'Bulk deactivate employees (HR_ADMIN only)',
        body: {
          type: 'object',
          required: ['ids'],
          properties: { ids: { type: 'array', items: { type: 'string' }, minItems: 1 } },
        },
        response: { 200: { type: 'object', additionalProperties: true } },
      },
      onRequest: [authorize(['HR_ADMIN', 'SUPER_ADMIN'])],
    },
    bulkDeactivate,
  );

  fastify.post(
    '/employees/bulk/export',
    {
      schema: {
        tags: ['Employees'],
        description: 'Bulk export selected employees (HR_ADMIN only)',
        body: {
          type: 'object',
          properties: {
            ids: { type: 'array', items: { type: 'string' } },
            format: { type: 'string', enum: ['csv', 'excel', 'json'], default: 'csv' },
          },
        },
        response: { 200: { type: 'object', additionalProperties: true } },
      },
      onRequest: [authorize(['HR_ADMIN', 'SUPER_ADMIN'])],
    },
    bulkExport,
  );

  // ── Document presign / confirm / download ────────────────────────────────────

  fastify.post(
    '/employees/:id/documents/presign',
    {
      schema: {
        tags: ['Employees'],
        description: 'Get a pre-signed upload URL for a document (Cloudinary-based)',
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['filename', 'contentType'],
          properties: {
            filename: { type: 'string' },
            contentType: { type: 'string' },
            size: { type: 'integer' },
            category: { type: 'string', enum: ['OFFER_LETTER', 'AADHAAR', 'PAN', 'BANK', 'CONTRACT', 'OTHER'], default: 'OTHER' },
          },
        },
        response: { 200: { type: 'object', additionalProperties: true } },
      },
    },
    presignDocument,
  );

  fastify.post(
    '/employees/:id/documents/:documentId/confirm',
    {
      schema: {
        tags: ['Employees'],
        description: 'Confirm a document upload after PUT to storage URL',
        params: { type: 'object', required: ['id', 'documentId'], properties: { id: { type: 'string' }, documentId: { type: 'string' } } },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    },
    confirmDocument,
  );

  fastify.get(
    '/employees/:id/documents/:documentId/download',
    {
      schema: {
        tags: ['Employees'],
        description: 'Redirect to a temporary signed download URL for a document',
        params: { type: 'object', required: ['id', 'documentId'], properties: { id: { type: 'string' }, documentId: { type: 'string' } } },
      },
    },
    downloadDocument,
  );
}
