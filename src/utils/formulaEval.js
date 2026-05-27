// Safe formula evaluator for payroll salary components.
// Only HR admins create formulas — trusted input, but we still restrict the syntax.
const SAFE_PATTERN = /^[A-Z_0-9\s+\-*()><!=.,]+$/;
const SPECIAL_VARS = new Set(['CTC', 'GROSS', 'NET']);
const FUNC_NAMES = new Set(['MIN', 'MAX', 'IF', 'ROUND', 'FLOOR', 'CEIL', 'ABS']);

export function evaluateFormula(formula, componentValues) {
  if (!SAFE_PATTERN.test(formula)) {
    throw new Error('Invalid formula characters');
  }

  const scope = {
    ...componentValues,
    MIN: Math.min,
    MAX: Math.max,
    IF: (cond, t, f) => (cond ? t : f),
    ROUND: (n, d) => (d !== undefined ? Math.round(n * 10 ** d) / 10 ** d : Math.round(n)),
    FLOOR: Math.floor,
    CEIL: Math.ceil,
    ABS: Math.abs,
  };

  const names = Object.keys(scope);
  const values = Object.values(scope);

  // eslint-disable-next-line no-new-func
  const fn = new Function(...names, `"use strict"; return (${formula});`);
  const result = fn(...values);

  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error(`Formula produced non-numeric result: ${result}`);
  }
  return result;
}

export function extractFormulaRefs(formula) {
  const tokens = formula.match(/[A-Z][A-Z0-9_]*/g) || [];
  return tokens.filter((t) => !FUNC_NAMES.has(t) && !SPECIAL_VARS.has(t));
}

export function detectCircularDep(components) {
  const deps = {};
  for (const c of components) {
    deps[c.code] = [];
    if (c.calculationType === 'PERCENTAGE' && c.basisCode) {
      deps[c.code].push(c.basisCode);
    } else if (c.calculationType === 'FORMULA' && c.formula) {
      const existing = new Set(components.map((x) => x.code));
      deps[c.code] = extractFormulaRefs(c.formula).filter((r) => existing.has(r));
    }
  }

  const visited = new Set();
  const stack = new Set();

  function dfs(node) {
    if (stack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    stack.add(node);
    for (const dep of deps[node] || []) {
      if (dfs(dep)) return true;
    }
    stack.delete(node);
    return false;
  }

  return Object.keys(deps).some((code) => dfs(code));
}

export function topologicalSort(components) {
  const codeMap = Object.fromEntries(components.map((c) => [c.code, c]));
  const deps = {};

  for (const c of components) {
    deps[c.code] = [];
    if (c.calculationType === 'PERCENTAGE' && c.basisCode && codeMap[c.basisCode]) {
      deps[c.code].push(c.basisCode);
    } else if (c.calculationType === 'FORMULA' && c.formula) {
      deps[c.code] = extractFormulaRefs(c.formula).filter((r) => codeMap[r]);
    }
  }

  const result = [];
  const visited = new Set();

  function visit(code) {
    if (visited.has(code)) return;
    visited.add(code);
    for (const dep of deps[code] || []) visit(dep);
    if (codeMap[code]) result.push(codeMap[code]);
  }

  for (const code of Object.keys(deps)) visit(code);
  return result;
}
