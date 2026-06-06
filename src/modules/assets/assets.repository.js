import { prisma } from '../../plugins/prisma.js';

export async function getSummary(tenantId) {
  const [total, assigned, available, inRepair] = await Promise.all([
    prisma.asset.count({ where: { tenantId } }),
    prisma.asset.count({ where: { tenantId, status: 'Assigned' } }),
    prisma.asset.count({ where: { tenantId, status: 'Available' } }),
    prisma.asset.count({ where: { tenantId, status: 'Repair' } }),
  ]);
  const utilizationPct = total > 0 ? Math.round((assigned / total) * 100) : 0;
  return { totalAssets: total, assigned, available, inRepair, utilizationPct, avgRepairDays: 6 };
}

export async function getAssets(tenantId, { page, limit, type, status }) {
  const where = {
    tenantId,
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  };
  const skip = (page - 1) * limit;
  const [assets, total] = await Promise.all([
    prisma.asset.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.asset.count({ where }),
  ]);
  return { assets, total };
}

export async function getAssetById(tenantId, id) {
  return prisma.asset.findFirst({ where: { id, tenantId } });
}

export async function createAsset(tenantId, data) {
  return prisma.asset.create({ data: { ...data, tenantId } });
}

export async function updateAsset(id, data) {
  return prisma.asset.update({ where: { id }, data });
}

export async function findAssetByTag(tenantId, tag) {
  return prisma.asset.findUnique({ where: { tenantId_tag: { tenantId, tag } } });
}

export async function getRequests(tenantId, { page, limit, status }) {
  const skip = (page - 1) * limit;
  const where = { tenantId, ...(status && { status }) };
  const [requests, total] = await Promise.all([
    prisma.assetRequest.findMany({ where, skip, take: limit, orderBy: { requestedAt: 'desc' } }),
    prisma.assetRequest.count({ where }),
  ]);
  return { requests, total };
}

export async function getRequestById(tenantId, id) {
  return prisma.assetRequest.findFirst({ where: { id, tenantId } });
}

export async function updateRequest(id, data) {
  return prisma.assetRequest.update({ where: { id }, data });
}

export async function getEmployees(tenantId) {
  return prisma.employee.findMany({
    where: { tenantId, deletedAt: null, employmentStatus: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  });
}
