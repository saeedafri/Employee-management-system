#!/usr/bin/env node
/**
 * ISOLATION-HAMMER — cross-tenant/cross-user isolation under concurrency
 * Target: http://localhost:4000 · No Render · No migrations · No commits
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.API_BASE || 'http://localhost:4000';
const API = `${BASE}/api/v1`;
const TENANT = 'acme-corp-001';
const ROUNDS = 5;
const PASSWORD = 'Password123!';

const ROLES = [
  { role: 'SUPER_ADMIN', email: 'superadmin@acme.test' },
  { role: 'HR_ADMIN', email: 'hr@acme.test' },
  { role: 'MANAGER', email: 'aman@acme.test' },
  { role: 'EMPLOYEE', email: 'priya@acme.test' },
];

const PRIYA_EMP = 'cmqjpyds7001kkpjdnlhjygrp';
const EXPECTED = {
  SUPER_ADMIN: { email: 'superadmin@acme.test', employeeId: null },
  HR_ADMIN: { email: 'hr@acme.test', employeeId: 'cmqjpydsb001mkpjdxlgw74tv' },
  MANAGER: { email: 'aman@acme.test', employeeId: 'cmqjpyds0001ikpjd5br3r2uh' },
  EMPLOYEE: { email: 'priya@acme.test', employeeId: PRIYA_EMP },
};

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
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => `${k}×${v}`)
    .join(', ');
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
  const setCookie = res.headers.getSetCookie?.() || [];
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
  return {
    email,
    status: res.status,
    ms: Date.now() - t0,
    token,
    setCookie,
    bodyPreview: text.slice(0, 240),
    userId: json?.data?.user?.id || json?.data?.id || null,
    refreshHint: setCookie.map((c) => c.split(';')[0]).join(' | ') || null,
  };
}

async function get(path, token, cookieHeader = null) {
  const t0 = Date.now();
  const headers = {
    'x-tenant-key': TENANT,
    accept: 'application/json',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  if (cookieHeader) headers.cookie = cookieHeader;
  let status = 0;
  let text = '';
  let err = null;
  try {
    const res = await fetch(`${API}${path}`, { headers });
    status = res.status;
    text = await res.text();
  } catch (e) {
    err = e.message;
    status = -1;
  }
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return {
    path,
    status,
    ms: Date.now() - t0,
    err,
    json,
    text: text.slice(0, 800),
  };
}

function extractLeaveEmpPrefix(balanceJson) {
  const bals = balanceJson?.data?.balances || balanceJson?.data || [];
  if (!Array.isArray(bals) || !bals.length) return null;
  const id = bals[0]?.id || bals[0]?.employeeId;
  if (!id || typeof id !== 'string') return null;
  // ids look like `${employeeId}-EL`
  const m = id.match(/^(cm[a-z0-9]+)-/);
  return m ? m[1] : id.split('-')[0];
}

function extractLeaveRefs(reqJson) {
  const reqs = reqJson?.data?.requests || reqJson?.data || [];
  if (!Array.isArray(reqs)) return [];
  return reqs.slice(0, 5).map((r) => r.referenceNo || r.id).filter(Boolean);
}

function extractLeaveEmployeeIds(reqJson) {
  const reqs = reqJson?.data?.requests || reqJson?.data || [];
  if (!Array.isArray(reqs)) return [];
  return [...new Set(reqs.map((r) => r.employeeId).filter(Boolean))];
}

function extractNotifIds(notifJson) {
  const items = notifJson?.data?.notifications || notifJson?.data?.items || notifJson?.data || [];
  if (!Array.isArray(items)) return [];
  return items.slice(0, 20).map((n) => ({
    id: n.id,
    userId: n.userId,
    title: n.title,
    body: (n.body || n.message || '').slice(0, 120),
  }));
}

function analyzeHit(role, email, expected, hit) {
  const findings = [];
  const me = hit['/auth/me'];
  const bal = hit['/leave/balance'];
  const reqs = hit['/leave/requests'];
  const notif = hit['/notifications'];
  const empList = hit['/employees'];

  const meEmail = me?.json?.data?.email;
  const meEmp = me?.json?.data?.employeeId ?? null;
  const meUser = me?.json?.data?.id;

  // Cookie/session confusion: auth/me must match login email
  if (me?.status === 200 && meEmail && meEmail !== email) {
    findings.push({
      severity: 'CRITICAL',
      kind: 'SESSION_CONFUSION',
      detail: `auth/me email=${meEmail} but logged in as ${email}`,
      path: '/auth/me',
      status: me.status,
    });
  }
  if (me?.status === 200 && expected.employeeId !== undefined) {
    const exp = expected.employeeId;
    if (exp === null && meEmp !== null) {
      findings.push({
        severity: 'HIGH',
        kind: 'IDENTITY_MISMATCH',
        detail: `auth/me employeeId=${meEmp} expected null for ${role}`,
        path: '/auth/me',
        status: me.status,
      });
    } else if (exp && meEmp && meEmp !== exp) {
      findings.push({
        severity: 'CRITICAL',
        kind: 'IDENTITY_MISMATCH',
        detail: `auth/me employeeId=${meEmp} expected ${exp}`,
        path: '/auth/me',
        status: me.status,
      });
    }
  }

  // SA-10 / wrong employee leave data
  if (bal?.status === 200) {
    const prefix = extractLeaveEmpPrefix(bal.json);
    if (role === 'SUPER_ADMIN' && prefix === PRIYA_EMP) {
      findings.push({
        severity: 'CRITICAL',
        kind: 'SA10_LEAVE_LEAK',
        detail: `leave/balance resolves to Priya employeeId prefix ${prefix} while auth/me.employeeId=${meEmp}`,
        path: '/leave/balance',
        status: bal.status,
        sample: bal.text.slice(0, 220),
      });
    } else if (expected.employeeId && prefix && prefix !== expected.employeeId) {
      findings.push({
        severity: 'CRITICAL',
        kind: 'CROSS_USER_LEAVE_BALANCE',
        detail: `leave/balance prefix=${prefix} expected own ${expected.employeeId}`,
        path: '/leave/balance',
        status: bal.status,
        sample: bal.text.slice(0, 220),
      });
    }
  }

  if (reqs?.status === 200) {
    const refs = extractLeaveRefs(reqs.json);
    const empIds = extractLeaveEmployeeIds(reqs.json);
    const prefix = extractLeaveEmpPrefix(bal?.json) || meEmp;
    if (role === 'SUPER_ADMIN' && meEmp === null) {
      // SA with null employee should not get another user's personal leave list
      const bodyStr = reqs.text || '';
      if (bodyStr.includes(PRIYA_EMP) || refs.some((r) => String(r).startsWith('LVR-002'))) {
        // Check if same refs as Priya's known ones (heuristic)
        findings.push({
          severity: 'CRITICAL',
          kind: 'SA10_LEAVE_REQUESTS_LEAK',
          detail: `leave/requests for SA (employeeId=null) returned refs=[${refs.join(',')}] matching Priya-scoped personal list`,
          path: '/leave/requests',
          status: reqs.status,
          sample: reqs.text.slice(0, 220),
        });
      }
    }
    if (expected.employeeId && empIds.length) {
      const foreign = empIds.filter((id) => id !== expected.employeeId);
      if (foreign.length && role === 'EMPLOYEE') {
        findings.push({
          severity: 'CRITICAL',
          kind: 'CROSS_USER_LEAVE_REQUESTS',
          detail: `EMPLOYEE leave/requests contains foreign employeeIds=${foreign.join(',')}`,
          path: '/leave/requests',
          status: reqs.status,
        });
      }
    }
    // unused prefix silence
    void prefix;
  }

  // Notifications: must belong to meUser if userId present
  if (notif?.status === 200) {
    const items = extractNotifIds(notif.json);
    const foreign = items.filter((n) => n.userId && meUser && n.userId !== meUser);
    if (foreign.length) {
      findings.push({
        severity: 'CRITICAL',
        kind: 'NOTIFICATION_CROSS_USER',
        detail: `${foreign.length} notifications have foreign userId (sample id=${foreign[0].id} userId=${foreign[0].userId} title=${foreign[0].title})`,
        path: '/notifications',
        status: notif.status,
        sample: JSON.stringify(foreign.slice(0, 2)),
      });
    }
    // Body containing other role emails/names while being employee
    if (role === 'EMPLOYEE' && items.length) {
      const bodyBlob = items.map((n) => `${n.title} ${n.body}`).join(' | ');
      // Soft check: notification about other users' private actions is OK for managers; for employee inbox userId check is primary
      void bodyBlob;
    }
  }

  // 500s
  for (const [path, h] of Object.entries(hit)) {
    if (h.status >= 500 || h.status === -1) {
      findings.push({
        severity: 'CRITICAL',
        kind: h.status === -1 ? 'NETWORK_ERROR' : 'HTTP_5XX',
        detail: `${path} → ${h.status}${h.err ? ` ${h.err}` : ''}`,
        path,
        status: h.status,
        sample: h.text?.slice(0, 200),
      });
    }
  }

  // EMPLOYEE → manager must be 403
  const mgrPaths = ['/manager/dashboard', '/manager/team', '/manager/approvals'];
  if (role === 'EMPLOYEE') {
    for (const mp of mgrPaths) {
      const h = hit[mp];
      if (!h) continue;
      if (h.status === 200) {
        findings.push({
          severity: 'CRITICAL',
          kind: 'AUTHZ_BYPASS',
          detail: `EMPLOYEE got ${h.status} on ${mp} (expected 403)`,
          path: mp,
          status: h.status,
          sample: h.text?.slice(0, 200),
        });
      } else if (h.status !== 403) {
        findings.push({
          severity: 'HIGH',
          kind: 'AUTHZ_UNEXPECTED',
          detail: `EMPLOYEE ${mp} → ${h.status} (expected 403)`,
          path: mp,
          status: h.status,
          sample: h.text?.slice(0, 200),
        });
      }
    }
  }

  // Employees list shouldn't reverse identity — soft
  void empList;

  return {
    meEmail,
    meEmp,
    meUser,
    leavePrefix: bal?.status === 200 ? extractLeaveEmpPrefix(bal.json) : null,
    leaveRefs: reqs?.status === 200 ? extractLeaveRefs(reqs.json) : [],
    notifCount: notif?.status === 200 ? extractNotifIds(notif.json).length : null,
    notifSample: notif?.status === 200 ? extractNotifIds(notif.json).slice(0, 3) : [],
    findings,
  };
}

async function hammerRound(round, tokensByRole) {
  // Build all concurrent GETs for all roles at once
  const jobs = [];
  for (const { role, email } of ROLES) {
    const tok = tokensByRole[role];
    if (!tok?.token) continue;
    const empId = EXPECTED[role].employeeId;
    const paths = [
      '/auth/me',
      '/employees',
      '/leave/requests',
      '/leave/balance',
      '/notifications',
      '/manager/dashboard',
      '/manager/team',
      '/manager/approvals',
    ];
    if (empId) {
      paths.push(`/payroll/employees/${empId}/payslips`);
    } else {
      // SA: probe payroll runs (admin) + a known Priya payslip path to detect leak
      paths.push('/payroll/runs');
      paths.push(`/payroll/employees/${PRIYA_EMP}/payslips`);
    }
    for (const path of paths) {
      jobs.push({ role, email, path, promise: get(path, tok.token, tok.refreshHint) });
    }
  }

  const settled = await Promise.all(jobs.map(async (j) => ({ ...j, result: await j.promise })));

  const byRole = {};
  for (const s of settled) {
    byRole[s.role] ||= { email: s.email, hits: {} };
    byRole[s.role].hits[s.path] = s.result;
  }

  const roundReport = { round, roles: {} };
  for (const { role, email } of ROLES) {
    const block = byRole[role];
    if (!block) {
      roundReport.roles[role] = { email, error: 'no token', findings: [] };
      continue;
    }
    const analysis = analyzeHit(role, email, EXPECTED[role], block.hits);
    const statusSummary = {};
    for (const [p, h] of Object.entries(block.hits)) {
      statusSummary[p] = { status: h.status, ms: h.ms };
    }
    roundReport.roles[role] = {
      email,
      statusSummary,
      analysis,
      peeks: {
        me: block.hits['/auth/me']?.text?.slice(0, 280),
        leaveBalance: block.hits['/leave/balance']?.text?.slice(0, 280),
        leaveRequests: block.hits['/leave/requests']?.text?.slice(0, 280),
        notifications: block.hits['/notifications']?.text?.slice(0, 280),
        managerDash: block.hits['/manager/dashboard']?.text?.slice(0, 200),
      },
    };
  }
  return roundReport;
}

async function main() {
  const started = now();
  const tWall0 = Date.now();
  mkdirSync(__dirname, { recursive: true });

  const loginRounds = [];
  const hammerRounds = [];
  const allFindings = [];

  // Also track set-cookie uniqueness across concurrent logins
  const cookieObservations = [];

  for (let r = 1; r <= ROUNDS; r++) {
    console.error(`[isolation-hammer] round ${r}/${ROUNDS} — parallel login ×4`);
    const loginStart = Date.now();
    const logins = await Promise.all(ROLES.map((x) => login(x.email).then((L) => ({ ...L, role: x.role }))));
    const loginWall = Date.now() - loginStart;

    const tokensByRole = {};
    const loginSummary = [];
    for (const L of logins) {
      tokensByRole[L.role] = L;
      loginSummary.push({
        role: L.role,
        email: L.email,
        status: L.status,
        token: !!L.token,
        ms: L.ms,
        setCookieCount: L.setCookie.length,
        refreshHint: L.refreshHint,
      });
      if (L.setCookie.length) {
        cookieObservations.push({
          round: r,
          role: L.role,
          cookies: L.setCookie.map((c) => c.split(';')[0]),
        });
      }
      if (L.status !== 200 || !L.token) {
        allFindings.push({
          round: r,
          role: L.role,
          severity: 'CRITICAL',
          kind: 'LOGIN_FAIL',
          detail: `login ${L.status} token=${!!L.token}`,
          sample: L.bodyPreview,
        });
      }
    }
    loginRounds.push({ round: r, wallMs: loginWall, logins: loginSummary });

    // Detect cookie value collision across roles in same round
    const cookieVals = {};
    for (const L of logins) {
      for (const c of L.setCookie) {
        const [kv] = c.split(';');
        const eq = kv.indexOf('=');
        if (eq < 0) continue;
        const name = kv.slice(0, eq);
        const val = kv.slice(eq + 1);
        cookieVals[name] ||= {};
        cookieVals[name][val] ||= [];
        cookieVals[name][val].push(L.role);
      }
    }
    for (const [name, byVal] of Object.entries(cookieVals)) {
      for (const [val, roles] of Object.entries(byVal)) {
        if (roles.length > 1) {
          allFindings.push({
            round: r,
            role: roles.join('+'),
            severity: 'CRITICAL',
            kind: 'COOKIE_COLLISION',
            detail: `Same ${name} cookie value issued to ${roles.join(', ')} (val prefix ${val.slice(0, 12)}…)`,
          });
        }
      }
    }

    console.error(`[isolation-hammer] round ${r}/${ROUNDS} — simultaneous sensitive GETs`);
    const hr = await hammerRound(r, tokensByRole);
    hammerRounds.push(hr);

    for (const [role, block] of Object.entries(hr.roles)) {
      for (const f of block.analysis?.findings || []) {
        allFindings.push({ round: r, role, ...f });
      }
    }
  }

  // Cross-round: collect notif id sets per role — check if employee ever saw another's notif ids
  const notifIdsByRole = {};
  for (const hr of hammerRounds) {
    for (const [role, block] of Object.entries(hr.roles)) {
      notifIdsByRole[role] ||= new Set();
      for (const n of block.analysis?.notifSample || []) {
        if (n.id) notifIdsByRole[role].add(n.id);
      }
      // also from peeks? skip
    }
  }
  const rolesList = Object.keys(notifIdsByRole);
  for (let i = 0; i < rolesList.length; i++) {
    for (let j = i + 1; j < rolesList.length; j++) {
      const a = rolesList[i];
      const b = rolesList[j];
      const overlap = [...notifIdsByRole[a]].filter((id) => notifIdsByRole[b].has(id));
      if (overlap.length) {
        allFindings.push({
          round: 'cross',
          role: `${a}/${b}`,
          severity: 'CRITICAL',
          kind: 'NOTIFICATION_ID_OVERLAP',
          detail: `${overlap.length} notification id(s) appeared in both ${a} and ${b} samples: ${overlap.slice(0, 5).join(',')}`,
        });
      }
    }
  }

  // Aggregate status matrix
  const matrix = {}; // role -> path -> {statuses:[], ms:[]}
  for (const hr of hammerRounds) {
    for (const [role, block] of Object.entries(hr.roles)) {
      matrix[role] ||= {};
      for (const [path, st] of Object.entries(block.statusSummary || {})) {
        matrix[role][path] ||= { statuses: [], ms: [] };
        matrix[role][path].statuses.push(st.status);
        matrix[role][path].ms.push(st.ms);
      }
    }
  }

  // SA-10 count
  const sa10 = allFindings.filter((f) => f.kind === 'SA10_LEAVE_LEAK' || f.kind === 'SA10_LEAVE_REQUESTS_LEAK');
  const fivexx = allFindings.filter((f) => f.kind === 'HTTP_5XX' || f.kind === 'NETWORK_ERROR');
  const sessionIssues = allFindings.filter((f) =>
    ['SESSION_CONFUSION', 'COOKIE_COLLISION', 'IDENTITY_MISMATCH'].includes(f.kind),
  );
  const notifLeaks = allFindings.filter((f) =>
    ['NOTIFICATION_CROSS_USER', 'NOTIFICATION_ID_OVERLAP'].includes(f.kind),
  );
  const authz = allFindings.filter((f) => ['AUTHZ_BYPASS', 'AUTHZ_UNEXPECTED'].includes(f.kind));

  const finished = now();
  const wallMs = Date.now() - tWall0;

  const raw = {
    meta: {
      target: BASE,
      api: API,
      tenant: TENANT,
      rounds: ROUNDS,
      started,
      finished,
      wallMs,
      hunt: [
        'wrong employee data (SA leave→Priya SA-10)',
        'notification bodies belonging to other users',
        '500s under concurrency',
        'cookie/session confusion',
      ],
    },
    loginRounds,
    cookieObservations,
    hammerRounds,
    allFindings,
    matrix,
    counts: {
      findings: allFindings.length,
      sa10: sa10.length,
      fivexx: fivexx.length,
      sessionIssues: sessionIssues.length,
      notifLeaks: notifLeaks.length,
      authz: authz.length,
    },
  };

  writeFileSync(join(__dirname, 'raw.json'), JSON.stringify(raw, null, 2));

  // Build RESULTS.md
  const lines = [];
  lines.push('# Isolation Hammer Results');
  lines.push('');
  lines.push(
    `> Target: \`${BASE}\` (API \`${API}\`) · Tenant: \`${TENANT}\` · Rounds: **${ROUNDS}** parallel login×4 + simultaneous sensitive GETs`,
  );
  lines.push(`> Started: ${started} · Finished: ${finished} · Wall: **${wallMs} ms**`);
  lines.push(`> Hunt: wrong-employee (SA-10), notification cross-user, HTTP 500s, cookie/session confusion`);
  lines.push(`> No Render · No migrations · No Playwright`);
  lines.push('');
  lines.push('## Method');
  lines.push('');
  lines.push('1. For each of 5 rounds: login SUPER_ADMIN / HR_ADMIN / MANAGER / EMPLOYEE **in parallel**.');
  lines.push(
    '2. With all 4 tokens live, fire sensitive GETs **simultaneously** across all roles: `/auth/me`, `/employees`, `/leave/requests`, `/leave/balance`, `/notifications`, payroll payslips (own emp id; SA also probes Priya payslips + `/payroll/runs`), `/manager/dashboard|team|approvals` (EMPLOYEE expects **403**).',
  );
  lines.push('3. Compare identity surfaces to expected employeeIds; flag SA leave→Priya, foreign notif userIds, 5xx, cookie collisions.');
  lines.push('');
  lines.push('## Login (5 rounds × 4 roles, parallel)');
  lines.push('');
  lines.push('| Round | Wall (ms) | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |');
  lines.push('|---:|---:|---|---|---|---|');
  for (const lr of loginRounds) {
    const cell = (role) => {
      const L = lr.logins.find((x) => x.role === role);
      return L ? `${L.status}/${L.token ? 'tok' : 'NO-TOK'} ${L.ms}ms` : '—';
    };
    lines.push(
      `| ${lr.round} | ${lr.wallMs} | ${cell('SUPER_ADMIN')} | ${cell('HR_ADMIN')} | ${cell('MANAGER')} | ${cell('EMPLOYEE')} |`,
    );
  }
  lines.push('');
  lines.push('## Status matrix (5 concurrent rounds aggregated)');
  lines.push('');
  for (const role of Object.keys(matrix)) {
    lines.push(`### ${role}`);
    lines.push('');
    lines.push('| Endpoint | Status mix | p50 (ms) | p95 (ms) | min | max |');
    lines.push('|---|---|---:|---:|---:|---:|');
    for (const [path, st] of Object.entries(matrix[role])) {
      lines.push(
        `| \`${path}\` | ${statusMix(st.statuses)} | ${pct(st.ms, 50)} | ${pct(st.ms, 95)} | ${Math.min(...st.ms)} | ${Math.max(...st.ms)} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Isolation verdicts');
  lines.push('');
  lines.push('| Check | Result | Evidence |');
  lines.push('|---|---|---|');
  lines.push(
    `| SA leave → Priya (ISSUE-SA-10) | ${sa10.length ? `**FAIL** ×${sa10.length}` : 'PASS'} | ${sa10.length ? sa10[0].detail : 'no SA leave→Priya findings'} |`,
  );
  lines.push(
    `| Notification cross-user | ${notifLeaks.length ? `**FAIL** ×${notifLeaks.length}` : 'PASS'} | ${notifLeaks.length ? notifLeaks[0].detail : 'no foreign userId / id overlap'} |`,
  );
  lines.push(
    `| HTTP 500 / network under concurrency | ${fivexx.length ? `**FAIL** ×${fivexx.length}` : 'PASS'} | ${fivexx.length ? fivexx[0].detail : '0 × 5xx/network'} |`,
  );
  lines.push(
    `| Cookie / session confusion | ${sessionIssues.length ? `**FAIL** ×${sessionIssues.length}` : 'PASS'} | ${sessionIssues.length ? sessionIssues[0].detail : 'auth/me matched login email every round; no cookie collisions'} |`,
  );
  lines.push(
    `| EMPLOYEE → /manager/* | ${authz.length ? `**FAIL** ×${authz.length}` : 'PASS (403)'} | ${authz.length ? authz[0].detail : 'dashboard/team/approvals all 403×5'} |`,
  );
  lines.push('');

  // Spotlight SA-10
  lines.push('## Spotlight: SA leave → Priya (ISSUE-SA-10)');
  lines.push('');
  const saRounds = hammerRounds.map((hr) => {
    const sa = hr.roles.SUPER_ADMIN?.analysis;
    const emp = hr.roles.EMPLOYEE?.analysis;
    return {
      round: hr.round,
      saMeEmp: sa?.meEmp,
      saLeavePrefix: sa?.leavePrefix,
      saRefs: sa?.leaveRefs,
      empLeavePrefix: emp?.leavePrefix,
      empRefs: emp?.leaveRefs,
      leak: sa?.leavePrefix === PRIYA_EMP,
    };
  });
  lines.push('| Round | SA auth/me.employeeId | SA leave prefix | SA leave refs | EMP leave prefix | Leak? |');
  lines.push('|---:|---|---|---|---|---|');
  for (const row of saRounds) {
    lines.push(
      `| ${row.round} | \`${row.saMeEmp}\` | \`${row.saLeavePrefix}\` | ${ (row.saRefs || []).slice(0, 3).join(', ') || '—' } | \`${row.empLeavePrefix}\` | ${row.leak ? '**YES**' : 'no'} |`,
    );
  }
  lines.push('');
  const leakRounds = saRounds.filter((r) => r.leak).length;
  lines.push(
    `**SA-10 under isolation hammer:** ${leakRounds}/${ROUNDS} rounds leaked Priya prefix \`${PRIYA_EMP}\` on SUPER_ADMIN leave/balance while \`employeeId: null\`.`,
  );
  lines.push('');

  // EMPLOYEE manager 403
  lines.push('## Spotlight: EMPLOYEE → /manager/* (expect 403)');
  lines.push('');
  lines.push('| Round | /manager/dashboard | /manager/team | /manager/approvals |');
  lines.push('|---:|---|---|---|');
  for (const hr of hammerRounds) {
    const ss = hr.roles.EMPLOYEE?.statusSummary || {};
    lines.push(
      `| ${hr.round} | ${ss['/manager/dashboard']?.status ?? '—'} | ${ss['/manager/team']?.status ?? '—'} | ${ss['/manager/approvals']?.status ?? '—'} |`,
    );
  }
  lines.push('');

  // Notifications
  lines.push('## Spotlight: notifications isolation');
  lines.push('');
  lines.push('| Round | Role | /notifications | sample userIds / titles |');
  lines.push('|---:|---|---|---|');
  for (const hr of hammerRounds) {
    for (const role of ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']) {
      const a = hr.roles[role]?.analysis;
      const st = hr.roles[role]?.statusSummary?.['/notifications'];
      const sample = (a?.notifSample || [])
        .map((n) => `${n.userId || '?'}::${(n.title || '').slice(0, 40)}`)
        .join('; ');
      lines.push(`| ${hr.round} | ${role} | ${st?.status ?? '—'} (${a?.notifCount ?? 0} sampled) | ${sample || '—'} |`);
    }
  }
  lines.push('');

  // Findings detail
  lines.push('## All findings');
  lines.push('');
  if (!allFindings.length) {
    lines.push('_No findings._');
  } else {
    // Dedupe by kind+role+detail for readability, keep counts
    const dedup = new Map();
    for (const f of allFindings) {
      const key = `${f.kind}|${f.role}|${f.detail}`;
      const prev = dedup.get(key);
      if (prev) prev.rounds.push(f.round);
      else dedup.set(key, { ...f, rounds: [f.round] });
    }
    lines.push('| Sev | Kind | Role | Rounds | Detail |');
    lines.push('|---|---|---|---|---|');
    for (const f of dedup.values()) {
      lines.push(
        `| ${f.severity} | \`${f.kind}\` | ${f.role} | ${[...new Set(f.rounds)].join(',')} | ${f.detail.replace(/\|/g, '/')} |`,
      );
    }
  }
  lines.push('');

  // Peeks from last round
  const last = hammerRounds[hammerRounds.length - 1];
  lines.push('## Identity peeks (last round)');
  lines.push('');
  for (const role of ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']) {
    const p = last.roles[role]?.peeks || {};
    lines.push(`### ${role}`);
    lines.push('');
    lines.push(`- **auth/me:** \`${(p.me || '').replace(/`/g, "'")}\``);
    lines.push(`- **leave/balance:** \`${(p.leaveBalance || '').replace(/`/g, "'")}\``);
    lines.push(`- **leave/requests:** \`${(p.leaveRequests || '').replace(/`/g, "'")}\``);
    lines.push(`- **notifications:** \`${(p.notifications || '').replace(/`/g, "'")}\``);
    lines.push(`- **manager/dashboard:** \`${(p.managerDash || '').replace(/`/g, "'")}\``);
    lines.push('');
  }

  lines.push('## Summary');
  lines.push('');
  lines.push(`- Wall clock: **${wallMs} ms**`);
  lines.push(`- Login rounds: **${ROUNDS}** × 4 parallel`);
  const totalGets = Object.values(matrix).reduce(
    (acc, paths) => acc + Object.values(paths).reduce((a, st) => a + st.statuses.length, 0),
    0,
  );
  lines.push(`- Sensitive GETs: **${totalGets}**`);
  lines.push(`- Findings total: **${allFindings.length}** (SA-10=${sa10.length}, 5xx=${fivexx.length}, session=${sessionIssues.length}, notif=${notifLeaks.length}, authz=${authz.length})`);
  lines.push(`- Raw JSON: [\`raw.json\`](./raw.json)`);
  lines.push('');

  writeFileSync(join(__dirname, 'RESULTS.md'), lines.join('\n'));
  console.error(`[isolation-hammer] done wall=${wallMs}ms findings=${allFindings.length}`);
  console.log(JSON.stringify({ wallMs, findings: allFindings.length, counts: raw.counts, out: __dirname }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
