/**
 * Seed production data via REST API (when direct DB is unreachable).
 * Run: node scripts/seedProductionViaApi.mjs
 */
const API = process.env.API_URL || 'https://employee-management-system-2b9q.onrender.com/api/v1';
const TENANT = 'acme-corp-001';
const HR = { email: process.env.SEED_HR_EMAIL || 'hr@acme.test', password: 'Password123!' };

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-key': TENANT },
    body: JSON.stringify(HR),
  });
  const json = await res.json();
  if (!json.data?.accessToken) throw new Error(`Login failed: ${JSON.stringify(json)}`);
  return json.data.accessToken;
}

async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'x-tenant-key': TENANT,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function main() {
  const token = await login();
  console.log('Logged in as', HR.email);

  const calendars = [
    { name: 'India Monthly', code: 'IN-MONTHLY', country: 'IN', paySchedule: 'MONTHLY', firstPayDate: '2026-01-25' },
    { name: 'India Bi-Weekly', code: 'IN-BIWEEKLY', country: 'IN', paySchedule: 'BIWEEKLY', firstPayDate: '2026-01-10' },
    { name: 'US Bi-Weekly', code: 'US-BIWEEKLY', country: 'US', paySchedule: 'BIWEEKLY', firstPayDate: '2026-01-10' },
    { name: 'US Weekly', code: 'US-WEEKLY', country: 'US', paySchedule: 'WEEKLY', firstPayDate: '2026-01-03' },
  ];
  for (const cal of calendars) {
    const r = await api(token, 'POST', '/payroll/pay-calendars', cal);
    console.log('pay-calendar', cal.code, r.status, r.json.error?.code || 'ok');
  }

  const wh = await api(token, 'GET', '/settings/webhooks');
  const existing = wh.json?.data?.webhooks?.length ?? 0;
  if (existing === 0) {
    const created = await api(token, 'POST', '/settings/webhooks', {
      name: 'HR Slack Notifications',
      url: 'https://hooks.slack.example/acme-hr',
      events: ['leave.submitted', 'timesheet.submitted', 'payroll.run.approved'],
      enabled: true,
    });
    console.log('webhook create', created.status);
  } else {
    console.log('webhooks already seeded:', existing);
  }

  const emps = await api(token, 'GET', '/employees?limit=5');
  const list = emps.json?.data?.employees ?? emps.json?.data?.items ?? emps.json?.data ?? [];
  const empId = Array.isArray(list) ? list[0]?.id : null;
  if (empId) {
    const patch = await api(token, 'PATCH', `/employees/${empId}`, {
      designation: 'Senior Engineer (audit seed)',
    });
    console.log('employee patch audit seed', patch.status);
    const logs = await api(token, 'GET', `/audit-logs?entity=Employee&entityId=${empId}&limit=5`);
    console.log('audit logs count', logs.json?.data?.logs?.length ?? 0);
  }

  const storage = await api(token, 'PATCH', '/settings/integrations/storage', {
    provider: 'cloudinary',
    enabled: true,
  });
  console.log('storage patch', storage.status, storage.json?.data?.provider);

  console.log('Production API seed complete.');
}

main().catch((e) => { console.error(e); process.exit(1); });
