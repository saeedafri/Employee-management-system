import * as repo from './assets.repository.js';

const ALLOWED_STATUSES = ['Available', 'Repair', 'Retired'];

function shapeAsset(a) {
  return {
    id: a.id,
    tag: a.tag,
    name: a.name,
    type: a.type,
    status: a.status,
    assignedTo: a.assignedToId
      ? { employeeId: a.assignedToId, name: a.assignedToName }
      : null,
    assignedSince: a.assignedSince || null,
    createdAt: a.createdAt,
  };
}

function shapeRequest(r) {
  return {
    id: r.id,
    requestedBy: { employeeId: r.requestedById, name: r.requestedByName },
    item: r.item,
    reason: r.reason,
    requestedAt: r.requestedAt.toISOString().slice(0, 10),
    status: r.status,
  };
}

export async function getSummary(tenantId) {
  return repo.getSummary(tenantId);
}

export async function getAssets(tenantId, query) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const { assets, total } = await repo.getAssets(tenantId, {
    page, limit, type: query.type, status: query.status,
  });
  return {
    assets: assets.map(shapeAsset),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function createAsset(tenantId, data) {
  const { tag, name, type, assignedTo, assignedSince } = data;
  if (!tag || !name || !type) {
    const err = new Error('tag, name, type are required');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 422;
    throw err;
  }
  const existing = await repo.findAssetByTag(tenantId, tag);
  if (existing) {
    const err = new Error(`Asset with tag "${tag}" already exists`);
    err.code = 'DUPLICATE_TAG';
    err.statusCode = 409;
    throw err;
  }
  const status = assignedTo ? 'Assigned' : 'Available';
  const asset = await repo.createAsset(tenantId, {
    tag, name, type, status,
    assignedToId: assignedTo?.employeeId || null,
    assignedToName: assignedTo?.name || null,
    assignedSince: assignedSince || null,
  });
  return shapeAsset(asset);
}

export async function updateAssetStatus(tenantId, id, status) {
  if (!ALLOWED_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 422;
    throw err;
  }
  const asset = await repo.getAssetById(tenantId, id);
  if (!asset) {
    const err = new Error('Asset not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  const updated = await repo.updateAsset(id, {
    status,
    assignedToId: null,
    assignedToName: null,
    assignedSince: null,
  });
  return shapeAsset(updated);
}

export async function assignAsset(tenantId, id, { employeeId, name, since }) {
  const asset = await repo.getAssetById(tenantId, id);
  if (!asset) {
    const err = new Error('Asset not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  if (asset.status === 'Retired') {
    const err = new Error('Cannot assign a retired asset');
    err.code = 'ASSET_RETIRED';
    err.statusCode = 409;
    throw err;
  }
  const updated = await repo.updateAsset(id, {
    status: 'Assigned',
    assignedToId: employeeId,
    assignedToName: name,
    assignedSince: since || null,
  });
  return shapeAsset(updated);
}

export async function recallAsset(tenantId, id) {
  const asset = await repo.getAssetById(tenantId, id);
  if (!asset) {
    const err = new Error('Asset not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  const updated = await repo.updateAsset(id, {
    status: 'Available',
    assignedToId: null,
    assignedToName: null,
    assignedSince: null,
  });
  return shapeAsset(updated);
}

export async function getRequests(tenantId, query) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const { requests, total } = await repo.getRequests(tenantId, { page, limit });
  return {
    requests: requests.map(shapeRequest),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function approveRequest(tenantId, id) {
  const req = await repo.getRequestById(tenantId, id);
  if (!req) {
    const err = new Error('Request not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  if (req.status !== 'Pending') {
    const err = new Error('Request is not in Pending state');
    err.code = 'NOT_PENDING';
    err.statusCode = 409;
    throw err;
  }
  const updated = await repo.updateRequest(id, { status: 'Approved' });
  return { id: updated.id, status: updated.status };
}

export async function declineRequest(tenantId, id, reason) {
  const req = await repo.getRequestById(tenantId, id);
  if (!req) {
    const err = new Error('Request not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  if (req.status !== 'Pending') {
    const err = new Error('Request is not in Pending state');
    err.code = 'NOT_PENDING';
    err.statusCode = 409;
    throw err;
  }
  const updated = await repo.updateRequest(id, { status: 'Declined', declineReason: reason || null });
  return { id: updated.id, status: updated.status };
}

export async function getEmployees(tenantId) {
  const employees = await repo.getEmployees(tenantId);
  return employees.map(e => ({ employeeId: e.id, name: `${e.firstName} ${e.lastName}` }));
}
