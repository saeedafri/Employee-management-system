import { successResponse, errorResponse } from '../../utils/response.js';
import * as service from './assets.service.js';
import { sendCsv } from '../../utils/csv.js';
import { assetsCsv } from '../export/exportRows.js';

const EXPORT_LIMIT = 10000;

export async function getSummary(request, reply) {
  try {
    const data = await service.getSummary(request.tenant.id);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function getAssets(request, reply) {
  try {
    const data = await service.getAssets(request.tenant.id, request.query);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function createAsset(request, reply) {
  try {
    const asset = await service.createAsset(request.tenant.id, request.body);
    return reply.code(201).send(successResponse(asset));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function updateAssetStatus(request, reply) {
  try {
    const asset = await service.updateAssetStatus(
      request.tenant.id,
      request.params.id,
      request.body.status,
    );
    return reply.send(successResponse(asset));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function assignAsset(request, reply) {
  try {
    const asset = await service.assignAsset(
      request.tenant.id,
      request.params.id,
      request.body,
    );
    return reply.send(successResponse(asset));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function recallAsset(request, reply) {
  try {
    const asset = await service.recallAsset(request.tenant.id, request.params.id);
    return reply.send(successResponse(asset));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function getRequests(request, reply) {
  try {
    const data = await service.getRequests(request.tenant.id, request.query);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function approveRequest(request, reply) {
  try {
    const data = await service.approveRequest(request.tenant.id, request.params.id);
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function declineRequest(request, reply) {
  try {
    const data = await service.declineRequest(
      request.tenant.id,
      request.params.id,
      request.body?.reason,
    );
    return reply.send(successResponse(data));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

export async function getEmployees(request, reply) {
  try {
    const employees = await service.getEmployees(request.tenant.id);
    return reply.send(successResponse(employees));
  } catch (err) {
    request.log.error(err);
    return reply.code(err.statusCode || 500).send(errorResponse(err.code || 'INTERNAL_ERROR', err.message, {}, request.id));
  }
}

// BACKEND_CONTRACT_server_side_exports.md §2.4 — replaces AssetsScreen.tsx handleExport().
export async function exportAssets(request, reply) {
  const { assets } = await service.getAssets(request.tenant.id, {
    ...request.query, limit: EXPORT_LIMIT,
  });
  return sendCsv(reply, 'assets-inventory.csv', assetsCsv(assets));
}
