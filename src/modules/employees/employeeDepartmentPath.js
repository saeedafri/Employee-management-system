import { prisma } from '../../plugins/prisma.js';

export async function validateDepartmentPath(tenantId, pathIds) {
  if (!Array.isArray(pathIds) || pathIds.length === 0) {
    const e = new Error('Department path must be a non-empty array');
    e.field = 'departmentId';
    throw e;
  }

  const departments = await prisma.department.findMany({
    where: { tenantId, id: { in: pathIds }, deletedAt: null },
    select: { id: true, name: true, parentId: true },
  });

  if (departments.length !== pathIds.length) {
    const e = new Error('One or more department IDs not found or inactive');
    e.field = 'departmentId';
    throw e;
  }

  const byId = new Map(departments.map(d => [d.id, d]));

  const first = byId.get(pathIds[0]);
  if (first.parentId !== null) {
    const e = new Error('First department in path must be a root department (parentId must be null)');
    e.field = 'departmentId';
    throw e;
  }

  for (let i = 0; i < pathIds.length - 1; i++) {
    const next = byId.get(pathIds[i + 1]);
    if (next.parentId !== pathIds[i]) {
      const e = new Error('Department path is not a contiguous parent-child chain');
      e.field = 'departmentId';
      throw e;
    }
  }

  return {
    leafDepartmentId: pathIds[pathIds.length - 1],
    path: pathIds.map(id => byId.get(id)),
  };
}

export async function loadAllDeptsByTenant(tenantId) {
  const depts = await prisma.department.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, name: true, parentId: true },
  });
  return new Map(depts.map(d => [d.id, d]));
}

export function walkPath(byId, leafId) {
  if (!leafId) return [];
  const path = [];
  let current = byId.get(leafId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  return path;
}

export function getDescendantIds(byId, rootId) {
  const result = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, dept] of byId) {
      if (!result.has(id) && dept.parentId && result.has(dept.parentId)) {
        result.add(id);
        changed = true;
      }
    }
  }
  return [...result];
}

export function formatEmployeeForApi(employee, departmentPath) {
  const path = departmentPath || [];
  const result = { ...employee };
  delete result.department;
  result.departmentId = path.map(d => d.id);
  result.department = path.map(d => ({ id: d.id, name: d.name }));
  return result;
}
