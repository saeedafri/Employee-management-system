/**
 * Reconcile the live tenant's saved role-permission customization with what the
 * route layer now enforces.
 *
 * Boot-sync only *adds* newly-catalogued keys — it never reinstates a grant a
 * tenant admin revoked. So every route gate we add has to be paired with an
 * explicit grant/revoke here, or the gate either leaks (BE-1) or locks a role
 * out of a working screen (BE-4).
 *
 *   node scripts/rbacGrantReconcile.mjs            # dry run, prints the delta
 *   node scripts/rbacGrantReconcile.mjs --apply    # PATCHes the tenant matrix
 *
 * Env: API_BASE, TENANT_KEY, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD
 */
const API = process.env.API_BASE ?? 'https://ems-api.saqibsaeed.cloud/api/v1';
const TENANT = process.env.TENANT_KEY ?? 'acme-corp-001';
const EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'superadmin@acme.test';
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? 'Password123!';
const apply = process.argv.includes('--apply');

// BE-1 — audit trail must not be readable by MANAGER/EMPLOYEE.
// BE-4 Option A — these roles must keep the screens the gates now cover.
const REVOKE = {
  MANAGER: ['audit:read', 'audit:export'],
  EMPLOYEE: ['audit:read', 'audit:export'],
};

const GRANT = {
  MANAGER: ['employees:read', 'departments:read', 'leave:read', 'leave:request', 'attendance:read', 'attendance:write'],
  EMPLOYEE: ['employees:read', 'departments:read', 'leave:read', 'leave:request', 'attendance:read', 'attendance:write'],
};

async function call(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${JSON.stringify(json)}`);
  return json;
}

const login = await call('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
const token = login.data?.accessToken ?? login.data?.access_token;
if (!token) throw new Error('No access token in login response');

const current = await call('/settings/roles-permissions', { token });
const matrix = current.data?.matrix ?? current.matrix;

for (const role of ['MANAGER', 'EMPLOYEE']) {
  const held = new Set(matrix[role] ?? []);
  const removed = (REVOKE[role] ?? []).filter((key) => held.has(key));
  const added = (GRANT[role] ?? []).filter((key) => !held.has(key));

  if (removed.length === 0 && added.length === 0) {
    console.log(`${role}: already reconciled (${held.size} keys)`);
    continue;
  }

  for (const key of removed) held.delete(key);
  for (const key of added) held.add(key);
  const next = [...held].sort();

  console.log(`${role}: -[${removed.join(', ')}] +[${added.join(', ')}] → ${next.length} keys`);

  if (apply) {
    await call('/settings/roles-permissions', { method: 'PATCH', token, body: { role, permissions: next } });
    console.log(`${role}: applied`);
  }
}

if (!apply) console.log('\nDry run. Re-run with --apply to write.');
