/**
 * The manifest's real proof (BACKEND_REQUEST §2.4.3): for every role and every
 * route, a 403 must occur if and only if the role holds none of the manifest's
 * keys for that route.
 *
 * Read-only: probes GET routes without path params. A write probe would need a
 * body per route and would mutate, so those are covered by the frontend's own
 * audit-role-access.mjs rather than here.
 *
 *   API_BASE=https://ems-api.saqibsaeed.cloud/api/v1 node scripts/verifyPermissionManifest.mjs
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4001/api/v1';
const TENANT = process.env.TENANT_KEY ?? 'acme-corp-001';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';

const USERS = {
  SUPER_ADMIN: 'superadmin@acme.test',
  HR_ADMIN: 'hr@acme.test',
  MANAGER: 'aman@acme.test',
  EMPLOYEE: 'priya@acme.test',
  AUDITOR: 'auditor@acme.test',
};

async function login(email) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-key': TENANT },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const json = await res.json();
  const token = json?.data?.accessToken;
  if (!token) throw new Error(`login failed for ${email}: ${res.status}`);
  return { token, keys: new Set(json.data.permissions ?? []) };
}

const sessions = {};
for (const [role, email] of Object.entries(USERS)) sessions[role] = await login(email);

const manifestRes = await fetch(`${BASE}/auth/permission-manifest`, {
  headers: { authorization: `Bearer ${sessions.SUPER_ADMIN.token}`, 'x-tenant-key': TENANT },
});
const manifest = (await manifestRes.json()).data;
console.log(`manifest version ${manifest.version} — ${manifest.routes.length} routes\n`);

const prefix = new URL(BASE).pathname;
const probeable = manifest.routes.filter(
  (r) => r.method === 'GET' && !r.public && !r.path.includes(':') && !r.path.includes('*') && r.path.startsWith(prefix),
);

let checked = 0;
const mismatches = [];
for (const [role, session] of Object.entries(sessions)) {
  for (const route of probeable) {
    const res = await fetch(`${BASE}${route.path.slice(prefix.length)}`, {
      headers: { authorization: `Bearer ${session.token}`, 'x-tenant-key': TENANT },
    });
    // SUPER_ADMIN bypasses every gate by design (authenticate.js), so it can
    // never be forbidden regardless of what keys it holds.
    const shouldForbid =
      role !== 'SUPER_ADMIN'
      && route.permissions.length > 0
      && !route.permissions.some((key) => session.keys.has(key));
    const forbidden = res.status === 403;
    checked += 1;
    if (forbidden !== shouldForbid) {
      mismatches.push(
        `${role.padEnd(12)} ${route.path.slice(prefix.length).padEnd(46)} `
        + `manifest=[${route.permissions.join(', ') || '—'}] expected=${shouldForbid ? 403 : 'not 403'} actual=${res.status}`,
      );
    }
  }
}

console.log(`checked ${checked} role/route pairs across ${Object.keys(sessions).length} roles`);
if (mismatches.length === 0) {
  console.log('PASS — the manifest predicts live behaviour exactly.');
} else {
  console.log(`FAIL — ${mismatches.length} mismatches:`);
  for (const line of mismatches) console.log('  ' + line);
  process.exitCode = 1;
}
