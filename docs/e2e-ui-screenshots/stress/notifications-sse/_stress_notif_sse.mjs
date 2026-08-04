#!/usr/bin/env node
/**
 * DEEP STRESS — Notifications SSE + Redis fan-out
 * Target: http://localhost:4000 · Redis: redis://127.0.0.1:16379
 * No commits. Maximize defect finding.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import { SignJWT } from 'jose';
import IORedis from 'ioredis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = process.env.API_BASE || 'http://localhost:4000';
const API = `${BASE}/api/v1`;
const TENANT = 'acme-corp-001';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:16379';
const PASS = 'Password123!';

const results = {
  startedAt: new Date().toISOString(),
  target: BASE,
  redisUrl: REDIS_URL,
  sections: {},
  defects: [],
  notes: [],
};

function defect(id, severity, title, evidence) {
  results.defects.push({ id, severity, title, evidence });
}

function note(msg) {
  results.notes.push(msg);
  console.log('NOTE:', msg);
}

function writeCapture(name, body) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body, null, 2));
  return path.relative(process.cwd(), p);
}

async function login(email) {
  const t0 = Date.now();
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-key': TENANT },
    body: JSON.stringify({ email, password: PASS }),
  });
  const j = await r.json();
  return {
    email,
    status: r.status,
    ms: Date.now() - t0,
    token: j.data?.accessToken || null,
    user: j.data?.user || null,
    raw: j,
  };
}

/** Minimal SSE client over raw http (keeps sockets under our control). */
function openSse(label, token, { timeoutMs = 120000 } = {}) {
  const url = new URL(`${API}/notifications/stream`);
  if (token != null) url.searchParams.set('token', token);

  const state = {
    label,
    url: url.toString().replace(/token=[^&]+/, 'token=<redacted>'),
    connectedAt: null,
    statusCode: null,
    headers: {},
    events: [],
    comments: [],
    chunks: 0,
    bytes: 0,
    errors: [],
    closed: false,
    closeReason: null,
    hung: false,
  };

  let resolveReady;
  const ready = new Promise((res) => { resolveReady = res; });

  const req = http.request(
    {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
    },
    (res) => {
      state.statusCode = res.statusCode;
      state.headers = { ...res.headers };
      state.connectedAt = new Date().toISOString();
      if (res.statusCode === 200) resolveReady({ ok: true, state });

      let buf = '';
      res.on('data', (chunk) => {
        state.chunks += 1;
        state.bytes += chunk.length;
        buf += chunk.toString('utf8');
        // Parse SSE frames loosely
        const parts = buf.split('\n\n');
        buf = parts.pop() || '';
        for (const frame of parts) {
          const lines = frame.split('\n');
          let event = 'message';
          const dataLines = [];
          for (const line of lines) {
            if (line.startsWith(':')) {
              state.comments.push(line.slice(1).trim());
            } else if (line.startsWith('event:')) {
              event = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim());
            }
          }
          if (dataLines.length) {
            const raw = dataLines.join('\n');
            let data = raw;
            try { data = JSON.parse(raw); } catch { /* keep string */ }
            state.events.push({
              at: new Date().toISOString(),
              event,
              data,
            });
          }
        }
      });
      res.on('end', () => {
        state.closed = true;
        state.closeReason = state.closeReason || 'remote-end';
        if (state.statusCode !== 200) resolveReady({ ok: false, state });
      });
      res.on('error', (err) => {
        state.errors.push(String(err));
        state.closed = true;
        state.closeReason = 'res-error';
        resolveReady({ ok: false, state });
      });
    },
  );

  req.setTimeout(timeoutMs, () => {
    state.hung = true;
    state.closeReason = 'timeout';
    try { req.destroy(new Error('timeout')); } catch { /* */ }
    resolveReady({ ok: false, state });
  });
  req.on('error', (err) => {
    state.errors.push(String(err));
    state.closed = true;
    state.closeReason = 'req-error';
    resolveReady({ ok: false, state });
  });
  req.end();

  return {
    state,
    ready,
    kill: (reason = 'client-kill') => {
      state.closeReason = reason;
      state.closed = true;
      try { req.destroy(); } catch { /* */ }
    },
  };
}

function waitForEvent(state, predicate, timeoutMs = 15000) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const hit = state.events.find(predicate);
      if (hit) return resolve({ hit, waitedMs: Date.now() - t0 });
      if (Date.now() - t0 > timeoutMs) return resolve({ hit: null, waitedMs: Date.now() - t0 });
      setTimeout(tick, 50);
    };
    tick();
  });
}

async function api(method, pathName, token, body) {
  const t0 = Date.now();
  const r = await fetch(`${API}${pathName}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: r.status, ms: Date.now() - t0, json, text: text.slice(0, 800) };
}

async function opsProcess(saToken) {
  const r = await fetch(`${BASE}/ops/process`, {
    headers: { Authorization: `Bearer ${saToken}`, 'x-tenant-key': TENANT },
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: r.status, json, text: text.slice(0, 2000) };
}

function redisCliPing() {
  const r = spawnSync('redis-cli', ['-u', REDIS_URL, 'PING'], { encoding: 'utf8' });
  return { ok: r.status === 0 && /PONG/i.test(r.stdout), stdout: r.stdout.trim(), stderr: r.stderr.trim(), code: r.status };
}

async function ioredisPing() {
  const client = new IORedis(REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000, lazyConnect: true });
  try {
    await client.connect();
    const pong = await client.ping();
    const channels = await client.pubsub('CHANNELS', 'ems:*');
    const numsub = await client.pubsub('NUMSUB', 'ems:sse');
    await client.quit();
    return { ok: pong === 'PONG', pong, channels, numsub };
  } catch (err) {
    try { await client.quit(); } catch { /* */ }
    return { ok: false, error: String(err) };
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log('=== NOTIF-SSE-REDIS STRESS ===');

  // ── 1) Redis PING ──────────────────────────────────────────────
  const cliPing = redisCliPing();
  const ioPing = await ioredisPing();
  results.sections.redis = { cliPing, ioPing };
  writeCapture('01-redis-ping.json', { cliPing, ioPing });
  console.log('Redis cli:', cliPing);
  console.log('Redis ioredis:', ioPing);
  if (!cliPing.ok || !ioPing.ok) {
    defect('ISSUE-SSE-01', 'CRITICAL', 'Redis PING failed — fan-out cannot work', { cliPing, ioPing });
  }
  if (!ioPing.channels?.includes('ems:sse')) {
    defect('ISSUE-SSE-02', 'HIGH', 'Redis channel ems:sse not present before test (subscriber may be down)', ioPing);
  }

  // ── Log scan for fan-out enabled ───────────────────────────────
  const termLog = '/Users/mohdsaeedafri/.cursor/projects/Users-mohdsaeedafri-All-Code-Base-EMS/terminals/281130.txt';
  let fanoutLogLine = null;
  try {
    const logText = fs.readFileSync(termLog, 'utf8');
    const m = logText.match(/.*\[sse\] cross-instance fan-out enabled.*/);
    fanoutLogLine = m ? m[0] : null;
  } catch (e) {
    fanoutLogLine = `log-read-error: ${e.message}`;
  }
  results.sections.fanoutBootLog = { found: Boolean(fanoutLogLine && fanoutLogLine.includes('fan-out enabled')), line: fanoutLogLine };
  writeCapture('05-fanout-boot-log.txt', String(fanoutLogLine || 'NOT FOUND'));
  if (!results.sections.fanoutBootLog.found) {
    defect('ISSUE-SSE-03', 'HIGH', 'Server boot log missing "[sse] cross-instance fan-out enabled"', { fanoutLogLine });
  } else {
    note('Boot log confirms SSE fan-out enabled');
  }

  // ── Login ──────────────────────────────────────────────────────
  const priya = await login('priya@acme.test');
  const aman = await login('aman@acme.test');
  const sa = await login('superadmin@acme.test');
  const hr = await login('hr@acme.test');
  results.sections.login = {
    priya: { status: priya.status, userId: priya.user?.id, ms: priya.ms },
    aman: { status: aman.status, userId: aman.user?.id, ms: aman.ms },
    sa: { status: sa.status, userId: sa.user?.id, ms: sa.ms },
    hr: { status: hr.status, userId: hr.user?.id, ms: hr.ms },
  };
  for (const u of [priya, aman, sa, hr]) {
    if (!u.token) defect('ISSUE-SSE-04', 'CRITICAL', `Login failed for ${u.email}`, { status: u.status, raw: u.raw });
  }

  // Ops SSE diagnostics (baseline)
  const opsBefore = await opsProcess(sa.token);
  results.sections.opsBefore = { status: opsBefore.status, sse: opsBefore.json?.data?.sse || opsBefore.json?.sse || null, snippet: opsBefore.text.slice(0, 500) };
  writeCapture('02-ops-sse-before.json', opsBefore);

  // Independent Redis subscriber to prove pub/sub payloads
  const redisTap = { messages: [], errors: [] };
  const tap = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  tap.on('error', (e) => redisTap.errors.push(e.message));
  await tap.subscribe('ems:sse');
  tap.on('message', (ch, payload) => {
    if (ch !== 'ems:sse') return;
    let parsed = payload;
    try { parsed = JSON.parse(payload); } catch { /* */ }
    redisTap.messages.push({ at: new Date().toISOString(), parsed });
  });

  // ── 2) Concurrent SSE connections ──────────────────────────────
  console.log('Opening concurrent SSE streams…');
  const ssePriyaA = openSse('priya-A', priya.token);
  const ssePriyaB = openSse('priya-B', priya.token); // 2nd tab same user
  const sseAman = openSse('aman', aman.token);
  const sseSa = openSse('sa', sa.token);
  const sseHr = openSse('hr', hr.token);

  const opened = await Promise.all([
    ssePriyaA.ready, ssePriyaB.ready, sseAman.ready, sseSa.ready, sseHr.ready,
  ]);
  results.sections.concurrentOpen = opened.map((o) => ({
    label: o.state.label,
    status: o.state.statusCode,
    contentType: o.state.headers['content-type'],
    comments: o.state.comments.slice(0, 3),
    ok: o.ok,
    errors: o.state.errors,
  }));
  writeCapture('03-sse-open.json', results.sections.concurrentOpen);
  for (const o of opened) {
    console.log('SSE open', o.state.label, o.state.statusCode, o.state.comments[0] || '', o.state.errors.join(','));
    if (o.state.statusCode !== 200) {
      defect('ISSUE-SSE-05', 'HIGH', `SSE open failed for ${o.state.label}`, o.state);
    } else if (!o.state.comments.some((c) => /connected/i.test(c))) {
      defect('ISSUE-SSE-06', 'MEDIUM', `SSE ${o.state.label} missing ": connected" comment`, { comments: o.state.comments });
    }
  }

  // Wait briefly for registry
  await new Promise((r) => setTimeout(r, 400));
  const opsDuring = await opsProcess(sa.token);
  const sseDiagDuring = opsDuring.json?.data?.sse || opsDuring.json?.sse || null;
  results.sections.opsDuring = { status: opsDuring.status, sse: sseDiagDuring };
  writeCapture('02b-ops-sse-during.json', opsDuring);
  if (sseDiagDuring) {
    note(`SSE diag during: connections=${sseDiagDuring.connectionCount} users=${sseDiagDuring.uniqueUsers} fanout=${sseDiagDuring.fanoutEnabled}`);
    if (sseDiagDuring.fanoutEnabled !== true) {
      defect('ISSUE-SSE-07', 'CRITICAL', 'getSseDiagnostics.fanoutEnabled !== true while REDIS_URL set', sseDiagDuring);
    }
    if ((sseDiagDuring.connectionCount || 0) < 5) {
      defect('ISSUE-SSE-08', 'HIGH', `Expected ≥5 live SSE connections, got ${sseDiagDuring.connectionCount}`, sseDiagDuring);
    }
  } else {
    defect('ISSUE-SSE-09', 'MEDIUM', 'Could not parse SSE diagnostics from /ops/process', { status: opsDuring.status, snippet: opsDuring.text.slice(0, 300) });
  }

  // ── 3) Trigger notification-creating events ────────────────────
  console.log('Triggering leave request (should fan-out to aman/hr/sa)…');
  // Future weekday-ish date far out to reduce collisions
  const start = '2026-12-14';
  const end = '2026-12-14';
  const leaveCreate = await api('POST', '/leave/requests', priya.token, {
    leaveTypeId: 'CL',
    startDate: start,
    endDate: end,
    reason: `SSE stress probe ${Date.now()}`,
  });
  results.sections.leaveCreate = {
    status: leaveCreate.status,
    ms: leaveCreate.ms,
    id: leaveCreate.json?.data?.id || leaveCreate.json?.data?.request?.id,
    snippet: leaveCreate.text.slice(0, 500),
  };
  writeCapture('04-leave-create.json', leaveCreate);
  console.log('leave create', leaveCreate.status, leaveCreate.text.slice(0, 200));

  // Wait for SSE delivery + redis tap
  const expectManagerNotif = await waitForEvent(
    sseAman.state,
    (e) => e.event === 'notification' && (e.data?.type === 'leave_requested' || /leave/i.test(e.data?.title || '')),
    20000,
  );
  const expectHrNotif = await waitForEvent(
    sseHr.state,
    (e) => e.event === 'notification' && (e.data?.type === 'leave_requested' || /leave/i.test(e.data?.title || '')),
    20000,
  );
  const expectSaNotif = await waitForEvent(
    sseSa.state,
    (e) => e.event === 'notification' || e.event === 'analytics_update',
    20000,
  );
  // Priya should NOT get leave_requested (she's the requester)
  await new Promise((r) => setTimeout(r, 1500));
  const priyaGotLeaveRequested = ssePriyaA.state.events.some(
    (e) => e.event === 'notification' && e.data?.type === 'leave_requested',
  );

  // Redis tap should have seen publishes
  await new Promise((r) => setTimeout(r, 500));
  results.sections.eventDelivery = {
    leaveCreateStatus: leaveCreate.status,
    aman: { waitedMs: expectManagerNotif.waitedMs, hit: expectManagerNotif.hit },
    hr: { waitedMs: expectHrNotif.waitedMs, hit: expectHrNotif.hit },
    sa: { waitedMs: expectSaNotif.waitedMs, hit: expectSaNotif.hit },
    priyaGotLeaveRequested,
    priyaAEvents: ssePriyaA.state.events,
    priyaBEvents: ssePriyaB.state.events,
    amanEvents: sseAman.state.events,
    hrEvents: sseHr.state.events,
    saEvents: sseSa.state.events,
    redisTapCount: redisTap.messages.length,
    redisTapSample: redisTap.messages.slice(0, 8),
  };
  writeCapture('04b-event-delivery.json', results.sections.eventDelivery);

  if (leaveCreate.status >= 200 && leaveCreate.status < 300) {
    if (!expectManagerNotif.hit) {
      defect('ISSUE-SSE-10', 'CRITICAL', 'Manager SSE did not receive leave_requested after create', {
        waitedMs: expectManagerNotif.waitedMs,
        amanEvents: sseAman.state.events,
        redisTap: redisTap.messages.slice(0, 5),
      });
    }
    if (!expectHrNotif.hit) {
      defect('ISSUE-SSE-11', 'HIGH', 'HR SSE did not receive leave_requested after create', {
        waitedMs: expectHrNotif.waitedMs,
        hrEvents: sseHr.state.events,
      });
    }
    if (!expectSaNotif.hit) {
      defect('ISSUE-SSE-12', 'HIGH', 'SUPER_ADMIN SSE got neither notification nor analytics_update', {
        waitedMs: expectSaNotif.waitedMs,
        saEvents: sseSa.state.events,
      });
    }
    if (priyaGotLeaveRequested) {
      defect('ISSUE-SSE-13', 'MEDIUM', 'Requester received leave_requested (unexpected fan-out target)', {
        priyaEvents: ssePriyaA.state.events,
      });
    }
    if (redisTap.messages.length === 0) {
      defect('ISSUE-SSE-14', 'CRITICAL', 'Redis pub/sub tap received 0 messages on ems:sse despite leave create', {
        fanout: sseDiagDuring,
      });
    } else {
      note(`Redis tap saw ${redisTap.messages.length} pub/sub message(s) — cross-instance path exercised`);
    }
    // Dual-tab same user: both priya sockets should get events if any are targeted to her later
  } else {
    defect('ISSUE-SSE-15', 'HIGH', 'Leave create failed — could not exercise notification SSE path via leave', leaveCreate);
  }

  // Approve/deny path — if we have a leave id, approve as aman (targets priya)
  const leaveId = results.sections.leaveCreate.id;
  let leaveDecision = null;
  if (leaveId) {
    console.log('Approving leave as aman…', leaveId);
    leaveDecision = await api('PATCH', `/leave/requests/${leaveId}/approve`, aman.token, {
      comment: 'SSE stress approve',
    });
    // some APIs use /approve without body or manager decision route
    if (leaveDecision.status >= 400) {
      const alt = await api('PATCH', `/manager/leave-requests/${leaveId}/decision`, aman.token, {
        decision: 'APPROVED',
        comment: 'SSE stress approve',
      });
      leaveDecision = { ...alt, via: 'manager-decision' };
    } else {
      leaveDecision.via = 'leave-approve';
    }
    results.sections.leaveDecision = {
      status: leaveDecision.status,
      via: leaveDecision.via,
      snippet: leaveDecision.text.slice(0, 500),
    };
    writeCapture('04c-leave-decision.json', leaveDecision);

    const priyaApproved = await waitForEvent(
      ssePriyaA.state,
      (e) => e.event === 'notification' && (e.data?.type === 'leave_approved' || /approved/i.test(e.data?.title || '')),
      20000,
    );
    const priyaBApproved = await waitForEvent(
      ssePriyaB.state,
      (e) => e.event === 'notification' && (e.data?.type === 'leave_approved' || /approved/i.test(e.data?.title || '')),
      5000,
    );
    results.sections.approveDelivery = {
      priyaA: priyaApproved,
      priyaB: priyaBApproved,
      redisTapAfter: redisTap.messages.length,
    };
    if (leaveDecision.status >= 200 && leaveDecision.status < 300) {
      if (!priyaApproved.hit) {
        defect('ISSUE-SSE-16', 'CRITICAL', 'Priya SSE A missed leave_approved after manager approve', priyaApproved);
      }
      if (!priyaBApproved.hit) {
        defect('ISSUE-SSE-17', 'HIGH', 'Second concurrent Priya SSE (tab B) missed leave_approved — multi-tab fan-out broken', priyaBApproved);
      } else {
        note('Multi-tab same-user delivery OK (priya A+B both got leave_approved)');
      }
    } else {
      defect('ISSUE-SSE-18', 'MEDIUM', 'Leave approve/decision failed', leaveDecision);
    }
  }

  // Mark-read path — does it emit SSE? (expected: NO → document as gap if product expects it)
  const notifList = await api('GET', '/notifications?limit=5', aman.token);
  const firstNotifId = notifList.json?.data?.notifications?.[0]?.id
    || notifList.json?.data?.[0]?.id
    || null;
  let markRead = null;
  let markReadSse = null;
  if (firstNotifId) {
    const beforeCount = sseAman.state.events.length;
    markRead = await api('PATCH', `/notifications/${firstNotifId}/read`, aman.token);
    await new Promise((r) => setTimeout(r, 1200));
    markReadSse = {
      status: markRead.status,
      newEvents: sseAman.state.events.slice(beforeCount),
      emitted: sseAman.state.events.slice(beforeCount).length > 0,
    };
    results.sections.markRead = markReadSse;
    writeCapture('04d-mark-read.json', { markRead, markReadSse });
    if (markRead.status === 200 && !markReadSse.emitted) {
      defect('ISSUE-SSE-19', 'LOW', 'Mark-read succeeds but emits no SSE event (clients must poll for read-state sync)', markReadSse);
    }
  } else {
    results.sections.markRead = { skipped: true, listStatus: notifList.status, snippet: notifList.text.slice(0, 300) };
  }

  // ── 4) Kill / reconnect + burst ×10 ────────────────────────────
  console.log('Kill/reconnect + burst ×10…');
  const opsMid = await opsProcess(sa.token);
  const sseMid = opsMid.json?.data?.sse || opsMid.json?.sse || null;

  // Kill all open streams
  for (const s of [ssePriyaA, ssePriyaB, sseAman, sseSa, sseHr]) s.kill('pre-burst-kill');
  await new Promise((r) => setTimeout(r, 800));

  const opsAfterKill = await opsProcess(sa.token);
  const sseAfterKill = opsAfterKill.json?.data?.sse || opsAfterKill.json?.sse || null;

  const burst = [];
  for (let i = 0; i < 10; i += 1) {
    const c = openSse(`burst-${i}`, priya.token, { timeoutMs: 15000 });
    const r = await c.ready;
    const openMs = r.state.connectedAt ? Date.now() : null;
    // hold ~150ms then kill
    await new Promise((x) => setTimeout(x, 150));
    c.kill('burst-kill');
    burst.push({
      i,
      status: r.state.statusCode,
      ok: r.ok,
      comments: r.state.comments.slice(0, 2),
      errors: r.state.errors,
      hung: r.state.hung,
      bytes: r.state.bytes,
    });
  }
  await new Promise((r) => setTimeout(r, 1000));

  const opsAfterBurst = await opsProcess(sa.token);
  const sseAfterBurst = opsAfterBurst.json?.data?.sse || opsAfterBurst.json?.sse || null;

  // Reopen durable streams after burst
  const rePriya = openSse('priya-reconnect', priya.token);
  const reAman = openSse('aman-reconnect', aman.token);
  const reOpen = await Promise.all([rePriya.ready, reAman.ready]);
  await new Promise((r) => setTimeout(r, 300));
  const opsAfterReconnect = await opsProcess(sa.token);
  const sseAfterReconnect = opsAfterReconnect.json?.data?.sse || opsAfterReconnect.json?.sse || null;

  results.sections.reconnectBurst = {
    sseMid,
    sseAfterKill,
    burst,
    burstFailCount: burst.filter((b) => !b.ok || b.status !== 200 || b.hung).length,
    burst401: burst.filter((b) => b.status === 401).length,
    burstHung: burst.filter((b) => b.hung).length,
    reOpen: reOpen.map((o) => ({ label: o.state.label, status: o.state.statusCode, ok: o.ok })),
    sseAfterBurst,
    sseAfterReconnect,
  };
  writeCapture('06-burst-reconnect.json', results.sections.reconnectBurst);

  if (results.sections.reconnectBurst.burstFailCount > 0) {
    defect('ISSUE-SSE-20', 'HIGH', `Burst reconnect had ${results.sections.reconnectBurst.burstFailCount}/10 failures`, results.sections.reconnectBurst);
  }
  if (sseAfterBurst && sseMid) {
    const leak = (sseAfterBurst.connectionCount || 0) - 2; // expect ~0 left after kills + before durable reopen accounting is messy
    // Better: after kill, before reopen, connectionCount should trend to 0
    if ((sseAfterKill?.connectionCount || 0) > 0) {
      // allow brief race; if still >2 after 800ms that's suspicious
      if (sseAfterKill.connectionCount > 2) {
        defect('ISSUE-SSE-21', 'HIGH', `Possible SSE client leak after kill: connectionCount=${sseAfterKill.connectionCount}`, {
          sseAfterKill,
          connects: sseAfterKill.connects,
          disconnects: sseAfterKill.disconnects,
        });
      }
    }
    if (sseAfterBurst.connects != null && sseAfterBurst.disconnects != null) {
      const delta = sseAfterBurst.connects - sseAfterBurst.disconnects;
      // live connections should approximate connects-disconnects
      if (Math.abs(delta - (sseAfterBurst.connectionCount || 0)) > 2) {
        defect('ISSUE-SSE-22', 'MEDIUM', 'SSE counters inconsistent: connects-disconnects != connectionCount', {
          connects: sseAfterBurst.connects,
          disconnects: sseAfterBurst.disconnects,
          connectionCount: sseAfterBurst.connectionCount,
          delta,
        });
      }
      note(`SSE counters after burst: connects=${sseAfterBurst.connects} disconnects=${sseAfterBurst.disconnects} live=${sseAfterBurst.connectionCount} published=${sseAfterBurst.published} receivedFromRedis=${sseAfterBurst.receivedFromRedis}`);
    }
  }

  // Post-reconnect delivery smoke: create another leave withdraw path or check-in?
  // Prefer a small leave create then withdraw to notify manager again
  console.log('Post-reconnect delivery smoke…');
  const leave2 = await api('POST', '/leave/requests', priya.token, {
    leaveTypeId: 'SL',
    startDate: '2026-12-15',
    endDate: '2026-12-15',
    reason: `SSE reconnect smoke ${Date.now()}`,
  });
  const amanAfter = await waitForEvent(
    reAman.state,
    (e) => e.event === 'notification',
    15000,
  );
  results.sections.postReconnectDelivery = {
    leave2Status: leave2.status,
    leave2Snippet: leave2.text.slice(0, 300),
    amanHit: amanAfter.hit,
    waitedMs: amanAfter.waitedMs,
  };
  if (leave2.status >= 200 && leave2.status < 300 && !amanAfter.hit) {
    defect('ISSUE-SSE-23', 'CRITICAL', 'After burst reconnect, manager SSE missed new notification', results.sections.postReconnectDelivery);
  }

  // Cleanup leave2 if created — withdraw
  const leave2Id = leave2.json?.data?.id || leave2.json?.data?.request?.id;
  if (leave2Id) {
    await api('PATCH', `/leave/requests/${leave2Id}/withdraw`, priya.token, {});
  }

  // ── 6) Auth edge cases ─────────────────────────────────────────
  console.log('Auth edge cases…');
  const noToken = openSse('no-token', null, { timeoutMs: 8000 });
  // force URL without token
  // openSse with null still sets token= — fix by custom call
  const noTokenResult = await new Promise((resolve) => {
    const url = new URL(`${API}/notifications/stream`);
    const state = { statusCode: null, body: '', headers: {}, hung: false, errors: [] };
    const req = http.request(
      { hostname: url.hostname, port: url.port || 80, path: url.pathname, method: 'GET', headers: { Accept: 'text/event-stream' } },
      (res) => {
        state.statusCode = res.statusCode;
        state.headers = { ...res.headers };
        res.on('data', (c) => { state.body += c.toString('utf8'); });
        res.on('end', () => resolve(state));
      },
    );
    req.setTimeout(8000, () => { state.hung = true; req.destroy(); resolve(state); });
    req.on('error', (e) => { state.errors.push(String(e)); resolve(state); });
    req.end();
  });

  const badToken = openSse('bad-token', 'not-a-jwt-at-all', { timeoutMs: 8000 });
  const badReady = await badToken.ready;
  // Drain body for bad token (non-SSE JSON)
  await new Promise((r) => setTimeout(r, 300));
  badToken.kill('done');

  // Expired token
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
  let expiredToken = 'eyJhbGciOiJIUzI1NiJ9.e30.bad';
  let expiredMeta = { created: false };
  try {
    // Prefer using server secret from env if present
    const envText = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    const m = envText.match(/^JWT_SECRET=(.+)$/m);
    const jwtSecret = (m?.[1] || '').trim().replace(/^["']|["']$/g, '');
    if (jwtSecret) {
      expiredToken = await new SignJWT({
        sub: priya.user.id,
        tenantId: priya.user.tenantId,
        memberType: 'EMPLOYEE',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(new TextEncoder().encode(jwtSecret));
      expiredMeta = { created: true };
    }
  } catch (e) {
    expiredMeta = { created: false, error: String(e) };
  }
  const expired = openSse('expired-token', expiredToken, { timeoutMs: 8000 });
  const expiredReady = await expired.ready;
  await new Promise((r) => setTimeout(r, 300));
  expired.kill('done');

  // Empty token query
  const emptyTokenResult = await new Promise((resolve) => {
    const url = new URL(`${API}/notifications/stream?token=`);
    const state = { statusCode: null, body: '', hung: false, errors: [] };
    const req = http.request(
      { hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, method: 'GET' },
      (res) => {
        state.statusCode = res.statusCode;
        res.on('data', (c) => { state.body += c.toString('utf8'); });
        res.on('end', () => resolve(state));
      },
    );
    req.setTimeout(8000, () => { state.hung = true; req.destroy(); resolve(state); });
    req.on('error', (e) => { state.errors.push(String(e)); resolve(state); });
    req.end();
  });

  results.sections.authEdge = {
    noToken: {
      status: noTokenResult.statusCode,
      hung: noTokenResult.hung,
      body: noTokenResult.body.slice(0, 300),
      contentType: noTokenResult.headers?.['content-type'],
    },
    badToken: {
      status: badReady.state.statusCode,
      hung: badReady.state.hung,
      errors: badReady.state.errors,
      comments: badReady.state.comments,
      // body may be empty if treated as SSE; capture status only
    },
    expiredToken: {
      meta: expiredMeta,
      status: expiredReady.state.statusCode,
      hung: expiredReady.state.hung,
      errors: expiredReady.state.errors,
    },
    emptyToken: {
      status: emptyTokenResult.statusCode,
      hung: emptyTokenResult.hung,
      body: emptyTokenResult.body.slice(0, 300),
    },
  };
  writeCapture('07-auth-edge.json', results.sections.authEdge);

  if (noTokenResult.statusCode !== 401) {
    defect('ISSUE-SSE-24', 'CRITICAL', `Stream without token returned ${noTokenResult.statusCode}, expected 401`, noTokenResult);
  }
  if (badReady.state.statusCode !== 401) {
    defect('ISSUE-SSE-25', 'CRITICAL', `Stream with bad token returned ${badReady.state.statusCode}, expected 401`, badReady.state);
  }
  if (expiredMeta.created && expiredReady.state.statusCode !== 401) {
    defect('ISSUE-SSE-26', 'CRITICAL', `Stream with expired token returned ${expiredReady.state.statusCode}, expected 401`, expiredReady.state);
  }
  if (emptyTokenResult.statusCode !== 401) {
    defect('ISSUE-SSE-27', 'HIGH', `Stream with empty token= returned ${emptyTokenResult.statusCode}, expected 401`, emptyTokenResult);
  }
  if (noTokenResult.hung || badReady.state.hung || expiredReady.state.hung || emptyTokenResult.hung) {
    defect('ISSUE-SSE-28', 'HIGH', 'Auth-fail SSE request hung (timeout) instead of clean 401 close', results.sections.authEdge);
  }

  // Security note: token in query string
  defect('ISSUE-SSE-29', 'MEDIUM', 'SSE auth accepts access token in query string (?token=) — risk of leak via access logs, proxies, Referer', {
    route: 'GET /api/v1/notifications/stream?token=',
    mitigationsPresent: ['also accepts Authorization Bearer', 'also accepts accessToken cookie'],
  });

  // Token does not bind stream to tenant header — only JWT sub
  note('SSE stream does not call resolveTenant / authenticate middleware — only verifyToken(sub)');

  // Cleanup durable
  rePriya.kill('done');
  reAman.kill('done');
  try { await tap.quit(); } catch { /* */ }

  await new Promise((r) => setTimeout(r, 500));
  const opsFinal = await opsProcess(sa.token);
  results.sections.opsFinal = {
    status: opsFinal.status,
    sse: opsFinal.json?.data?.sse || opsFinal.json?.sse || null,
  };
  writeCapture('08-ops-final.json', opsFinal);

  results.finishedAt = new Date().toISOString();
  results.defectCount = results.defects.length;
  writeCapture('raw.json', results);

  // RESULTS.md
  const md = renderResults(results);
  fs.writeFileSync(path.join(OUT, 'RESULTS.md'), md);
  console.log('\n=== DEFECTS ===');
  for (const d of results.defects) {
    console.log(`[${d.severity}] ${d.id}: ${d.title}`);
  }
  console.log(`\nWrote ${path.join(OUT, 'RESULTS.md')} · defects=${results.defects.length}`);
}

function renderResults(r) {
  const lines = [];
  lines.push('# Notifications SSE + Redis Fan-out — Stress Results');
  lines.push('');
  lines.push(`> Target: \`${r.target}\` · Redis: \`${r.redisUrl}\` · Tenant: \`acme-corp-001\``);
  lines.push(`> Started: ${r.startedAt} · Finished: ${r.finishedAt}`);
  lines.push(`> Defects filed: **${r.defectCount}**`);
  lines.push('');
  lines.push('## 1) Redis PING');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(r.sections.redis, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## 2) Fan-out boot log');
  lines.push('');
  lines.push(`- Found: **${r.sections.fanoutBootLog?.found}**`);
  lines.push(`- Line: \`${(r.sections.fanoutBootLog?.line || '').slice(0, 240)}\``);
  lines.push('');
  lines.push('## 3) Concurrent SSE open');
  lines.push('');
  lines.push('| Client | HTTP | Content-Type | Connected comment |');
  lines.push('|---|---:|---|---|');
  for (const c of r.sections.concurrentOpen || []) {
    lines.push(`| ${c.label} | ${c.status} | ${c.contentType || ''} | ${(c.comments || [])[0] || ''} |`);
  }
  lines.push('');
  lines.push('## 4) Ops SSE diagnostics');
  lines.push('');
  lines.push('- During open: `' + JSON.stringify(r.sections.opsDuring?.sse || null) + '`');
  lines.push('- After burst: `' + JSON.stringify(r.sections.reconnectBurst?.sseAfterBurst || null) + '`');
  lines.push('- Final: `' + JSON.stringify(r.sections.opsFinal?.sse || null) + '`');
  lines.push('');
  lines.push('## 5) Event delivery (leave create → Redis pub/sub → SSE)');
  lines.push('');
  const ed = r.sections.eventDelivery || {};
  lines.push(`- Leave create status: **${ed.leaveCreateStatus}**`);
  lines.push(`- Aman hit: **${Boolean(ed.aman?.hit)}** (${ed.aman?.waitedMs}ms)`);
  lines.push(`- HR hit: **${Boolean(ed.hr?.hit)}** (${ed.hr?.waitedMs}ms)`);
  lines.push(`- SA hit: **${Boolean(ed.sa?.hit)}** (${ed.sa?.waitedMs}ms)`);
  lines.push(`- Priya incorrectly got leave_requested: **${ed.priyaGotLeaveRequested}**`);
  lines.push(`- Redis tap messages: **${ed.redisTapCount}**`);
  lines.push(`- Approve delivery: \`${JSON.stringify(r.sections.approveDelivery || null)}\``);
  lines.push(`- Mark-read SSE: \`${JSON.stringify(r.sections.markRead || null)}\``);
  lines.push('');
  lines.push('## 6) Burst reconnect ×10');
  lines.push('');
  const b = r.sections.reconnectBurst || {};
  lines.push(`- Failures: **${b.burstFailCount}**/10 · 401s: ${b.burst401} · hung: ${b.burstHung}`);
  lines.push(`- Post-reconnect delivery: \`${JSON.stringify(r.sections.postReconnectDelivery || null)}\``);
  lines.push('');
  lines.push('## 7) Auth edge cases');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(r.sections.authEdge, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## Defects');
  lines.push('');
  if (!r.defects.length) {
    lines.push('_None filed._');
  } else {
    for (const d of r.defects) {
      lines.push(`### ${d.id} [${d.severity}] ${d.title}`);
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(d.evidence, null, 2).slice(0, 2500));
      lines.push('```');
      lines.push('');
    }
  }
  lines.push('## Notes');
  lines.push('');
  for (const n of r.notes) lines.push(`- ${n}`);
  lines.push('');
  lines.push('## Artifacts');
  lines.push('');
  lines.push('- `RESULTS.md` (this file)');
  lines.push('- `raw.json`');
  lines.push('- `01-redis-ping.json` … `08-ops-final.json`');
  lines.push('');
  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  results.fatal = String(err?.stack || err);
  fs.writeFileSync(path.join(OUT, 'raw.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, 'RESULTS.md'), `# FATAL\n\n${results.fatal}\n`);
  process.exit(1);
});
