#!/usr/bin/env node
/**
 * DEEP STRESS — Notifications REST API
 * Target: http://localhost:4000 · tenant acme-corp-001
 * Roles: superadmin / hr / aman / priya @acme.test
 * No Render · No migrations · No commits
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.API_BASE || 'http://localhost:4000';
const API = `${BASE}/api/v1`;
const TENANT = 'acme-corp-001';
const PASSWORD = 'Password123!';
const PARALLEL = 20;

const ROLES = [
  { role: 'SUPER_ADMIN', email: 'superadmin@acme.test' },
  { role: 'HR_ADMIN', email: 'hr@acme.test' },
  { role: 'MANAGER', email: 'aman@acme.test' },
  { role: 'EMPLOYEE', email: 'priya@acme.test' },
];

function now() {
  return new Date().toISOString();
}

function pct(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[i];
}

function statusMix(statuses) {
  const m = {};
  for (const s of statuses) m[s] = (m[s] || 0) + 1;
  return Object.entries(m)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => `${k}×${v}`)
    .join(', ');
}

function summarize(results) {
  const statuses = results.map((r) => r.status);
  const latencies = results.map((r) => r.ms).filter((n) => Number.isFinite(n));
  const errors = results.filter((r) => r.status < 200 || r.status >= 300);
  const bodies = {};
  for (const r of errors) {
    const key = `${r.status}|${JSON.stringify(r.body)?.slice(0, 220)}`;
    if (!bodies[key]) bodies[key] = { status: r.status, count: 0, body: r.body, sampleMs: r.ms };
    bodies[key].count += 1;
  }
  return {
    n: results.length,
    statusMix: statusMix(statuses),
    p50: pct(latencies, 50),
    p95: pct(latencies, 95),
    min: latencies.length ? Math.min(...latencies) : null,
    max: latencies.length ? Math.max(...latencies) : null,
    errors: Object.values(bodies),
    sampleOk: results.find((r) => r.status >= 200 && r.status < 300) || null,
  };
}

async function req(method, path, { token, query, body, headers } = {}) {
  const url = new URL(`${API}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const h = {
    'x-tenant-key': TENANT,
    ...(headers || {}),
  };
  if (token) h.authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    h['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const t0 = Date.now();
  let status = 0;
  let text = '';
  let json = null;
  let networkError = null;
  try {
    const res = await fetch(url, { method, headers: h, body: payload });
    status = res.status;
    text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      json = { parseError: true, text: text.slice(0, 400) };
    }
  } catch (e) {
    networkError = String(e?.message || e);
    status = 0;
  }
  return {
    method,
    path: url.pathname + url.search,
    status,
    ms: Date.now() - t0,
    body: json,
    text: text?.slice?.(0, 500),
    networkError,
  };
}

async function login(email) {
  const t0 = Date.now();
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT,
    },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { parseError: true, text: text.slice(0, 300) };
  }
  const token =
    json?.data?.accessToken ||
    json?.accessToken ||
    json?.data?.tokens?.accessToken ||
    null;
  const userId = json?.data?.user?.id || json?.data?.id || null;
  return {
    email,
    status: res.status,
    ms: Date.now() - t0,
    token,
    userId,
    body: json,
  };
}

async function burst(n, factory) {
  const t0 = Date.now();
  const results = await Promise.all(Array.from({ length: n }, (_, i) => factory(i)));
  return { wallMs: Date.now() - t0, results };
}

function extractNotifIds(listBody) {
  const arr = listBody?.data?.notifications || listBody?.notifications || [];
  return arr.map((n) => n.id).filter(Boolean);
}

function extractOwnerHints(listBody, role, email) {
  const arr = listBody?.data?.notifications || [];
  return arr.slice(0, 5).map((n) => ({
    role,
    email,
    id: n.id,
    title: n.title,
    type: n.type,
    isRead: n.isRead,
    entityId: n.entityId,
    actionUrl: n.actionUrl,
    bodyPreview: String(n.body || '').slice(0, 120),
  }));
}

function leakCheck(ownIds, foreignIdsSeenInList) {
  const own = new Set(ownIds);
  const leaks = foreignIdsSeenInList.filter((id) => !own.has(id));
  // If we pass foreign ids that appear in own list — that's a leak.
  // Caller passes: for each role's list ids, check intersection with other roles' ids.
  return leaks;
}

async function main() {
  mkdirSync(__dirname, { recursive: true });
  const startedAt = now();
  const tWall0 = Date.now();
  const findings = [];
  const note = (f) => {
    findings.push({ ...f, ts: now() });
    console.log(`  🐛 [${f.severity}] ${f.id}: ${f.where} — ${String(f.why).slice(0, 160)}`);
  };

  console.log(`NOTIF-API stress → ${API} · parallel=${PARALLEL}`);

  // ── Login ──────────────────────────────────────────────────────────
  const sessions = {};
  const loginRows = [];
  for (const r of ROLES) {
    const L = await login(r.email);
    loginRows.push({ role: r.role, ...L, tokenOk: Boolean(L.token) });
    sessions[r.role] = { ...r, ...L };
    console.log(`  login ${r.role}: ${L.status} token=${Boolean(L.token)} ${L.ms}ms userId=${L.userId || '?'}`);
    if (!L.token) {
      note({
        id: 'NOTIF-LOGIN-FAIL',
        severity: 'CRITICAL',
        layer: 'BACKEND',
        where: `POST /auth/login (${r.email})`,
        why: `status=${L.status} no accessToken`,
        evidence: L.body,
      });
    }
  }

  // Bootstrap: collect each role's notification IDs (before destructive mark-all)
  const inventory = {};
  for (const r of ROLES) {
    const s = sessions[r.role];
    if (!s.token) continue;
    const list = await req('GET', '/notifications', {
      token: s.token,
      query: { page: 1, limit: 50 },
    });
    const unread = await req('GET', '/notifications/unread-count', { token: s.token });
    const ids = extractNotifIds(list.body);
    inventory[r.role] = {
      listStatus: list.status,
      unreadStatus: unread.status,
      unreadCount: unread.body?.data?.count ?? unread.body?.data?.unreadCount ?? null,
      listUnreadCount: list.body?.data?.unreadCount ?? null,
      total: list.body?.data?.pagination?.total ?? null,
      ids,
      samples: extractOwnerHints(list.body, r.role, r.email),
      rawListMeta: list.body?.data?.pagination || null,
      listMs: list.ms,
      unreadMs: unread.ms,
    };
    console.log(
      `  inventory ${r.role}: list=${list.status} n=${ids.length} total=${inventory[r.role].total} unread=${inventory[r.role].unreadCount} (${list.ms}ms)`,
    );
  }

  // Cross-user ID map: every other role's ids
  const allIdsByRole = Object.fromEntries(
    Object.entries(inventory).map(([role, v]) => [role, v.ids || []]),
  );

  // Leak: overlapping ids across roles (should be empty — notification ids unique per user)
  const roleKeys = Object.keys(allIdsByRole);
  for (let i = 0; i < roleKeys.length; i++) {
    for (let j = i + 1; j < roleKeys.length; j++) {
      const a = roleKeys[i];
      const b = roleKeys[j];
      const setB = new Set(allIdsByRole[b]);
      const overlap = allIdsByRole[a].filter((id) => setB.has(id));
      if (overlap.length) {
        note({
          id: 'NOTIF-ID-OVERLAP',
          severity: 'CRITICAL',
          layer: 'BACKEND',
          where: `GET /notifications inventory ${a} ∩ ${b}`,
          why: `${overlap.length} shared notification id(s) across users — possible data model / scoping bug`,
          evidence: { overlap: overlap.slice(0, 10) },
        });
      }
    }
  }

  // Unread-count vs list.unreadCount consistency
  for (const r of ROLES) {
    const inv = inventory[r.role];
    if (!inv) continue;
    if (inv.unreadCount !== null && inv.listUnreadCount !== null && inv.unreadCount !== inv.listUnreadCount) {
      note({
        id: 'NOTIF-COUNT-MISMATCH',
        severity: 'HIGH',
        layer: 'BACKEND',
        where: `${r.role} unread-count vs list.unreadCount`,
        why: `GET /unread-count=${inv.unreadCount} but list.unreadCount=${inv.listUnreadCount}`,
        evidence: inv,
      });
    }
  }

  const roleReports = {};

  for (const r of ROLES) {
    const s = sessions[r.role];
    if (!s?.token) {
      roleReports[r.role] = { skipped: true, reason: 'no token' };
      continue;
    }
    console.log(`\n══ ${r.role} (${r.email}) ══`);
    const report = { role: r.role, email: r.email, bursts: {}, probes: {}, races: {} };

    // ── A. List variants ×20 parallel each ──────────────────────────
    const listVariants = [
      { name: 'list-default', query: {} },
      { name: 'list-page1-limit5', query: { page: 1, limit: 5 } },
      { name: 'list-page2-limit10', query: { page: 2, limit: 10 } },
      { name: 'list-unreadOnly-true', query: { unreadOnly: 'true' } },
      { name: 'list-unreadOnly-false', query: { unreadOnly: 'false' } },
      { name: 'list-since-epoch', query: { since: '1970-01-01T00:00:00.000Z' } },
      { name: 'list-since-future', query: { since: '2099-01-01T00:00:00.000Z' } },
      { name: 'list-combo', query: { page: 1, limit: 20, unreadOnly: 'true', since: '2020-01-01T00:00:00.000Z' } },
    ];

    for (const v of listVariants) {
      const { wallMs, results } = await burst(PARALLEL, () =>
        req('GET', '/notifications', { token: s.token, query: v.query }),
      );
      const sum = summarize(results);
      report.bursts[v.name] = { ...sum, wallMs, query: v.query };
      console.log(`  ${v.name}: ${sum.statusMix} p50=${sum.p50} p95=${sum.p95} wall=${wallMs}ms`);

      // Leak check: none of the returned ids should belong to another role's inventory
      const foreign = [];
      for (const res of results) {
        if (res.status !== 200) continue;
        const ids = extractNotifIds(res.body);
        for (const other of ROLES) {
          if (other.role === r.role) continue;
          const otherSet = new Set(allIdsByRole[other.role] || []);
          for (const id of ids) {
            if (otherSet.has(id)) foreign.push({ id, from: other.role });
          }
        }
      }
      if (foreign.length) {
        note({
          id: 'NOTIF-LIST-LEAK',
          severity: 'CRITICAL',
          layer: 'BACKEND',
          where: `GET /notifications ${v.name} as ${r.role}`,
          why: `Returned notification id(s) owned by other role(s)`,
          evidence: { foreign: foreign.slice(0, 10) },
        });
      }

      // since=future should return empty
      if (v.name === 'list-since-future' && sum.sampleOk) {
        const total = sum.sampleOk.body?.data?.pagination?.total;
        const n = sum.sampleOk.body?.data?.notifications?.length;
        if (total > 0 || n > 0) {
          note({
            id: 'NOTIF-SINCE-FUTURE',
            severity: 'MEDIUM',
            layer: 'BACKEND',
            where: `GET /notifications?since=2099… as ${r.role}`,
            why: `Expected empty list for future since; got total=${total} n=${n}`,
            evidence: sum.sampleOk.body?.data?.pagination,
          });
        }
      }
    }

    // Extreme / invalid query params
    const edgeQueries = [
      { name: 'list-page0', query: { page: 0, limit: 10 } },
      { name: 'list-page-neg', query: { page: -1, limit: 10 } },
      { name: 'list-limit0', query: { page: 1, limit: 0 } },
      { name: 'list-limit-neg', query: { page: 1, limit: -5 } },
      { name: 'list-limit-huge', query: { page: 1, limit: 5000 } },
      { name: 'list-page-nan', query: { page: 'abc', limit: 'xyz' } },
      { name: 'list-unreadOnly-1', query: { unreadOnly: '1' } },
      { name: 'list-unreadOnly-TRUE', query: { unreadOnly: 'TRUE' } },
      { name: 'list-since-invalid', query: { since: 'not-a-date' } },
    ];
    report.probes.edgeQueries = {};
    for (const e of edgeQueries) {
      const res = await req('GET', '/notifications', { token: s.token, query: e.query });
      report.probes.edgeQueries[e.name] = {
        status: res.status,
        ms: res.ms,
        error: res.body?.error || null,
        pagination: res.body?.data?.pagination || null,
        n: res.body?.data?.notifications?.length ?? null,
        networkError: res.networkError,
      };
      console.log(
        `  edge ${e.name}: ${res.status} ms=${res.ms} err=${res.body?.error?.code || '-'} n=${res.body?.data?.notifications?.length ?? '-'}`,
      );
      if (res.status >= 500) {
        note({
          id: 'NOTIF-EDGE-5XX',
          severity: 'HIGH',
          layer: 'BACKEND',
          where: `GET /notifications ${e.name} as ${r.role}`,
          why: `Unhandled ${res.status} on bad query ${JSON.stringify(e.query)}`,
          evidence: res.body,
        });
      }
      if (e.name === 'list-limit-huge' && res.status === 200) {
        const lim = res.body?.data?.pagination?.limit;
        const n = res.body?.data?.notifications?.length;
        if (lim >= 5000 || n >= 1000) {
          note({
            id: 'NOTIF-LIMIT-UNBOUNDED',
            severity: 'MEDIUM',
            layer: 'BACKEND',
            where: `GET /notifications?limit=5000 as ${r.role}`,
            why: `No max-limit clamp — pagination.limit=${lim} returned=${n}`,
            evidence: res.body?.data?.pagination,
          });
        }
      }
      if ((e.name === 'list-page0' || e.name === 'list-page-neg' || e.name === 'list-limit-neg') && res.status === 200) {
        note({
          id: 'NOTIF-NEG-PAGINATION',
          severity: 'MEDIUM',
          layer: 'BACKEND',
          where: `GET /notifications ${e.name} as ${r.role}`,
          why: `Accepted invalid pagination (${JSON.stringify(e.query)}) with 200 instead of 400`,
          evidence: { pagination: res.body?.data?.pagination, n: res.body?.data?.notifications?.length },
        });
      }
      if (e.name === 'list-since-invalid' && res.status >= 500) {
        note({
          id: 'NOTIF-SINCE-CRASH',
          severity: 'HIGH',
          layer: 'BACKEND',
          where: `GET /notifications?since=not-a-date as ${r.role}`,
          why: `${res.status} on invalid since (should 400)`,
          evidence: res.body,
        });
      }
    }

    // ── B. unread-count ×20 ─────────────────────────────────────────
    {
      const { wallMs, results } = await burst(PARALLEL, () =>
        req('GET', '/notifications/unread-count', { token: s.token }),
      );
      const sum = summarize(results);
      report.bursts['unread-count'] = { ...sum, wallMs };
      console.log(`  unread-count×${PARALLEL}: ${sum.statusMix} p50=${sum.p50} p95=${sum.p95} wall=${wallMs}ms`);
      const counts = results
        .filter((x) => x.status === 200)
        .map((x) => x.body?.data?.count)
        .filter((c) => c !== undefined);
      const unique = [...new Set(counts)];
      if (unique.length > 1) {
        note({
          id: 'NOTIF-COUNT-RACE-DRIFT',
          severity: 'LOW',
          layer: 'BACKEND',
          where: `GET /unread-count burst as ${r.role}`,
          why: `Count drifted under parallel reads: ${unique.join(',')}`,
          evidence: { unique },
        });
      }
      report.probes.unreadCountUnique = unique;
    }

    // ── C. Invalid ids (PATCH + POST) ───────────────────────────────
    const invalidIds = [
      'does-not-exist',
      '000000000000000000000000',
      '../../../etc/passwd',
      '',
      'null',
      encodeURIComponent('"; DROP TABLE "Notification"; --'),
    ];
    report.probes.invalidIds = {};
    for (const id of invalidIds) {
      const pathId = id === '' ? ' ' : id; // empty path segment weirdness
      for (const method of ['PATCH', 'POST']) {
        const res = await req(method, `/notifications/${encodeURIComponent(id)}/read`, {
          token: s.token,
          body: {},
        });
        const key = `${method}:${id || '(empty)'}`;
        report.probes.invalidIds[key] = {
          status: res.status,
          ms: res.ms,
          code: res.body?.error?.code || null,
          message: res.body?.error?.message || null,
        };
        if (res.status === 200) {
          note({
            id: 'NOTIF-INVALID-ID-OK',
            severity: 'CRITICAL',
            layer: 'BACKEND',
            where: `${method} /notifications/:id/read id=${JSON.stringify(id)} as ${r.role}`,
            why: `Invalid id returned 200`,
            evidence: res.body,
          });
        }
        if (res.status >= 500) {
          note({
            id: 'NOTIF-INVALID-ID-5XX',
            severity: 'HIGH',
            layer: 'BACKEND',
            where: `${method} /notifications/:id/read id=${JSON.stringify(id)} as ${r.role}`,
            why: `${res.status} — should be 404 NOT_FOUND`,
            evidence: res.body,
          });
        }
      }
    }
    // Also probe without encode for path traversal style
    {
      const res = await req('PATCH', `/notifications/not-a-real-cuid/read`, { token: s.token, body: {} });
      report.probes.invalidIds['PATCH:not-a-real-cuid'] = {
        status: res.status,
        ms: res.ms,
        code: res.body?.error?.code || null,
      };
      console.log(`  invalid id not-a-real-cuid: ${res.status} ${res.body?.error?.code || ''}`);
    }

    // ── D. Cross-user mark-read (IDOR) ──────────────────────────────
    report.probes.crossUser = {};
    for (const other of ROLES) {
      if (other.role === r.role) continue;
      const foreignIds = (allIdsByRole[other.role] || []).slice(0, 3);
      for (const fid of foreignIds) {
        for (const method of ['PATCH', 'POST']) {
          const res = await req(method, `/notifications/${fid}/read`, {
            token: s.token,
            body: {},
          });
          const key = `${method}:${other.role}:${fid}`;
          report.probes.crossUser[key] = {
            status: res.status,
            ms: res.ms,
            code: res.body?.error?.code || null,
            body: res.body?.data || res.body?.error || null,
          };
          if (res.status === 200) {
            note({
              id: 'NOTIF-IDOR-MARK-READ',
              severity: 'CRITICAL',
              layer: 'BACKEND',
              where: `${method} /notifications/${fid}/read as ${r.role} (owner=${other.role})`,
              why: `Cross-user mark-read succeeded — IDOR / data leakage`,
              evidence: res.body,
            });
          } else if (res.status !== 404) {
            note({
              id: 'NOTIF-IDOR-UNEXPECTED',
              severity: 'MEDIUM',
              layer: 'BACKEND',
              where: `${method} /notifications/:foreignId/read as ${r.role}`,
              why: `Expected 404 NOT_FOUND for foreign id; got ${res.status} ${res.body?.error?.code || ''}`,
              evidence: res.body,
            });
          }
        }
      }
    }
    const crossStatuses = Object.values(report.probes.crossUser).map((x) => x.status);
    console.log(
      `  cross-user mark-read: ${statusMix(crossStatuses)} (n=${crossStatuses.length})`,
    );

    // ── E. Own mark-read aliases under burst ────────────────────────
    // Prefer an unread id if available; else any id; else skip
    const ownIds = inventory[r.role]?.ids || [];
    let targetId = ownIds[0] || null;
    // refresh list for unread
    {
      const ul = await req('GET', '/notifications', {
        token: s.token,
        query: { unreadOnly: 'true', limit: 5 },
      });
      const unreadIds = extractNotifIds(ul.body);
      if (unreadIds[0]) targetId = unreadIds[0];
      report.probes.unreadSampleBeforeMark = {
        status: ul.status,
        unreadIds,
        unreadCount: ul.body?.data?.unreadCount,
      };
    }

    if (targetId) {
      // Burst PATCH mark-read on same id ×10 + POST ×10 interleaved
      const { wallMs, results } = await burst(20, (i) => {
        const method = i % 2 === 0 ? 'PATCH' : 'POST';
        return req(method, `/notifications/${targetId}/read`, { token: s.token, body: {} });
      });
      const sum = summarize(results);
      report.bursts['mark-read-alias-burst'] = { ...sum, wallMs, targetId };
      console.log(
        `  mark-read alias burst id=${targetId.slice(0, 12)}…: ${sum.statusMix} p50=${sum.p50} wall=${wallMs}ms`,
      );
      if (sum.errors.some((e) => e.status >= 500)) {
        note({
          id: 'NOTIF-MARKREAD-5XX',
          severity: 'HIGH',
          layer: 'BACKEND',
          where: `PATCH|POST /notifications/:id/read burst as ${r.role}`,
          why: `5xx under concurrent mark-read`,
          evidence: sum.errors,
        });
      }
      // Idempotent re-mark should stay 200
      const non200 = results.filter((x) => x.status !== 200);
      if (non200.length) {
        note({
          id: 'NOTIF-MARKREAD-NON200',
          severity: 'MEDIUM',
          layer: 'BACKEND',
          where: `mark-read burst as ${r.role}`,
          why: `${non200.length}/20 non-200 under concurrent re-mark (expect idempotent 200)`,
          evidence: non200.slice(0, 3).map((x) => ({ status: x.status, body: x.body })),
        });
      }
    } else {
      report.bursts['mark-read-alias-burst'] = { skipped: true, reason: 'no own notification ids' };
      console.log(`  mark-read burst skipped (no ids)`);
    }

    // ── F. Race: mark-all-read while listing ────────────────────────
    {
      const raceOps = [];
      // 10 list + 5 PATCH read-all + 5 POST read-all simultaneously
      for (let i = 0; i < 10; i++) {
        raceOps.push(req('GET', '/notifications', { token: s.token, query: { page: 1, limit: 20 } }));
      }
      for (let i = 0; i < 5; i++) {
        raceOps.push(req('PATCH', '/notifications/read-all', { token: s.token, body: {} }));
      }
      for (let i = 0; i < 5; i++) {
        raceOps.push(req('POST', '/notifications/read-all', { token: s.token, body: {} }));
      }
      const t0 = Date.now();
      const raceResults = await Promise.all(raceOps);
      const wallMs = Date.now() - t0;
      const lists = raceResults.slice(0, 10);
      const patchAll = raceResults.slice(10, 15);
      const postAll = raceResults.slice(15, 20);
      report.races.markAllWhileList = {
        wallMs,
        list: summarize(lists),
        patchReadAll: summarize(patchAll),
        postReadAll: summarize(postAll),
        markedReadSamples: [...patchAll, ...postAll].map((x) => ({
          method: x.method,
          status: x.status,
          markedRead: x.body?.data?.markedRead,
          ms: x.ms,
        })),
      };
      console.log(
        `  race list×10 + read-all×10: list=${report.races.markAllWhileList.list.statusMix} patchAll=${report.races.markAllWhileList.patchReadAll.statusMix} postAll=${report.races.markAllWhileList.postReadAll.statusMix} wall=${wallMs}ms`,
      );

      const fiveHundreds = raceResults.filter((x) => x.status >= 500);
      if (fiveHundreds.length) {
        note({
          id: 'NOTIF-RACE-5XX',
          severity: 'HIGH',
          layer: 'BACKEND',
          where: `mark-all-read while listing as ${r.role}`,
          why: `${fiveHundreds.length} responses ≥500 under race`,
          evidence: fiveHundreds.slice(0, 3).map((x) => ({ path: x.path, status: x.status, body: x.body })),
        });
      }

      // After race, unread should be 0 (active notifications)
      const after = await req('GET', '/notifications/unread-count', { token: s.token });
      const afterList = await req('GET', '/notifications', {
        token: s.token,
        query: { unreadOnly: 'true' },
      });
      report.races.afterMarkAll = {
        unreadStatus: after.status,
        count: after.body?.data?.count,
        listUnreadTotal: afterList.body?.data?.pagination?.total,
        listUnreadN: afterList.body?.data?.notifications?.length,
      };
      console.log(
        `  after mark-all: unread-count=${after.body?.data?.count} unreadOnly.total=${afterList.body?.data?.pagination?.total}`,
      );

      // markedRead sum: first caller may get N, others 0 — OK. Negative or missing field = bug.
      const marked = [...patchAll, ...postAll]
        .filter((x) => x.status === 200)
        .map((x) => x.body?.data?.markedRead);
      if (marked.some((m) => m === undefined)) {
        note({
          id: 'NOTIF-MARKALL-SHAPE',
          severity: 'MEDIUM',
          layer: 'BACKEND',
          where: `PATCH|POST /notifications/read-all as ${r.role}`,
          why: `Response missing data.markedRead under race`,
          evidence: marked,
        });
      }
      if (after.status === 200 && after.body?.data?.count > 0) {
        // Possible if expired filter mismatch — markAll marks expired but count excludes them.
        // Or race left unread. Flag as defect candidate.
        note({
          id: 'NOTIF-MARKALL-RESIDUAL',
          severity: 'MEDIUM',
          layer: 'BACKEND',
          where: `after mark-all-read race as ${r.role}`,
          why: `unread-count still ${after.body.data.count} after concurrent mark-all (expect 0 for active)`,
          evidence: report.races.afterMarkAll,
        });
      }
    }

    // ── G. Unauthenticated / bad token ──────────────────────────────
    if (r.role === 'EMPLOYEE') {
      const noAuth = await req('GET', '/notifications', {});
      const badTok = await req('GET', '/notifications', { token: 'not.a.jwt' });
      const noAuthCount = await req('GET', '/notifications/unread-count', {});
      const noAuthMark = await req('PATCH', '/notifications/read-all', { body: {} });
      report.probes.auth = {
        noAuthList: { status: noAuth.status, code: noAuth.body?.error?.code },
        badToken: { status: badTok.status, code: badTok.body?.error?.code },
        noAuthCount: { status: noAuthCount.status, code: noAuthCount.body?.error?.code },
        noAuthMarkAll: { status: noAuthMark.status, code: noAuthMark.body?.error?.code },
      };
      for (const [k, v] of Object.entries(report.probes.auth)) {
        if (v.status !== 401) {
          note({
            id: 'NOTIF-AUTH-BYPASS',
            severity: 'CRITICAL',
            layer: 'BACKEND',
            where: `${k}`,
            why: `Expected 401, got ${v.status} ${v.code || ''}`,
            evidence: v,
          });
        }
      }
      console.log(
        `  auth probes: noAuth=${noAuth.status} badTok=${badTok.status} noAuthCount=${noAuthCount.status} noAuthMark=${noAuthMark.status}`,
      );
    }

    // ── H. Empty body POST read-all (FE axios pattern) ──────────────
    {
      const res = await req('POST', '/notifications/read-all', {
        token: s.token,
        body: {},
      });
      report.probes.emptyBodyPostReadAll = {
        status: res.status,
        ms: res.ms,
        markedRead: res.body?.data?.markedRead,
        code: res.body?.error?.code,
      };
    }

    roleReports[r.role] = report;
  }

  // Cross-role: after everyone mark-all'd, verify no residual leak of others' content in titles/bodies from inventory samples
  // (inventory was taken before mark-all — check body content doesn't contain other users' emails)
  for (const r of ROLES) {
    const samples = inventory[r.role]?.samples || [];
    for (const s of samples) {
      for (const other of ROLES) {
        if (other.role === r.role) continue;
        const hay = `${s.title} ${s.bodyPreview} ${s.actionUrl || ''}`.toLowerCase();
        // Soft check: if notification body literally embeds another seeded login email, flag for review
        if (hay.includes(other.email.toLowerCase())) {
          // Not necessarily a leak (team leave notifs mention names) — LOW informational
          note({
            id: 'NOTIF-CONTENT-MENTIONS-OTHER',
            severity: 'INFO',
            layer: 'BACKEND',
            where: `${r.role} notification content mentions ${other.email}`,
            why: `Notification text references another role's email (may be intentional team notif)`,
            evidence: { id: s.id, title: s.title, bodyPreview: s.bodyPreview },
          });
        }
      }
    }
  }

  const finishedAt = now();
  const wallMs = Date.now() - tWall0;

  const raw = {
    mode: 'NOTIF-API-STRESS',
    base: BASE,
    api: API,
    tenant: TENANT,
    parallel: PARALLEL,
    startedAt,
    finishedAt,
    wallMs,
    logins: loginRows.map((l) => ({
      role: l.role || ROLES.find((x) => x.email === l.email)?.role,
      email: l.email,
      status: l.status,
      ms: l.ms,
      tokenOk: l.tokenOk,
      userId: l.userId,
    })),
    inventory,
    roleReports,
    findings,
  };

  writeFileSync(join(__dirname, 'raw.json'), JSON.stringify(raw, null, 2));

  // ── RESULTS.md ────────────────────────────────────────────────────
  const lines = [];
  lines.push('# Notifications REST API — Deep Stress Results');
  lines.push('');
  lines.push(
    `> Target: \`${BASE}\` (API \`${API}\`) · Tenant: \`${TENANT}\` · Parallel: **${PARALLEL}** · Wall: **${wallMs} ms**`,
  );
  lines.push(
    `> Started: ${startedAt} · Finished: ${finishedAt} · Hostinger via tunnel · No Render · No migrations · No commits`,
  );
  lines.push('');
  lines.push('## Login');
  lines.push('');
  lines.push('| Role | Email | Status | Token | userId | Latency (ms) |');
  lines.push('|---|---|---:|---|---|---:|');
  for (const l of raw.logins) {
    lines.push(
      `| ${l.role} | ${l.email} | ${l.status} | ${l.tokenOk ? 'yes' : 'NO'} | \`${(l.userId || '').slice(0, 12)}…\` | ${l.ms} |`,
    );
  }
  lines.push('');
  lines.push('## Inventory (pre-mutation)');
  lines.push('');
  lines.push('| Role | List | Total | IDs sampled | unread-count | list.unreadCount |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const r of ROLES) {
    const inv = inventory[r.role] || {};
    lines.push(
      `| ${r.role} | ${inv.listStatus ?? '—'} | ${inv.total ?? '—'} | ${(inv.ids || []).length} | ${inv.unreadCount ?? '—'} | ${inv.listUnreadCount ?? '—'} |`,
    );
  }
  lines.push('');
  lines.push('### Sample notification ids (for cross-user probes)');
  lines.push('');
  for (const r of ROLES) {
    const ids = (inventory[r.role]?.ids || []).slice(0, 3);
    lines.push(`- **${r.role}**: ${ids.length ? ids.map((id) => `\`${id}\``).join(', ') : '_(none)_'}`);
  }
  lines.push('');

  for (const r of ROLES) {
    const rep = roleReports[r.role];
    lines.push(`## ${r.role} (${r.email})`);
    lines.push('');
    if (rep?.skipped) {
      lines.push(`_Skipped: ${rep.reason}_`);
      lines.push('');
      continue;
    }
    lines.push('### Burst GETs');
    lines.push('');
    lines.push('| Probe | Status mix | p50 | p95 | min | max | wall |');
    lines.push('|---|---|---:|---:|---:|---:|---:|');
    for (const [name, b] of Object.entries(rep.bursts || {})) {
      if (b.skipped) {
        lines.push(`| \`${name}\` | skipped | — | — | — | — | — |`);
        continue;
      }
      lines.push(
        `| \`${name}\` | ${b.statusMix} | ${b.p50} | ${b.p95} | ${b.min} | ${b.max} | ${b.wallMs} |`,
      );
    }
    lines.push('');

    lines.push('### Edge query probes');
    lines.push('');
    lines.push('| Probe | Status | ms | error | n / pagination.limit |');
    lines.push('|---|---:|---:|---|---|');
    for (const [name, e] of Object.entries(rep.probes?.edgeQueries || {})) {
      const pag = e.pagination ? `n=${e.n} lim=${e.pagination.limit}` : `n=${e.n}`;
      lines.push(`| \`${name}\` | ${e.status} | ${e.ms} | ${e.error?.code || '—'} | ${pag} |`);
    }
    lines.push('');

    lines.push('### Cross-user mark-read (IDOR)');
    lines.push('');
    const cu = Object.entries(rep.probes?.crossUser || {});
    if (!cu.length) {
      lines.push('_No foreign ids available to probe._');
    } else {
      const mix = statusMix(cu.map(([, v]) => v.status));
      lines.push(`Status mix: **${mix}** (${cu.length} attempts PATCH+POST × foreign ids)`);
      const bad = cu.filter(([, v]) => v.status === 200);
      if (bad.length) {
        lines.push('');
        lines.push('**LEAKS (200 on foreign id):**');
        for (const [k, v] of bad.slice(0, 10)) {
          lines.push(`- \`${k}\` → ${v.status} ${JSON.stringify(v.body)}`);
        }
      } else {
        lines.push('');
        lines.push('All foreign mark-read attempts returned non-200 (expect **404 NOT_FOUND**).');
      }
    }
    lines.push('');

    lines.push('### Race: mark-all-read ∥ list');
    lines.push('');
    const race = rep.races?.markAllWhileList;
    if (race) {
      lines.push(
        `- list×10: ${race.list.statusMix} p50=${race.list.p50}ms · patch read-all×5: ${race.patchReadAll.statusMix} · post read-all×5: ${race.postReadAll.statusMix} · wall ${race.wallMs}ms`,
      );
      lines.push(
        `- after: unread-count=${rep.races.afterMarkAll?.count} unreadOnly.total=${rep.races.afterMarkAll?.listUnreadTotal}`,
      );
      const mrs = (race.markedReadSamples || [])
        .map((x) => `${x.method}:${x.status}:markedRead=${x.markedRead}`)
        .join(', ');
      lines.push(`- markedRead samples: ${mrs}`);
    }
    lines.push('');

    if (rep.probes?.auth) {
      lines.push('### Auth negative probes');
      lines.push('');
      for (const [k, v] of Object.entries(rep.probes.auth)) {
        lines.push(`- \`${k}\`: ${v.status} ${v.code || ''}`);
      }
      lines.push('');
    }
  }

  lines.push('## Findings');
  lines.push('');
  if (!findings.length) {
    lines.push('_No defects recorded (unexpected for a deep stress pass — re-check probes)._');
  } else {
    const bySev = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [], INFO: [] };
    for (const f of findings) {
      (bySev[f.severity] || bySev.INFO).push(f);
    }
    for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']) {
      if (!bySev[sev].length) continue;
      lines.push(`### ${sev} (${bySev[sev].length})`);
      lines.push('');
      for (const f of bySev[sev]) {
        lines.push(`#### ${f.id}`);
        lines.push(`- **Where:** ${f.where}`);
        lines.push(`- **Why:** ${f.why}`);
        lines.push(`- **Layer:** ${f.layer}`);
        if (f.evidence) {
          lines.push(`- **Evidence:** \`${JSON.stringify(f.evidence).slice(0, 400)}\``);
        }
        lines.push('');
      }
    }
  }

  lines.push('## Summary counts');
  lines.push('');
  lines.push(`- Findings: **${findings.length}** (CRITICAL=${findings.filter((f) => f.severity === 'CRITICAL').length}, HIGH=${findings.filter((f) => f.severity === 'HIGH').length}, MEDIUM=${findings.filter((f) => f.severity === 'MEDIUM').length}, LOW=${findings.filter((f) => f.severity === 'LOW').length}, INFO=${findings.filter((f) => f.severity === 'INFO').length})`);
  lines.push(`- Raw JSON: [\`raw.json\`](./raw.json)`);
  lines.push(`- Runner: [\`_stress_notif_api.mjs\`](./_stress_notif_api.mjs)`);
  lines.push('');

  writeFileSync(join(__dirname, 'RESULTS.md'), lines.join('\n'));
  console.log(`\nWrote RESULTS.md + raw.json · findings=${findings.length} · wall=${wallMs}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
