import { authenticate } from '../../middleware/authenticate.js';
import { config } from '../../config/index.js';
import { getProcessSnapshot } from '../../utils/processMonitor.js';
import { getSseDiagnostics } from '../../utils/sseClients.js';
import { prisma } from '../../plugins/prisma.js';
import { errorResponse } from '../../utils/response.js';

function opsTokenOk(request) {
  const expected = process.env.OPS_LOGS_TOKEN;
  if (!expected) return false;
  const q = request.query?.token;
  const h = request.headers['x-ops-token'];
  return q === expected || h === expected;
}

async function requireOpsAccess(request, reply) {
  // Shared bookmark token (optional) OR SUPER_ADMIN JWT.
  if (opsTokenOk(request)) {
    request.opsAuth = 'token';
    return;
  }
  await authenticate(request, reply);
  if (reply.sent) return;
  if (request.user?.memberType !== 'SUPER_ADMIN') {
    return reply.code(403).send(
      errorResponse('FORBIDDEN', 'Ops logs are restricted to SUPER_ADMIN', {}, request.id),
    );
  }
  request.opsAuth = 'super_admin';
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderOpsHtml({ logs, snapshot, sse, levelFilter, apiPrefix }) {
  const rows = logs.map((l) => `
    <tr class="lvl-${escapeHtml(l.level)}">
      <td>${escapeHtml(l.createdAt?.toISOString?.() || l.createdAt)}</td>
      <td><span class="badge">${escapeHtml(l.level)}</span></td>
      <td>${escapeHtml(l.module || '')}</td>
      <td>${escapeHtml(l.message)}</td>
      <td>${escapeHtml(l.requestId || '')}</td>
    </tr>`).join('');

  const errRows = (snapshot.recentErrors || []).map((e) => `
    <tr>
      <td>${escapeHtml(e.at)}</td>
      <td>${escapeHtml(e.kind)}</td>
      <td>${escapeHtml(e.message)}</td>
    </tr>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>EMS Ops Logs</title>
  <style>
    :root { --bg:#0f1419; --card:#1a2332; --text:#e7ecf3; --muted:#9aa7b8; --accent:#4f46e5; --err:#ef4444; --warn:#f59e0b; --info:#3b82f6; --dbg:#6b7280; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif; background:var(--bg); color:var(--text); }
    header { padding:16px 20px; border-bottom:1px solid #243044; display:flex; gap:16px; flex-wrap:wrap; align-items:center; justify-content:space-between; }
    h1 { font-size:18px; margin:0; }
    .grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap:12px; padding:16px 20px; }
    .card { background:var(--card); border-radius:10px; padding:12px 14px; }
    .card .label { color:var(--muted); font-size:12px; }
    .card .value { font-size:22px; font-weight:700; margin-top:4px; }
    .warn-ram { color: #fbbf24; }
    .bad-ram { color: var(--err); }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th, td { padding:8px 10px; border-bottom:1px solid #243044; text-align:left; vertical-align:top; }
    th { color:var(--muted); font-weight:600; position:sticky; top:0; background:var(--card); }
    .badge { padding:2px 6px; border-radius:4px; font-weight:700; font-size:11px; }
    .lvl-ERROR .badge { background:#7f1d1d; color:#fecaca; }
    .lvl-WARN .badge { background:#78350f; color:#fde68a; }
    .lvl-INFO .badge { background:#1e3a8a; color:#bfdbfe; }
    .lvl-DEBUG .badge { background:#374151; color:#e5e7eb; }
    .panel { margin:0 20px 20px; background:var(--card); border-radius:10px; overflow:auto; max-height:55vh; }
    .filters a { color:#c7d2fe; margin-right:10px; text-decoration:none; font-size:13px; }
    .filters a.active { color:#fff; font-weight:700; text-decoration:underline; }
    .note { color:var(--muted); font-size:12px; padding:0 20px 16px; }
  </style>
  <meta http-equiv="refresh" content="15" />
</head>
<body>
  <header>
    <div>
      <h1>EMS Ops Logs</h1>
      <div class="note" style="padding:4px 0 0;">Private page — not linked in product UI. Auto-refresh 15s.</div>
    </div>
    <div class="filters">
      <a class="${!levelFilter ? 'active' : ''}" href="?">ALL</a>
      <a class="${levelFilter === 'ERROR' ? 'active' : ''}" href="?level=ERROR">ERROR</a>
      <a class="${levelFilter === 'WARN' ? 'active' : ''}" href="?level=WARN">WARN</a>
      <a class="${levelFilter === 'INFO' ? 'active' : ''}" href="?level=INFO">INFO</a>
      <a class="${levelFilter === 'DEBUG' ? 'active' : ''}" href="?level=DEBUG">DEBUG</a>
      <a href="${escapeHtml(apiPrefix)}/logs">API JSON</a>
    </div>
  </header>

  <div class="grid">
    <div class="card"><div class="label">RSS RAM</div><div class="value ${snapshot.memory.rssMb > 512 ? 'bad-ram' : snapshot.memory.rssMb > 256 ? 'warn-ram' : ''}">${snapshot.memory.rssMb} MB</div></div>
    <div class="card"><div class="label">Heap Used</div><div class="value">${snapshot.memory.heapUsedMb} / ${snapshot.memory.heapTotalMb} MB</div></div>
    <div class="card"><div class="label">Uptime</div><div class="value">${Math.floor(snapshot.uptimeSec / 3600)}h ${Math.floor((snapshot.uptimeSec % 3600) / 60)}m</div></div>
    <div class="card"><div class="label">SSE connections</div><div class="value">${sse.connectionCount}</div></div>
    <div class="card"><div class="label">SSE emits</div><div class="value">${sse.emits}</div></div>
    <div class="card"><div class="label">Load 1m</div><div class="value">${Number(snapshot.loadavg['1m']).toFixed(2)}</div></div>
    <div class="card"><div class="label">Node</div><div class="value" style="font-size:14px">${escapeHtml(snapshot.nodeVersion)}</div></div>
    <div class="card"><div class="label">Free / Total host RAM</div><div class="value" style="font-size:14px">${snapshot.freememMb} / ${snapshot.totalmemMb} MB</div></div>
  </div>

  <h2 style="padding:0 20px;font-size:14px;color:var(--muted);">Recent process errors / warnings</h2>
  <div class="panel">
    <table>
      <thead><tr><th>When</th><th>Kind</th><th>Message</th></tr></thead>
      <tbody>${errRows || '<tr><td colspan="3">None in ring buffer</td></tr>'}</tbody>
    </table>
  </div>

  <h2 style="padding:0 20px;font-size:14px;color:var(--muted);">Application LogEntry (newest first)</h2>
  <div class="panel">
    <table>
      <thead><tr><th>When</th><th>Level</th><th>Module</th><th>Message</th><th>Request</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No logs</td></tr>'}</tbody>
    </table>
  </div>
</body>
</html>`;
}

export default async function opsRoutes(fastify) {
  // JSON process snapshot for tooling
  fastify.get('/ops/process', {
    schema: { hide: true },
    onRequest: [requireOpsAccess],
  }, async (request, reply) => {
    return reply.send({
      success: true,
      data: {
        process: getProcessSnapshot(),
        sse: getSseDiagnostics(),
        env: config.env,
      },
    });
  });

  // Private HTML page — SUPER_ADMIN or OPS_LOGS_TOKEN
  fastify.get('/ops/logs', {
    schema: { hide: true },
    onRequest: [requireOpsAccess],
  }, async (request, reply) => {
    const level = request.query?.level;
    const where = {};
    if (level && ['ERROR', 'WARN', 'INFO', 'DEBUG'].includes(level)) {
      where.level = level;
    }

    const logs = await prisma.logEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        level: true,
        module: true,
        message: true,
        requestId: true,
        createdAt: true,
      },
    });

    const html = renderOpsHtml({
      logs,
      snapshot: getProcessSnapshot(),
      sse: getSseDiagnostics(),
      levelFilter: level || '',
      apiPrefix: config.apiPrefix || '/api/v1',
    });

    return reply.type('text/html').send(html);
  });
}
