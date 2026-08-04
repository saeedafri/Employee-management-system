/**
 * DEEP E2E — NOTIF-E2E-CREATE
 * Create a real Notification path (priya leave SL → aman/HR/SA recipients),
 * watch unread-count / list / SSE / Redis ems:sse, negative isolation, withdraw cleanup.
 *
 * FE http://localhost:3001 · BE http://localhost:4000 · tenant acme-corp-001
 * No Render · minimize mutations (1 leave create + withdraw)
 */
import { chromium } from 'playwright';
import IORedis from 'ioredis';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const BE = process.env.BE_BASE || 'http://localhost:4000';
const API = `${BE}/api/v1`;
const TENANT = 'acme-corp-001';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:16379';
const PASS = 'Password123!';
const SHOT =
  process.env.SHOT_DIR ||
  '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/e2e-ui-screenshots/stress/notif-e2e-create';

fs.mkdirSync(SHOT, { recursive: true });
for (const f of fs.readdirSync(SHOT)) {
  if (f.endsWith('.png') || ['results.json', 'FINDINGS.md', 'sse-aman.log', 'redis-pubsub.log'].includes(f)) {
    fs.unlinkSync(path.join(SHOT, f));
  }
}

let shotIdx = 0;
const screenshots = [];
const findings = [];
const log = [];
const result = {
  mode: 'NOTIF-E2E-CREATE',
  fe: FE,
  be: BE,
  tenant: TENANT,
  redisUrl: REDIS_URL,
  ts: new Date().toISOString(),
  before: {},
  mutation: {},
  after: {},
  withdraw: {},
  redis: {},
  sse: {},
  isolation: {},
  screenshots,
  findings,
  log,
};

function note(severity, layer, where, why, evidence = {}) {
  const row = { severity, layer, where, why, evidence, ts: new Date().toISOString() };
  findings.push(row);
  console.log(`  🐛 [${severity}][${layer}] ${where}: ${String(why).slice(0, 180)}`);
}

function step(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  log.push(line);
  console.log(line);
}

function persist() {
  fs.writeFileSync(path.join(SHOT, 'results.json'), JSON.stringify(result, null, 2));
}

async function shot(page, name) {
  shotIdx += 1;
  const file = `${String(shotIdx).padStart(3, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SHOT, file), fullPage: false }).catch(() => {});
  screenshots.push({ file, url: page.url(), name });
  console.log(`  📸 ${file}`);
  persist();
  return file;
}

async function loginApi(email) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-key': TENANT },
    body: JSON.stringify({ email, password: PASS }),
  });
  const json = await res.json().catch(() => ({}));
  const token = json?.data?.accessToken || json?.data?.tokens?.accessToken || json?.accessToken;
  const user = json?.data?.user || json?.data || {};
  return { status: res.status, token, user, body: json };
}

async function apiGet(token, pathName) {
  const res = await fetch(`${API}${pathName}`, {
    headers: { authorization: `Bearer ${token}`, 'x-tenant-key': TENANT },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function apiPost(token, pathName, body) {
  const res = await fetch(`${API}${pathName}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'x-tenant-key': TENANT,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function apiPatch(token, pathName, body = {}) {
  const res = await fetch(`${API}${pathName}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'x-tenant-key': TENANT,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function unreadFrom(json) {
  return json?.data?.count ?? json?.data?.unreadCount ?? json?.count ?? null;
}

function listFrom(json) {
  const d = json?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.notifications)) return d.notifications;
  if (Array.isArray(d?.items)) return d.items;
  return [];
}

function summarizeNotifs(items, n = 5) {
  return items.slice(0, n).map((x) => ({
    id: x.id,
    type: x.type,
    title: x.title,
    body: (x.body || x.message || '').slice(0, 120),
    isRead: x.isRead ?? (x.readAt != null),
    createdAt: x.createdAt,
  }));
}

async function redisObserveBefore() {
  const out = { ping: null, channels: [], numsub: null, cacheSample: [], error: null };
  const client = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
  client.on('error', () => {});
  try {
    await client.connect();
    out.ping = await client.ping();
    out.channels = await client.pubsub('CHANNELS', '*');
    out.numsub = await client.pubsub('NUMSUB', 'ems:sse');
    let cursor = '0';
    const keys = [];
    do {
      const [next, batch] = await client.scan(cursor, 'MATCH', 'cache:*', 'COUNT', 50);
      cursor = String(next);
      keys.push(...batch);
    } while (cursor !== '0' && keys.length < 30);
    out.cacheSample = keys.slice(0, 20);
  } catch (e) {
    out.error = e.message;
  } finally {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
  return out;
}

/** Spawn redis-cli SUBSCRIBE ems:sse in background; collect PUBLISH payloads. */
function startRedisSubscriber(logPath) {
  const events = [];
  const child = spawn('redis-cli', ['-u', REDIS_URL, '--raw', 'SUBSCRIBE', 'ems:sse'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buf = '';
  const onChunk = (chunk) => {
    const s = chunk.toString();
    buf += s;
    fs.appendFileSync(logPath, s);
    // redis-cli --raw SUBSCRIBE prints: subscribe\nems:sse\n1\n then message\nems:sse\n{payload}\n
    const parts = buf.split('\n');
    // keep last incomplete line
    buf = parts.pop() || '';
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'message' && parts[i + 1] === 'ems:sse' && parts[i + 2]) {
        const payload = parts[i + 2];
        let parsed = null;
        try {
          parsed = JSON.parse(payload);
        } catch {
          parsed = { raw: payload.slice(0, 300) };
        }
        events.push({ ts: new Date().toISOString(), parsed });
        i += 2;
      }
    }
  };
  child.stdout.on('data', onChunk);
  child.stderr.on('data', (c) => fs.appendFileSync(logPath, `[stderr] ${c}`));
  return {
    events,
    stop: () => {
      try {
        child.kill('SIGINT');
      } catch {
        /* ignore */
      }
    },
  };
}

/** Open SSE stream via fetch; collect notification events until abort. */
function openSse(token, logPath) {
  const events = [];
  const ac = new AbortController();
  const url = `${API}/notifications/stream?token=${encodeURIComponent(token)}`;
  const started = Date.now();
  const p = (async () => {
    try {
      const res = await fetch(url, {
        headers: { accept: 'text/event-stream', 'x-tenant-key': TENANT },
        signal: ac.signal,
      });
      fs.appendFileSync(logPath, `SSE_STATUS ${res.status} ${res.headers.get('content-type')}\n`);
      if (!res.ok || !res.body) {
        events.push({ error: `sse_http_${res.status}` });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        acc += chunk;
        fs.appendFileSync(logPath, chunk);
        // parse SSE blocks
        const blocks = acc.split('\n\n');
        acc = blocks.pop() || '';
        for (const block of blocks) {
          const lines = block.split('\n');
          let event = 'message';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch {
            /* keep string */
          }
          events.push({ ts: new Date().toISOString(), event, data: parsed, elapsedMs: Date.now() - started });
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        events.push({ error: e.message });
        fs.appendFileSync(logPath, `SSE_ERR ${e.message}\n`);
      }
    }
  })();
  return {
    events,
    ready: () => new Promise((r) => setTimeout(r, 800)),
    stop: async () => {
      ac.abort();
      await p.catch(() => {});
    },
  };
}

async function loginUi(page, email) {
  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('tenantKey', 'acme-corp-001');
    localStorage.setItem('x-tenant-key', 'acme-corp-001');
  });
  await page.fill('input[type="email"], #email, input[name="email"]', email);
  await page.fill('input[type="password"], #password, input[name="password"]', PASS);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/dashboard|home|leave/i, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function openBell(page) {
  const bell = page.locator('button[aria-label*="otif" i], button[aria-label*="Bell" i]').first();
  if (await bell.isVisible({ timeout: 3000 }).catch(() => false)) {
    await bell.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    return true;
  }
  const btns = page.locator('header button, [data-testid="app-header"] button');
  const n = await btns.count();
  for (let i = Math.max(0, n - 12); i < n; i++) {
    const al = ((await btns.nth(i).getAttribute('aria-label').catch(() => '')) || '').toLowerCase();
    if (/notif|bell/.test(al)) {
      await btns.nth(i).click().catch(() => {});
      await page.waitForTimeout(800);
      return true;
    }
  }
  return false;
}

function pickLeaveDate() {
  // Far future weekday to avoid holiday/weekend collisions — Wed 2026-12-16
  return { startDate: '2026-12-16', endDate: '2026-12-16' };
}

function writeFindingsMd() {
  const lines = [];
  lines.push('# NOTIF-E2E-CREATE Findings');
  lines.push('');
  lines.push(`> Generated ${result.ts} · BE \`${BE}\` · FE \`${FE}\` · tenant \`${TENANT}\``);
  lines.push(`> Mutation: priya submits **SL** 1 day → notify manager/HR/SA · then withdraw`);
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  const delta = (result.after?.aman?.unread ?? 0) - (result.before?.aman?.unread ?? 0);
  const sseHit = (result.sse?.amanEvents || []).some(
    (e) => e.event === 'notification' || e.data?.type === 'leave_requested',
  );
  const redisHit = (result.redis?.pubsubEvents || []).some(
    (e) => e.parsed?.event === 'notification' || e.parsed?.data?.type === 'leave_requested',
  );
  const isoOk = result.isolation?.priyaHasLeaveRequestedAboutSelf === false;
  const createOk = result.mutation?.status === 200 || result.mutation?.status === 201;
  const overall =
    createOk && delta >= 1 && isoOk
      ? 'PASS'
      : createOk
        ? 'PARTIAL PASS'
        : 'FAIL';
  result.verdict = overall;
  lines.push(`**${overall}** — unread Δ(aman)=**${delta}** · SSE notification=${sseHit} · Redis PUBLISH observed=${redisHit} · isolation OK=${isoOk}`);
  lines.push('');
  lines.push('## Actors');
  lines.push('');
  lines.push(`| Role | Email | userId | employeeId |`);
  lines.push(`|------|-------|--------|------------|`);
  lines.push(
    `| EMPLOYEE | priya@acme.test | \`${result.actors?.priya?.userId || ''}\` | \`${result.actors?.priya?.employeeId || ''}\` |`,
  );
  lines.push(
    `| MANAGER | aman@acme.test | \`${result.actors?.aman?.userId || ''}\` | \`${result.actors?.aman?.employeeId || ''}\` |`,
  );
  lines.push('');
  lines.push('## Before / After');
  lines.push('');
  lines.push('| Who | unread before | unread after | list top types after |');
  lines.push('|-----|---------------|--------------|----------------------|');
  lines.push(
    `| aman | ${result.before?.aman?.unread} | ${result.after?.aman?.unread} | ${(result.after?.aman?.topTypes || []).join(', ')} |`,
  );
  lines.push(
    `| priya | ${result.before?.priya?.unread} | ${result.after?.priya?.unread} | ${(result.after?.priya?.topTypes || []).join(', ')} |`,
  );
  lines.push('');
  lines.push('### Aman new leave_requested items');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(result.after?.aman?.newLeaveRequested || [], null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## Mutation');
  lines.push('');
  lines.push(`- leaveType: **SL** (Sick Leave) — avoid AL`);
  lines.push(`- dates: \`${result.mutation?.startDate}\` → \`${result.mutation?.endDate}\``);
  lines.push(`- HTTP: **${result.mutation?.status}**`);
  lines.push(`- leaveRequestId: \`${result.mutation?.leaveRequestId || ''}\``);
  lines.push(`- referenceNo: \`${result.mutation?.referenceNo || ''}\``);
  lines.push(`- Hostinger impact: 1 LeaveRequest row + N Notification rows (manager + HR_ADMIN + SUPER_ADMIN); withdraw releases leave hold but **does not delete** prior Notification rows`);
  lines.push('');
  lines.push('## SSE (aman)');
  lines.push('');
  lines.push(`- stream open: ${result.sse?.opened}`);
  lines.push(`- events captured: ${(result.sse?.amanEvents || []).length}`);
  lines.push(`- notification event seen: ${sseHit}`);
  lines.push('');
  lines.push('```json');
  lines.push(
    JSON.stringify(
      (result.sse?.amanEvents || [])
        .filter((e) => e.event === 'notification' || e.event === 'connected' || e.error)
        .slice(0, 8),
      null,
      2,
    ),
  );
  lines.push('```');
  lines.push('');
  lines.push('## Redis involvement');
  lines.push('');
  lines.push('- Storage/cache for Notification rows: **none** (Prisma only)');
  lines.push('- SSE cross-instance fan-out channel: **`ems:sse`** (`src/utils/sseClients.js`)');
  lines.push(`- PING: \`${result.redis?.before?.ping}\``);
  lines.push(`- PUBSUB CHANNELS: \`${JSON.stringify(result.redis?.before?.channels)}\``);
  lines.push(`- PUBSUB NUMSUB ems:sse (before leave): \`${JSON.stringify(result.redis?.before?.numsub)}\``);
  lines.push(`- PUBSUB NUMSUB ems:sse (during subscribe): \`${JSON.stringify(result.redis?.duringNumsub)}\``);
  lines.push(`- Observed PUBLISH payloads during create: **${(result.redis?.pubsubEvents || []).length}**`);
  lines.push(`- cache:* sample (unrelated to notif storage): ${(result.redis?.before?.cacheSample || []).slice(0, 8).join(', ') || '(none scanned)'}`);
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify((result.redis?.pubsubEvents || []).slice(0, 6), null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## Isolation (negative)');
  lines.push('');
  lines.push(`- priya unread Δ: ${(result.after?.priya?.unread ?? 0) - (result.before?.priya?.unread ?? 0)}`);
  lines.push(`- priya list contains leave_requested targeting her as recipient: **${result.isolation?.priyaHasLeaveRequestedAboutSelf}** (expect false)`);
  lines.push(`- aman list contains leave_requested for this leaveRequestId: **${result.isolation?.amanHasNewLeaveRequested}** (expect true)`);
  lines.push(`- Evidence: priya top after = ${(result.after?.priya?.topTypes || []).join(', ') || '(empty)'}`);
  lines.push('');
  lines.push('## Cleanup (withdraw)');
  lines.push('');
  lines.push(`- withdraw HTTP: **${result.withdraw?.status}**`);
  lines.push(`- leave status after: \`${result.withdraw?.statusField || ''}\``);
  lines.push(`- aman unread after withdraw: ${result.withdraw?.amanUnread}`);
  lines.push(`- note: withdraw emits \`leave_withdrawn\` (additional rows); does not delete \`leave_requested\``);
  lines.push('');
  lines.push('## Screenshots');
  lines.push('');
  for (const s of screenshots) lines.push(`- \`${s.file}\` — ${s.name}`);
  lines.push('');
  lines.push('## Issues');
  lines.push('');
  if (!findings.length) lines.push('_None raised beyond expected withdraw leftover notifications._');
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    lines.push(`### ISSUE-NOTIF-E2E-${String(i + 1).padStart(2, '0')}`);
    lines.push(`- **${f.severity}** / ${f.layer} — ${f.where}`);
    lines.push(`- ${f.why}`);
    lines.push('');
  }
  lines.push('## Artifacts');
  lines.push('');
  lines.push('- `docs/e2e-ui-screenshots/stress/notif-e2e-create/`');
  lines.push('- `results.json`, `sse-aman.log`, `redis-pubsub.log`');
  lines.push('- Contracts: `## NOTIF-E2E-CREATE` in stress BE/FE contracts');
  lines.push('');
  fs.writeFileSync(path.join(SHOT, 'FINDINGS.md'), lines.join('\n'));
}

function appendContracts() {
  const bePath = '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/E2E_STRESS_BACKEND_CONTRACT.md';
  const fePath = '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/E2E_STRESS_FRONTEND_CONTRACT.md';
  const delta = (result.after?.aman?.unread ?? 0) - (result.before?.aman?.unread ?? 0);
  const sseHit = (result.sse?.amanEvents || []).some((e) => e.event === 'notification');
  const redisHit = (result.redis?.pubsubEvents || []).length > 0;
  const isoOk = result.isolation?.priyaHasLeaveRequestedAboutSelf === false;

  const be = [
    '',
    '## NOTIF-E2E-CREATE',
    '',
    `> Deep create-path E2E · ${result.ts} · BE \`${BE}\` · Redis \`${REDIS_URL}\``,
    `> Evidence: \`docs/e2e-ui-screenshots/stress/notif-e2e-create/FINDINGS.md\``,
    '',
    '### Mutation',
    `- priya → POST /leave/requests **SL** \`${result.mutation?.startDate}\` (1 day)`,
    `- HTTP **${result.mutation?.status}** · leaveRequestId=\`${result.mutation?.leaveRequestId || ''}\` · ref=\`${result.mutation?.referenceNo || ''}\``,
    `- Hostinger: +LeaveRequest +N Notification (manager/HR/SA); withdraw cleanup applied`,
    '',
    '### Delivery',
    `- aman unread ${result.before?.aman?.unread} → ${result.after?.aman?.unread} (Δ=${delta})`,
    `- SSE aman notification event: **${sseHit}**`,
    `- Redis channel \`ems:sse\` PUBLISH observed: **${redisHit}** (NUMSUB before=${JSON.stringify(result.redis?.before?.numsub)})`,
    `- Notification storage keys: **none** (Prisma); fan-out only`,
    '',
    '### Isolation',
    `- priya does not receive leave_requested for own submit: **${isoOk}**`,
    `- priya unread ${result.before?.priya?.unread} → ${result.after?.priya?.unread}`,
    '',
    '### Cleanup',
    `- PATCH withdraw → HTTP **${result.withdraw?.status}** · aman unread after=${result.withdraw?.amanUnread}`,
    `- withdraw adds leave_withdrawn; does not delete leave_requested rows`,
    '',
    `### Verdict`,
    `**${result.verdict}**`,
    '',
  ].join('\n');

  const fe = [
    '',
    '## NOTIF-E2E-CREATE',
    '',
    `> UI watch for create-path delivery · ${result.ts} · FE \`${FE}\``,
    `> Screenshots: \`docs/e2e-ui-screenshots/stress/notif-e2e-create/\` (${screenshots.length} PNGs)`,
    '',
    '### UI checks',
    `- aman bell/drawer after priya SL submit (expect New Leave Request)`,
    `- priya bell after own submit (expect no leave_requested self-target)`,
    '',
    `### Verdict`,
    `**${result.verdict}** — see FINDINGS.md`,
    '',
  ].join('\n');

  const appendOrReplace = (filePath, block) => {
    let cur = fs.readFileSync(filePath, 'utf8');
    const re = /\n## NOTIF-E2E-CREATE\n[\s\S]*?(?=\n## [A-Z]|$)/;
    if (re.test(cur)) cur = cur.replace(re, block);
    else cur = cur.replace(/\s*$/, '') + block;
    fs.writeFileSync(filePath, cur.endsWith('\n') ? cur : cur + '\n');
  };
  appendOrReplace(bePath, be);
  appendOrReplace(fePath, fe);
  step(`Appended ## NOTIF-E2E-CREATE → contracts`);
}

async function main() {
  step('=== NOTIF-E2E-CREATE START ===');

  const priyaLogin = await loginApi('priya@acme.test');
  const amanLogin = await loginApi('aman@acme.test');
  if (!priyaLogin.token || !amanLogin.token) {
    note('CRITICAL', 'BACKEND', 'login', 'Failed login for priya/aman', {
      priya: priyaLogin.status,
      aman: amanLogin.status,
    });
    persist();
    writeFindingsMd();
    process.exit(1);
  }
  result.actors = {
    priya: {
      userId: priyaLogin.user?.id || priyaLogin.user?.userId,
      employeeId: priyaLogin.user?.employeeId || priyaLogin.user?.employee?.id,
    },
    aman: {
      userId: amanLogin.user?.id || amanLogin.user?.userId,
      employeeId: amanLogin.user?.employeeId || amanLogin.user?.employee?.id,
    },
  };
  step(`Actors priya=${result.actors.priya.userId} aman=${result.actors.aman.userId}`);

  // Redis before
  result.redis.before = await redisObserveBefore();
  step(`Redis ping=${result.redis.before.ping} channels=${JSON.stringify(result.redis.before.channels)} numsub=${JSON.stringify(result.redis.before.numsub)}`);

  // Before unread + list
  const amanUnread0 = await apiGet(amanLogin.token, '/notifications/unread-count');
  const priyaUnread0 = await apiGet(priyaLogin.token, '/notifications/unread-count');
  const amanList0 = await apiGet(amanLogin.token, '/notifications?limit=20');
  const priyaList0 = await apiGet(priyaLogin.token, '/notifications?limit=20');
  result.before = {
    aman: {
      unread: unreadFrom(amanUnread0.json),
      status: amanUnread0.status,
      listCount: listFrom(amanList0.json).length,
      top: summarizeNotifs(listFrom(amanList0.json)),
      ids: listFrom(amanList0.json).map((x) => x.id),
    },
    priya: {
      unread: unreadFrom(priyaUnread0.json),
      status: priyaUnread0.status,
      listCount: listFrom(priyaList0.json).length,
      top: summarizeNotifs(listFrom(priyaList0.json)),
      ids: listFrom(priyaList0.json).map((x) => x.id),
    },
  };
  step(`BEFORE unread aman=${result.before.aman.unread} priya=${result.before.priya.unread}`);

  // Start Redis SUBSCRIBE + aman SSE
  const redisLog = path.join(SHOT, 'redis-pubsub.log');
  const sseLog = path.join(SHOT, 'sse-aman.log');
  fs.writeFileSync(redisLog, '');
  fs.writeFileSync(sseLog, '');
  const redisSub = startRedisSubscriber(redisLog);
  const sse = openSse(amanLogin.token, sseLog);
  await sse.ready();
  await new Promise((r) => setTimeout(r, 500));
  {
    const client = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    client.on('error', () => {});
    try {
      await client.connect();
      result.redis.duringNumsub = await client.pubsub('NUMSUB', 'ems:sse');
    } catch (e) {
      result.redis.duringNumsubError = e.message;
    } finally {
      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    }
  }
  step(`SSE open; Redis NUMSUB during=${JSON.stringify(result.redis.duringNumsub)}`);

  // Mutation — SL 1 day far future
  const { startDate, endDate } = pickLeaveDate();
  step(`POST leave SL ${startDate}`);
  const create = await apiPost(priyaLogin.token, '/leave/requests', {
    leaveTypeId: 'SL',
    startDate,
    endDate,
    reason: 'NOTIF-E2E-CREATE probe — sick leave (auto withdraw)',
  });
  const leave =
    create.json?.data?.request || create.json?.data?.leaveRequest || create.json?.data || {};
  result.mutation = {
    status: create.status,
    startDate,
    endDate,
    leaveTypeId: 'SL',
    leaveRequestId: leave.id,
    referenceNo: leave.referenceNo,
    leaveStatus: leave.status,
    bodySnippet: JSON.stringify(create.json).slice(0, 500),
  };
  step(`CREATE status=${create.status} id=${leave.id || 'n/a'} ref=${leave.referenceNo || 'n/a'}`);
  if (create.status >= 400) {
    note('CRITICAL', 'BACKEND', 'POST /leave/requests', `Leave create failed HTTP ${create.status}`, {
      body: create.json,
    });
  }

  // Wait for notify + SSE/redis
  await new Promise((r) => setTimeout(r, 2500));

  // After
  const amanUnread1 = await apiGet(amanLogin.token, '/notifications/unread-count');
  const priyaUnread1 = await apiGet(priyaLogin.token, '/notifications/unread-count');
  const amanList1 = await apiGet(amanLogin.token, '/notifications?limit=30');
  const priyaList1 = await apiGet(priyaLogin.token, '/notifications?limit=30');
  const amanItems = listFrom(amanList1.json);
  const priyaItems = listFrom(priyaList1.json);
  const beforeIds = new Set(result.before.aman.ids);
  const newAman = amanItems.filter((x) => !beforeIds.has(x.id));
  const newLeaveRequested = newAman.filter(
    (x) =>
      x.type === 'leave_requested' ||
      /leave request/i.test(x.title || '') ||
      (leave.id && JSON.stringify(x).includes(leave.id)),
  );

  result.after = {
    aman: {
      unread: unreadFrom(amanUnread1.json),
      listCount: amanItems.length,
      top: summarizeNotifs(amanItems),
      topTypes: amanItems.slice(0, 8).map((x) => x.type),
      newItems: summarizeNotifs(newAman, 10),
      newLeaveRequested: summarizeNotifs(newLeaveRequested, 10),
    },
    priya: {
      unread: unreadFrom(priyaUnread1.json),
      listCount: priyaItems.length,
      top: summarizeNotifs(priyaItems),
      topTypes: priyaItems.slice(0, 8).map((x) => x.type),
    },
  };

  result.sse = {
    opened: true,
    amanEvents: sse.events.slice(),
  };
  result.redis.pubsubEvents = redisSub.events.slice();

  const amanHas = newLeaveRequested.length > 0 || (leave.id && amanItems.some((x) => JSON.stringify(x).includes(leave.id)));
  const priyaHasLr = priyaItems.some(
    (x) =>
      x.type === 'leave_requested' &&
      (!leave.id || JSON.stringify(x.metadata || x.metadataJson || x).includes(leave.id) || /Priya/i.test(x.body || x.message || '')),
  );
  // Stronger: any new leave_requested on priya after mutation
  const priyaBeforeIds = new Set(result.before.priya.ids);
  const priyaNewLr = priyaItems.filter((x) => !priyaBeforeIds.has(x.id) && x.type === 'leave_requested');
  result.isolation = {
    amanHasNewLeaveRequested: amanHas,
    priyaHasLeaveRequestedAboutSelf: priyaNewLr.length > 0,
    priyaNewLeaveRequestedCount: priyaNewLr.length,
    priyaUnreadDelta: result.after.priya.unread - result.before.priya.unread,
    amanUnreadDelta: result.after.aman.unread - result.before.aman.unread,
  };
  step(
    `AFTER unread aman=${result.after.aman.unread}(Δ${result.isolation.amanUnreadDelta}) priya=${result.after.priya.unread}(Δ${result.isolation.priyaUnreadDelta}) sseEvents=${sse.events.length} redisPub=${redisSub.events.length}`,
  );

  if (result.isolation.amanUnreadDelta < 1 && create.status < 400) {
    note('HIGH', 'BACKEND', 'notifyLeaveRequested', 'aman unread-count did not increase after leave create', {
      before: result.before.aman.unread,
      after: result.after.aman.unread,
    });
  }
  if (!amanHas && create.status < 400) {
    note('HIGH', 'BACKEND', 'GET /notifications', 'aman list missing leave_requested for new leave', {
      leaveRequestId: leave.id,
    });
  }
  if (priyaNewLr.length > 0) {
    note('CRITICAL', 'BACKEND', 'isolation', 'priya received leave_requested for own submit', {
      items: summarizeNotifs(priyaNewLr),
    });
  }

  // UI screenshots — aman then priya
  const browser = await chromium.launch({ headless: true });
  try {
    const amanCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const amanPage = await amanCtx.newPage();
    await loginUi(amanPage, 'aman@acme.test');
    await shot(amanPage, 'aman-dashboard-after-leave');
    const amanBell = await openBell(amanPage);
    await shot(amanPage, amanBell ? 'aman-bell-drawer-after-leave' : 'aman-bell-missing');
    await amanCtx.close();

    const priyaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const priyaPage = await priyaCtx.newPage();
    await loginUi(priyaPage, 'priya@acme.test');
    await shot(priyaPage, 'priya-dashboard-after-own-leave');
    const priyaBell = await openBell(priyaPage);
    await shot(priyaPage, priyaBell ? 'priya-bell-drawer-after-own-leave' : 'priya-bell-missing');
    await priyaCtx.close();
  } catch (e) {
    note('MEDIUM', 'FRONTEND', 'playwright', e.message);
  } finally {
    await browser.close().catch(() => {});
  }

  // Cleanup withdraw — re-login so access token is fresh after UI work
  if (leave.id) {
    step(`WITHDRAW ${leave.id}`);
    const freshPriya = await loginApi('priya@acme.test');
    const freshAman = await loginApi('aman@acme.test');
    const wd = await apiPatch(freshPriya.token || priyaLogin.token, `/leave/requests/${leave.id}/withdraw`, {});
    const amanUnread2 = await apiGet(freshAman.token || amanLogin.token, '/notifications/unread-count');
    result.withdraw = {
      status: wd.status,
      statusField: wd.json?.data?.status || wd.json?.data?.request?.status || wd.json?.data?.leaveRequest?.status,
      bodySnippet: JSON.stringify(wd.json).slice(0, 400),
      amanUnread: unreadFrom(amanUnread2.json),
      reLogin: Boolean(freshPriya.token),
    };
    step(`WITHDRAW status=${wd.status} leaveStatus=${result.withdraw.statusField} amanUnread=${result.withdraw.amanUnread}`);
    if (wd.status >= 400) {
      note('HIGH', 'BACKEND', 'withdraw', `Withdraw failed HTTP ${wd.status}`, { body: wd.json });
    }
    await new Promise((r) => setTimeout(r, 1000));
    result.sse.amanEvents = sse.events.slice();
    result.redis.pubsubEvents = redisSub.events.slice();
  } else {
    result.withdraw = { status: null, skipped: true };
  }

  await sse.stop();
  redisSub.stop();

  writeFindingsMd();
  appendContracts();
  persist();
  step(`=== NOTIF-E2E-CREATE DONE verdict=${result.verdict} shots=${shotIdx} ===`);
  console.log(`FINDINGS → ${path.join(SHOT, 'FINDINGS.md')}`);
}

main().catch((e) => {
  console.error(e);
  note('CRITICAL', 'SCRIPT', 'main', e.message);
  writeFindingsMd();
  persist();
  process.exit(1);
});
