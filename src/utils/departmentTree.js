/**
 * @param {Array<{id: string, parentId: string|null}>} departments
 * @returns {Map<string, string[]>}
 */
export function buildDepartmentChildrenMap(departments) {
  const map = new Map(departments.map(d => [d.id, []]));
  for (const dept of departments) {
    if (dept.parentId && map.has(dept.parentId)) {
      map.get(dept.parentId).push(dept.id);
    }
  }
  return map;
}

/**
 * Returns all descendant IDs (not including departmentId itself).
 * @param {string} departmentId
 * @param {Map<string, string[]>} childrenMap
 * @returns {string[]}
 */
export function getDescendantDepartmentIds(departmentId, childrenMap) {
  const result = [];
  const queue = [...(childrenMap.get(departmentId) || [])];
  while (queue.length) {
    const id = queue.shift();
    result.push(id);
    queue.push(...(childrenMap.get(id) || []));
  }
  return result;
}

/**
 * Returns [departmentId, ...allDescendantIds].
 * @param {string} departmentId
 * @param {Map<string, string[]>} childrenMap
 * @returns {string[]}
 */
export function getDepartmentAndDescendantIds(departmentId, childrenMap) {
  return [departmentId, ...getDescendantDepartmentIds(departmentId, childrenMap)];
}

/**
 * Computes inclusive subtree employee counts (DFS roll-up).
 * @param {Array<{id: string, parentId: string|null}>} departments
 * @param {Map<string, number>} directCountByDepartmentId
 * @returns {Map<string, number>} deptId → rollup count
 */
export function buildRollupEmployeeCounts(departments, directCountByDepartmentId) {
  const childrenMap = buildDepartmentChildrenMap(departments);
  const rollup = new Map();

  function dfs(deptId) {
    if (rollup.has(deptId)) return rollup.get(deptId);
    let total = directCountByDepartmentId.get(deptId) || 0;
    for (const childId of (childrenMap.get(deptId) || [])) {
      total += dfs(childId);
    }
    rollup.set(deptId, total);
    return total;
  }

  for (const dept of departments) {
    dfs(dept.id);
  }

  return rollup;
}
