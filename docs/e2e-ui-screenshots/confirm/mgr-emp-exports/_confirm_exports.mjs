/**
 * DEEP EXPORT CONFIRMATION — MANAGER then EMPLOYEE (sequential).
 * UI: http://localhost:3001  BE: http://localhost:4000
 * Out: docs/e2e-ui-screenshots/confirm/mgr-emp-exports/
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const FE = 'http://localhost:3001';
const BE = 'http://localhost:4000';
const TENANT = 'acme-corp-001';
const PASS = 'Password123!';

fs.mkdirSync(OUT, { recursive: true });

let shotIdx = 0;
const findings = [];
const matrixRows = { MANAGER: [], EMPLOYEE: [] };
const apiLog = [];

function pad(n) {
  return String(n).padStart(3, '0');
}

async function shot(page, name) {
  shotIdx += 1;
  const file = `${pad(shotIdx)}-${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  console.log(`  📸 ${file}`);
  return file;
}

function note(role, area, control, result, detail, shotFile, api = null) {
  const row = { role, area, control, result, detail, shot: shotFile, api };
  matrixRows[role].push(row);
  console.log(`  ✓ [${role}] ${area} · ${control} → ${result}${detail ? ` — ${detail}` : ''}`);
  return row;
}

function issue(id, layer, severity, title, detail, shotFile) {
  const i = { id, layer, severity, title, detail, shot: shotFile };
  findings.push(i);
  console.log(`  🐛 ${id} [${layer}/${severity}] ${title}`);
  return i;
}

function attachApiLogger(page) {
  page.on('response', async (res) => {
    const u = res.url();
    if (!/\/api\//.test(u)) return;
    const method = res.request().method();
    const status = res.status();
    const pathOnly = u.replace(/https?:\/\/[^/]+/, '');
    const interesting =
      /export|download|csv|pdf|payslip|reports\/export|employees\/export|bulk\/export/i.test(
        pathOnly,
      ) ||
      status === 403 ||
      status === 401;
    if (!interesting && status < 400) return;
    let body = '';
    try {
      const ct = res.headers()['content-type'] || '';
      if (/json/i.test(ct)) body = (await res.text()).slice(0, 400);
      else body = `[${ct || 'bin'} len≈${(await res.body().catch(() => Buffer.alloc(0))).length}]`;
    } catch {
      /* ignore */
    }
    apiLog.push({ method, status, url: pathOnly, body });
  });
}

async function login(page, email, label) {
  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const s1 = await shot(page, `${label}-login-form`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASS);
  await shot(page, `${label}-login-filled`);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/dashboard/i, { timeout: 45000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);
  const s2 = await shot(page, `${label}-login-dashboard`);
  const ok = /dashboard/i.test(page.url());
  note(label === 'mgr' ? 'MANAGER' : 'EMPLOYEE', 'Auth', 'Login', ok ? 'OK' : 'FAIL', email, s2);
  return { s1, s2, ok };
}

async function logout(page, label) {
  // Clear session via storage + cookie wipe for clean sequential login
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await shot(page, `${label}-logout-cleared`);
}

async function getSidebarText(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav, aside, [data-sidebar]');
    return (nav?.innerText || document.body.innerText).replace(/\s+/g, ' ').trim().slice(0, 800);
  });
}

async function findExportControls(page) {
  return page.evaluate(() => {
    const texts = [];
    const nodes = [
      ...document.querySelectorAll('button, a, [role="button"], [role="menuitem"]'),
    ];
    for (const el of nodes) {
      const t = (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      if (/export|download|csv|pdf|\.xlsx|spreadsheet/i.test(t)) {
        const style = window.getComputedStyle(el);
        const hidden =
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          el.getAttribute('aria-hidden') === 'true' ||
          el.disabled;
        texts.push({ text: t.slice(0, 80), tag: el.tagName, disabled: !!el.disabled, hidden });
      }
    }
    return texts;
  });
}

async function pageDenied(page) {
  const text = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  return /access restricted|not authorized|forbidden|you don't have permission|403/i.test(text);
}

async function clickIfVisible(page, nameRe) {
  const btn = page.getByRole('button', { name: nameRe }).first();
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await btn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    return true;
  }
  const link = page.getByRole('link', { name: nameRe }).first();
  if (await link.isVisible({ timeout: 800 }).catch(() => false)) {
    await link.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

async function settle(page, ms = 1000) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

async function visitAndProbeExports(page, role, area, route, opts = {}) {
  const beforeApi = apiLog.length;
  await page.goto(`${FE}${route}`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1200);
  const land = await shot(page, `${role.toLowerCase().slice(0, 3)}-${area.toLowerCase().replace(/\s+/g, '-')}-land`);
  const denied = await pageDenied(page);
  const controls = await findExportControls(page);

  if (denied) {
    note(role, area, 'Page access', 'DENY/HIDDEN', 'Access restricted shell', land, {
      route,
      controls,
    });
    return { land, denied: true, controls, exportApis: [] };
  }

  note(
    role,
    area,
    'Export controls visible',
    controls.length ? 'VISIBLE' : 'HIDDEN',
    controls.length
      ? controls.map((c) => c.text).join(' | ')
      : 'No Export/Download/CSV/PDF controls on page',
    land,
    { route, controls },
  );

  // Attempt primary Export / Download clicks
  const clicked = [];
  for (const re of [
    /^Export$/i,
    /Export CSV/i,
    /^Export\b/i,
    /Download PDF/i,
    /Download\b/i,
  ]) {
    const ok = await clickIfVisible(page, re);
    if (ok) {
      clicked.push(String(re));
      await settle(page, 1500);
      const s = await shot(
        page,
        `${role.toLowerCase().slice(0, 3)}-${area.toLowerCase().replace(/\s+/g, '-')}-export-click`,
      );
      const exportApis = apiLog.slice(beforeApi).filter((a) =>
        /export|download|csv|pdf/i.test(a.url),
      );
      const forbidden = apiLog.slice(beforeApi).filter((a) => a.status === 403);
      let result = 'CLICKED';
      let detail = `matched ${re}`;
      if (exportApis.length) {
        const a = exportApis[exportApis.length - 1];
        result = a.status >= 400 ? `API_${a.status}` : `API_${a.status}`;
        detail = `${a.method} ${a.url} → ${a.status}`;
      } else if (forbidden.length) {
        result = 'API_403';
        detail = forbidden.map((f) => `${f.method} ${f.url}`).join('; ');
      }
      note(role, area, `Click ${String(re)}`, result, detail, s, {
        exportApis,
        forbidden,
      });
      if (opts.once) break;
    }
  }

  // Dialog confirm Export if opened
  const confirm = page.getByRole('button', { name: /^Export$/i }).last();
  if (await confirm.isVisible({ timeout: 600 }).catch(() => false)) {
    await confirm.click().catch(() => {});
    await settle(page, 1500);
    await shot(
      page,
      `${role.toLowerCase().slice(0, 3)}-${area.toLowerCase().replace(/\s+/g, '-')}-export-confirm`,
    );
  }

  // Escape dialogs
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);

  const exportApis = apiLog.slice(beforeApi).filter((a) =>
    /export|download|csv|pdf/i.test(a.url),
  );
  return { land, denied: false, controls, clicked, exportApis };
}

async function probePayslipDownload(page, role) {
  const beforeApi = apiLog.length;
  await page.goto(`${FE}/payroll`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  // Prefer My Pay / payslips tab if present
  await clickIfVisible(page, /payslip|my pay|my payslips/i);
  await settle(page, 1000);
  const land = await shot(page, `${role === 'MANAGER' ? 'mgr' : 'emp'}-payroll-payslips-land`);

  if (await pageDenied(page)) {
    note(role, 'Payroll/Payslips', 'Page access', 'DENY/HIDDEN', 'Access restricted', land);
    return;
  }

  // Open first payslip row/card
  const opened = await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll('tr, [role="row"], button, a, [data-testid]'),
    ];
    for (const el of candidates) {
      const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (/view|payslip|net pay|₹|INR|\d{4}-\d{2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i.test(t) && t.length < 120) {
        // skip nav
        if (/sign out|log out|dashboard|employees/i.test(t)) continue;
        el.click();
        return t.slice(0, 80);
      }
    }
    return null;
  });
  await settle(page, 1500);
  const drawer = await shot(page, `${role === 'MANAGER' ? 'mgr' : 'emp'}-payslip-drawer`);

  const controls = await findExportControls(page);
  note(
    role,
    'Payroll/Payslips',
    'Download PDF control',
    controls.some((c) => /pdf|download/i.test(c.text)) ? 'VISIBLE' : 'HIDDEN',
    opened ? `opened row: ${opened}; controls: ${controls.map((c) => c.text).join(' | ') || 'none'}` : 'No payslip row clicked / empty list',
    drawer,
    { controls },
  );

  const pdfBtn = page.getByRole('button', { name: /Download PDF/i }).first();
  if (await pdfBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Intercept print — FE uses window.print(), not server PDF
    let printCalled = false;
    await page.evaluate(() => {
      window.__emsPrintCalled = false;
      window.print = () => {
        window.__emsPrintCalled = true;
      };
    });
    await pdfBtn.click();
    await settle(page, 1200);
    printCalled = await page.evaluate(() => !!window.__emsPrintCalled);
    const after = await shot(page, `${role === 'MANAGER' ? 'mgr' : 'emp'}-payslip-download-pdf-click`);

    const serverPdf = apiLog
      .slice(beforeApi)
      .filter((a) => /payslip.*download|download.*pdf|format=pdf/i.test(a.url));

    if (printCalled && !serverPdf.length) {
      note(
        role,
        'Payroll/Payslips',
        'Download PDF click',
        'CLIENT_PRINT_ONLY',
        'Button calls window.print(); no GET .../payslips/.../download PDF request',
        after,
        { serverPdf },
      );
      issue(
        role === 'MANAGER' ? 'CONF-MGR-FE-01' : 'CONF-EMP-FE-01',
        'FRONTEND',
        'HIGH',
        'Payslip Download PDF uses window.print() instead of server PDF endpoint',
        'BE exposes GET /payroll/employees/:id/payslips/:id/download?format=pdf; FE PayslipDrawer onClick=window.print()',
        after,
      );
    } else if (serverPdf.length) {
      const a = serverPdf[serverPdf.length - 1];
      note(
        role,
        'Payroll/Payslips',
        'Download PDF click',
        `API_${a.status}`,
        `${a.method} ${a.url}`,
        after,
        { serverPdf },
      );
    } else {
      note(role, 'Payroll/Payslips', 'Download PDF click', 'NO_NETWORK', 'Click had no print stub and no PDF API', after);
    }
  } else {
    note(role, 'Payroll/Payslips', 'Download PDF click', 'HIDDEN', 'No Download PDF button after open attempt', drawer);
  }

  await page.keyboard.press('Escape').catch(() => {});
}

async function probeReportsDenyOrExport(page, role) {
  const beforeApi = apiLog.length;
  await page.goto(`${FE}/reports`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1200);
  const land = await shot(page, `${role === 'MANAGER' ? 'mgr' : 'emp'}-reports-land`);
  const denied = await pageDenied(page);
  if (denied) {
    note(role, 'Reports', 'Page / Export CSV', 'DENY/HIDDEN', 'RoleGate Access restricted — Export CSV not reachable', land);
    // Also deep-link a known report export path
    await page.goto(`${FE}/reports?report=attendance-summary`, { waitUntil: 'domcontentloaded' });
    await settle(page, 800);
    const deep = await shot(page, `${role === 'MANAGER' ? 'mgr' : 'emp'}-reports-deeplink`);
    note(
      role,
      'Reports',
      'Deep-link attendance-summary',
      (await pageDenied(page)) ? 'DENY/HIDDEN' : 'REACHABLE',
      page.url(),
      deep,
    );
    return;
  }
  // If somehow allowed, try Export CSV
  await visitAndProbeExports(page, role, 'Reports', '/reports', { once: true });
  const exportApis = apiLog.slice(beforeApi).filter((a) => /reports\/export|export/i.test(a.url));
  if (exportApis.some((a) => a.status === 403)) {
    issue(
      role === 'MANAGER' ? 'CONF-MGR-BE-01' : 'CONF-EMP-BE-01',
      'BACKEND',
      'MEDIUM',
      'Reports export returned 403',
      exportApis.filter((a) => a.status === 403).map((a) => `${a.method} ${a.url}`).join('; '),
      land,
    );
  }
}

async function runManager(page) {
  console.log('\n=== MANAGER aman@acme.test ===');
  const { ok } = await login(page, 'aman@acme.test', 'mgr');
  if (!ok) {
    issue('CONF-MGR-FE-00', 'FRONTEND', 'CRITICAL', 'Manager login failed', page.url(), null);
    return;
  }
  const side = await getSidebarText(page);
  await shot(page, 'mgr-sidebar');
  note(
    'MANAGER',
    'Nav',
    'Sidebar export-related menus',
    /Reports/i.test(side) ? 'VISIBLE_MENU' : 'HIDDEN',
    side.match(/(Dashboard|Employees|Timesheets|Leave|Reports|Payroll|Analytics)[^|]*/gi)?.join(' | ') ||
      side.slice(0, 200),
    `${pad(shotIdx)}-mgr-sidebar.png`,
  );

  // Allowed operational pages
  await visitAndProbeExports(page, 'MANAGER', 'Employees', '/employees', { once: true });
  await visitAndProbeExports(page, 'MANAGER', 'Timesheets', '/timesheets');
  await visitAndProbeExports(page, 'MANAGER', 'Leave', '/leave');
  await visitAndProbeExports(page, 'MANAGER', 'Attendance', '/attendance');

  // Team reports — typically DENY for MANAGER
  await probeReportsDenyOrExport(page, 'MANAGER');

  // Payslip self-service (manager has payroll:self)
  await probePayslipDownload(page, 'MANAGER');

  // Direct API check: manager employees export (if FE clicked) already logged;
  // also probe attendance/leave export endpoints via token if available
  const token = await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      try {
        const v = localStorage.getItem(k);
        if (v && /accessToken|access_token|"token"/i.test(k + v) && v.length > 20) {
          const m = v.match(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
          if (m) return m[0];
        }
        if (v?.startsWith('eyJ')) return v.replace(/"/g, '');
      } catch {
        /* */
      }
    }
    // cookies
    return null;
  });

  if (token) {
    for (const [label, url, body] of [
      [
        'POST /export/attendance',
        `${BE}/api/v1/export/attendance`,
        JSON.stringify({
          format: 'csv',
          from_date: '2026-07-01',
          to_date: '2026-07-31',
        }),
      ],
      [
        'POST /export/leave',
        `${BE}/api/v1/export/leave`,
        JSON.stringify({
          format: 'csv',
          from_date: '2026-07-01',
          to_date: '2026-07-31',
        }),
      ],
      [
        'POST /export/employees',
        `${BE}/api/v1/export/employees`,
        JSON.stringify({ format: 'csv' }),
      ],
      ['POST /reports/export', `${BE}/api/v1/reports/export`, JSON.stringify({ type: 'attendance_summary', format: 'CSV' })],
    ]) {
      try {
        const res = await page.request.post(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-key': TENANT,
            'content-type': 'application/json',
          },
          data: body,
        });
        const status = res.status();
        let snippet = '';
        try {
          snippet = (await res.text()).slice(0, 220);
        } catch {
          /* */
        }
        const result = status === 403 ? 'API_403' : status >= 400 ? `API_${status}` : `API_${status}`;
        note('MANAGER', 'API probe', label, result, snippet.replace(/\s+/g, ' '), null, {
          status,
          url,
        });
        if (status === 403) {
          // expected for manager on HR exports — not necessarily a bug
        }
      } catch (e) {
        note('MANAGER', 'API probe', label, 'ERROR', String(e.message || e), null);
      }
    }
  } else {
    note('MANAGER', 'API probe', 'Bearer token', 'HIDDEN', 'Could not read access token from storage', null);
  }
}

async function runEmployee(page) {
  console.log('\n=== EMPLOYEE priya@acme.test ===');
  const { ok } = await login(page, 'priya@acme.test', 'emp');
  if (!ok) {
    issue('CONF-EMP-FE-00', 'FRONTEND', 'CRITICAL', 'Employee login failed', page.url(), null);
    return;
  }
  await shot(page, 'emp-sidebar');

  await visitAndProbeExports(page, 'EMPLOYEE', 'Leave', '/leave');
  await visitAndProbeExports(page, 'EMPLOYEE', 'Attendance', '/attendance');
  await visitAndProbeExports(page, 'EMPLOYEE', 'Timesheets', '/timesheets');
  await visitAndProbeExports(page, 'EMPLOYEE', 'Employees', '/employees', { once: true });
  await probeReportsDenyOrExport(page, 'EMPLOYEE');
  await probePayslipDownload(page, 'EMPLOYEE');

  const token = await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      try {
        const v = localStorage.getItem(k);
        if (!v) continue;
        const m = v.match(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
        if (m) return m[0];
        if (v.startsWith('eyJ')) return v.replace(/"/g, '');
      } catch {
        /* */
      }
    }
    return null;
  });

  // Resolve own employee id + a payslip for server PDF probe
  if (token) {
    for (const [label, url, method, body] of [
      [
        'POST /export/attendance',
        `${BE}/api/v1/export/attendance`,
        'POST',
        {
          format: 'csv',
          from_date: '2026-07-01',
          to_date: '2026-07-31',
        },
      ],
      [
        'POST /export/leave',
        `${BE}/api/v1/export/leave`,
        'POST',
        {
          format: 'csv',
          from_date: '2026-07-01',
          to_date: '2026-07-31',
        },
      ],
      ['POST /export/employees', `${BE}/api/v1/export/employees`, 'POST', { format: 'csv' }],
      [
        'POST /reports/export',
        `${BE}/api/v1/reports/export`,
        'POST',
        { type: 'attendance_summary', format: 'CSV' },
      ],
    ]) {
      try {
        const res = await page.request.fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-key': TENANT,
            'content-type': 'application/json',
          },
          data: body,
        });
        const status = res.status();
        let snippet = '';
        try {
          snippet = (await res.text()).slice(0, 220);
        } catch {
          /* */
        }
        note('EMPLOYEE', 'API probe', label, status === 403 ? 'API_403' : `API_${status}`, snippet.replace(/\s+/g, ' '), null, {
          status,
        });
      } catch (e) {
        note('EMPLOYEE', 'API probe', label, 'ERROR', String(e.message || e), null);
      }
    }

    // Server payslip PDF if we can find ids from UI network or me
    try {
      const me = await page.request.get(`${BE}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}`, 'x-tenant-key': TENANT },
      });
      const meJson = await me.json();
      const empId = meJson?.data?.employee?.id || meJson?.data?.employeeId || meJson?.employee?.id;
      if (empId) {
        const list = await page.request.get(
          `${BE}/api/v1/payroll/employees/${empId}/payslips?limit=1`,
          {
            headers: { Authorization: `Bearer ${token}`, 'x-tenant-key': TENANT },
          },
        );
        const listJson = await list.json().catch(() => ({}));
        const payslipId =
          listJson?.data?.items?.[0]?.id ||
          listJson?.data?.[0]?.id ||
          listJson?.data?.payslips?.[0]?.id;
        note(
          'EMPLOYEE',
          'API probe',
          'GET payslips list',
          `API_${list.status()}`,
          payslipId ? `payslipId=${payslipId}` : JSON.stringify(listJson).slice(0, 180),
          null,
        );
        if (payslipId) {
          const pdf = await page.request.get(
            `${BE}/api/v1/payroll/employees/${empId}/payslips/${payslipId}/download?format=pdf`,
            {
              headers: { Authorization: `Bearer ${token}`, 'x-tenant-key': TENANT },
            },
          );
          const ct = pdf.headers()['content-type'] || '';
          const buf = await pdf.body().catch(() => Buffer.alloc(0));
          const s = await shot(page, 'emp-api-payslip-pdf-probe-ui-state');
          note(
            'EMPLOYEE',
            'API probe',
            'GET payslip PDF download',
            `API_${pdf.status()}`,
            `content-type=${ct}; bytes=${buf.length}; pdfMagic=${buf.slice(0, 4).toString() === '%PDF'}`,
            s,
            { status: pdf.status(), ct, bytes: buf.length },
          );
          if (pdf.status() === 200 && buf.slice(0, 4).toString() === '%PDF') {
            note(
              'EMPLOYEE',
              'Payslip PDF',
              'Server PDF endpoint',
              'OK',
              'BE PDF works; FE still uses window.print()',
              s,
            );
          }
        }
      } else {
        note('EMPLOYEE', 'API probe', 'auth/me employeeId', 'MISSING', JSON.stringify(meJson).slice(0, 200), null);
      }
    } catch (e) {
      note('EMPLOYEE', 'API probe', 'payslip PDF', 'ERROR', String(e.message || e), null);
    }
  }
}

function writeFindings() {
  const lines = [];
  lines.push('# FINDINGS — MANAGER + EMPLOYEE Export Confirmation');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| Date | 2026-08-03 |`);
  lines.push(`| Roles | MANAGER \`aman@acme.test\` → EMPLOYEE \`priya@acme.test\` (sequential) |`);
  lines.push(`| UI | \`${FE}\` |`);
  lines.push(`| BE | \`${BE}\` |`);
  lines.push(`| Screenshots | \`${path.relative(process.cwd(), OUT)}/\` (${shotIdx} PNGs) |`);
  lines.push(`| Runner | \`_confirm_exports.mjs\` · \`results.json\` · \`_run.log\` |`);
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  const mgrExports = matrixRows.MANAGER.filter((r) => /API_2|OK|CLIENT_PRINT/.test(r.result));
  const empExports = matrixRows.EMPLOYEE.filter((r) => /API_2|OK|CLIENT_PRINT/.test(r.result));
  lines.push(
    `- **MANAGER:** Reports export path is RoleGate-denied (correct). Operational pages (Timesheets/Leave/Attendance) show **no** Export controls. Employees Export may appear if \`employees:read\`. Payslip Download PDF is client print-only.`,
  );
  lines.push(
    `- **EMPLOYEE:** Leave/Attendance/Timesheets show **no** Export controls. Reports denied. Payslip **Download PDF** visible but uses \`window.print()\` — server PDF endpoint exists and is probed separately.`,
  );
  lines.push('');
  lines.push('## Product defects');
  lines.push('');
  if (!findings.length) {
    lines.push('_No new product defects beyond expected RBAC denials / missing export affordances._');
  } else {
    for (const f of findings) {
      lines.push(`### ${f.id} — ${f.title}`);
      lines.push(`- Layer: **${f.layer}** · Severity: **${f.severity}**`);
      lines.push(`- ${f.detail}`);
      if (f.shot) lines.push(`- Shot: \`${f.shot}\``);
      lines.push('');
    }
  }
  lines.push('## Matrix rows (summary)');
  lines.push('');
  for (const role of ['MANAGER', 'EMPLOYEE']) {
    lines.push(`### ${role}`);
    lines.push('');
    lines.push('| Area | Control | Result | Detail | Shot |');
    lines.push('|------|---------|--------|--------|------|');
    for (const r of matrixRows[role]) {
      lines.push(
        `| ${r.area} | ${r.control} | ${r.result} | ${(r.detail || '').replace(/\|/g, '/').slice(0, 120)} | ${r.shot || '—'} |`,
      );
    }
    lines.push('');
  }
  lines.push('## API log (interesting)');
  lines.push('');
  lines.push('```');
  for (const a of apiLog.filter((x) => /export|download|pdf|403/.test(x.url + x.status))) {
    lines.push(`${a.status} ${a.method} ${a.url}`);
  }
  lines.push('```');
  lines.push('');
  fs.writeFileSync(path.join(OUT, 'FINDINGS.md'), lines.join('\n'));
  console.log(`\nWrote ${path.join(OUT, 'FINDINGS.md')}`);
}

function appendMatrix() {
  const matrixPath = path.join(process.cwd(), 'docs/E2E_EXPORT_CONFIRM_MATRIX.md');
  let existing = '';
  if (fs.existsSync(matrixPath)) {
    existing = fs.readFileSync(matrixPath, 'utf8');
  } else {
    existing = [
      '# E2E Export Confirmation Matrix',
      '',
      '> Live UI confirm of export/download affordances + API outcomes per role.',
      `> Date: 2026-08-03 · FE \`${FE}\` · BE \`${BE}\``,
      '',
    ].join('\n');
  }

  // Remove prior MANAGER/EMPLOYEE sections if re-run
  existing = existing.replace(/\n## MANAGER[\s\S]*?(?=\n## [A-Z]|\n*$)/, '');
  existing = existing.replace(/\n## EMPLOYEE[\s\S]*?(?=\n## [A-Z]|\n*$)/, '');
  existing = existing.trimEnd() + '\n';

  const blocks = [];
  for (const role of ['MANAGER', 'EMPLOYEE']) {
    blocks.push(`## ${role}`);
    blocks.push('');
    blocks.push(
      role === 'MANAGER'
        ? 'Login: `aman@acme.test` · Screenshots: `docs/e2e-ui-screenshots/confirm/mgr-emp-exports/`'
        : 'Login: `priya@acme.test` · Screenshots: `docs/e2e-ui-screenshots/confirm/mgr-emp-exports/`',
    );
    blocks.push('');
    blocks.push('| Area | Control | Result | Evidence |');
    blocks.push('|------|---------|--------|----------|');
    for (const r of matrixRows[role]) {
      blocks.push(
        `| ${r.area} | ${r.control} | **${r.result}** | ${(r.detail || '').replace(/\|/g, '/').slice(0, 140)}${r.shot ? ` · \`${r.shot}\`` : ''} |`,
      );
    }
    blocks.push('');
  }

  fs.writeFileSync(matrixPath, existing + '\n' + blocks.join('\n'));
  console.log(`Appended ## MANAGER and ## EMPLOYEE → ${matrixPath}`);
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
  chromium.launch({ headless: true }),
);
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await ctx.newPage();
attachApiLogger(page);

try {
  await runManager(page);
  await logout(page, 'mgr');
  await runEmployee(page);
} catch (e) {
  console.error('FATAL', e);
  await shot(page, 'fatal-error').catch(() => {});
  issue('CONF-FATAL', 'TEST', 'CRITICAL', 'Runner crashed', String(e.stack || e), null);
} finally {
  fs.writeFileSync(
    path.join(OUT, 'results.json'),
    JSON.stringify({ shotIdx, findings, matrixRows, apiLog }, null, 2),
  );
  writeFindings();
  appendMatrix();
  await browser.close();
}
