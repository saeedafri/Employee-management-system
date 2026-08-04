/**
 * DEEP UI STRESS — Notification bell/drawer · all 4 roles
 * FE http://localhost:3001 · BE http://localhost:4000 · tenant acme-corp-001
 * Roles: superadmin, hr, aman, priya @acme.test / Password123!
 *
 * Per role: open bell, list, click item, mark one read, mark all read,
 * pagination/filter probes, rapid open/close ×10, badge vs GET unread-count.
 * Shots → docs/e2e-ui-screenshots/stress/notifications-ui/
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const BE = process.env.BE_BASE || 'http://localhost:4000';
const API = `${BE}/api/v1`;
const TENANT = 'acme-corp-001';
const SHOT =
  process.env.SHOT_DIR ||
  '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/e2e-ui-screenshots/stress/notifications-ui';
const PASS = 'Password123!';

const ROLES = [
  { key: 'sa', role: 'SUPER_ADMIN', email: 'superadmin@acme.test' },
  { key: 'hr', role: 'HR_ADMIN', email: 'hr@acme.test' },
  { key: 'mgr', role: 'MANAGER', email: 'aman@acme.test' },
  { key: 'emp', role: 'EMPLOYEE', email: 'priya@acme.test' },
];

fs.mkdirSync(SHOT, { recursive: true });
for (const f of fs.readdirSync(SHOT)) {
  if (f.endsWith('.png') || ['results.json', 'FINDINGS.md'].includes(f)) {
    fs.unlinkSync(path.join(SHOT, f));
  }
}

let shotIdx = 0;
const screenshots = [];
const findings = [];
const roleResults = [];
const seen = new Set();

function slug(s) {
  return String(s || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 56);
}

function persist() {
  fs.writeFileSync(
    path.join(SHOT, 'results.json'),
    JSON.stringify(
      {
        mode: 'NOTIF-UI-STRESS',
        fe: FE,
        be: BE,
        tenant: TENANT,
        shotCount: shotIdx,
        findings,
        roleResults,
        screenshots,
        ts: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

function note(issue) {
  const key = `${issue.layer}|${issue.where}|${String(issue.why).slice(0, 100)}`;
  if (seen.has(key)) return;
  seen.add(key);
  findings.push({ ...issue, ts: new Date().toISOString() });
  console.log(
    `  🐛 [${issue.severity}][${issue.layer}] ${issue.where}: ${String(issue.why).slice(0, 160)}`,
  );
  persist();
}

async function shot(page, name) {
  shotIdx += 1;
  const file = `${String(shotIdx).padStart(3, '0')}-${slug(name)}.png`;
  await page.screenshot({ path: path.join(SHOT, file), fullPage: false }).catch(() => {});
  screenshots.push({ file, url: page.url(), name });
  console.log(`  📸 ${file}`);
  persist();
  return file;
}

async function loginApi(email) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT,
    },
    body: JSON.stringify({ email, password: PASS }),
  });
  const json = await res.json().catch(() => ({}));
  const token = json?.data?.accessToken || json?.data?.tokens?.accessToken || json?.accessToken;
  return { status: res.status, token, body: json };
}

async function getUnreadCountApi(token) {
  const res = await fetch(`${API}/notifications/unread-count`, {
    headers: {
      authorization: `Bearer ${token}`,
      'x-tenant-key': TENANT,
    },
  });
  const json = await res.json().catch(() => ({}));
  const count =
    json?.data?.count ??
    json?.data?.unreadCount ??
    json?.count ??
    null;
  return { status: res.status, count, body: json };
}

async function listNotificationsApi(token, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}/notifications${qs ? `?${qs}` : ''}`, {
    headers: {
      authorization: `Bearer ${token}`,
      'x-tenant-key': TENANT,
    },
  });
  const json = await res.json().catch(() => ({}));
  const list = json?.data?.notifications || json?.data?.items || json?.data || [];
  const arr = Array.isArray(list) ? list : [];
  return {
    status: res.status,
    notifications: arr,
    unreadInPage: arr.filter((n) => n.isRead === false || n.read === false).length,
    meta: json?.data?.meta || json?.meta || null,
    bodySlice: JSON.stringify(json).slice(0, 400),
  };
}

async function settle(page, ms = 700) {
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function dismiss(page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(80);
  }
}

function bellLoc(page) {
  return page.locator('button[aria-label*="otif" i], button[aria-label*="Bell" i]').first();
}

async function openBell(page) {
  const bell = bellLoc(page);
  if (!(await bell.isVisible({ timeout: 3000 }).catch(() => false))) {
    // fallback: header icon buttons near end
    const btns = page.locator('header button, [data-testid="app-header"] button');
    const n = await btns.count();
    for (let i = Math.max(0, n - 12); i < n; i++) {
      const al = ((await btns.nth(i).getAttribute('aria-label').catch(() => '')) || '').toLowerCase();
      if (/notif|bell/.test(al)) {
        await btns.nth(i).click().catch(() => {});
        await page.waitForTimeout(400);
        return true;
      }
    }
    return false;
  }
  const expanded = await bell.getAttribute('aria-expanded').catch(() => null);
  if (expanded === 'true') return true;
  await bell.click().catch(() => {});
  await page.waitForTimeout(450);
  return true;
}

async function closeBell(page) {
  const bell = bellLoc(page);
  const expanded = await bell.getAttribute('aria-expanded').catch(() => null);
  if (expanded === 'true') {
    await bell.click().catch(() => {});
    await page.waitForTimeout(200);
  } else {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
  }
}

async function readBadge(page) {
  return page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /notif/i.test(b.getAttribute('aria-label') || ''),
    );
    if (!btn) return { found: false, aria: null, badgeText: null, badgeVisible: false };
    const aria = btn.getAttribute('aria-label') || '';
    const m = aria.match(/(\d+)\s*unread/i);
    const badge = btn.querySelector('span.rounded-full, span[aria-hidden]');
    // Prefer the small absolute badge span
    let badgeText = null;
    const spans = [...btn.querySelectorAll('span')];
    for (const s of spans) {
      const t = (s.textContent || '').trim();
      if (/^\d+\+?$/.test(t) || t === '9+') {
        badgeText = t;
        break;
      }
    }
    return {
      found: true,
      aria,
      ariaUnread: m ? Number(m[1]) : 0,
      badgeText,
      badgeVisible: !!badgeText,
    };
  });
}

async function drawerState(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label*="otif" i]');
    if (!dialog) {
      // also try visible popover with Notifications header
      const headers = [...document.querySelectorAll('div')].filter((d) =>
        /^Notifications$/i.test((d.textContent || '').trim()) && d.children.length < 5,
      );
      return { open: false, empty: null, itemCount: 0, hasMarkAll: false, hasUnreadFilter: false, hasPagination: false, text: '' };
    }
    const text = (dialog.innerText || '').replace(/\s+/g, ' ').trim();
    const items = [...dialog.querySelectorAll('button')].filter((b) => {
      const t = (b.innerText || '').trim();
      return t && !/mark all/i.test(t) && !/^notifications$/i.test(t);
    });
    const hasMarkAll = /mark all as read|mark all read/i.test(text);
    const hasUnreadFilter = /unread only|show unread|filter.*unread/i.test(text);
    const hasPagination =
      /next|previous|page\s*\d|load more/i.test(text) ||
      !!dialog.querySelector('[aria-label*="next" i], [aria-label*="page" i]');
    const empty = /all caught up|no notifications|nothing here/i.test(text);
    const skeleton =
      !!dialog.querySelector('[class*="skeleton" i], .animate-pulse') ||
      /loading/i.test(text);
    return {
      open: true,
      empty,
      itemCount: items.length,
      hasMarkAll,
      hasUnreadFilter,
      hasPagination,
      skeleton,
      text: text.slice(0, 500),
      itemTitles: items.slice(0, 8).map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80)),
    };
  });
}

async function loginUi(page, email) {
  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((tk) => {
    try {
      localStorage.setItem('tenantKey', tk);
      localStorage.setItem('x-tenant-key', tk);
    } catch {}
  }, TENANT);
  await page.waitForTimeout(400);
  await page.fill('input[type="email"],#email,input[name="email"]', email);
  await page.fill('input[type="password"],#password,input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 45000 });
  await settle(page, 1200);
}

async function runRole(browser, roleDef) {
  const { key, role, email } = roleDef;
  console.log(`\n======== ${role} (${email}) ========`);
  const result = {
    key,
    role,
    email,
    badge: null,
    apiUnread: null,
    listApi: null,
    mismatch: false,
    drawer: null,
    markOne: null,
    markAll: null,
    rapid: null,
    filterUnread: null,
    pagination: null,
    consoleErrors: [],
    apiFails: [],
    shots: [],
  };

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    baseURL: FE,
  });
  await ctx.addInitScript((tk) => {
    localStorage.setItem('tenantKey', tk);
    localStorage.setItem('x-tenant-key', tk);
  }, TENANT);

  const page = await ctx.newPage();
  const apiLog = [];
  const consoleLog = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleLog.push(msg.text().slice(0, 300));
      result.consoleErrors.push(msg.text().slice(0, 300));
    }
  });
  page.on('pageerror', (err) => {
    consoleLog.push(`PAGEERROR: ${err.message}`.slice(0, 300));
    result.consoleErrors.push(`PAGEERROR: ${err.message}`.slice(0, 300));
  });
  page.on('response', async (res) => {
    const u = res.url();
    if (!/\/api\//.test(u)) return;
    let body = '';
    try {
      body = (await res.text()).slice(0, 280);
    } catch {}
    const entry = {
      status: res.status(),
      method: res.request().method(),
      url: u.replace(/https?:\/\/[^/]+/, ''),
      body,
    };
    apiLog.push(entry);
    if (entry.status >= 400 && !/\/auth\/(me|refresh)/.test(entry.url)) {
      result.apiFails.push(entry);
    }
  });

  // API baseline before UI mutations
  const auth = await loginApi(email);
  if (auth.status !== 200 || !auth.token) {
    note({
      severity: 'CRITICAL',
      layer: 'BACKEND',
      where: `${role} API login`,
      why: `login ${auth.status}`,
      screenshot: null,
      network: `POST /auth/login ${auth.status}`,
    });
    result.apiUnread = { error: 'login failed', status: auth.status };
    roleResults.push(result);
    await ctx.close();
    return result;
  }
  const unreadApi = await getUnreadCountApi(auth.token);
  const listApi = await listNotificationsApi(auth.token, { limit: '20' });
  const listUnreadOnly = await listNotificationsApi(auth.token, {
    unreadOnly: 'true',
    limit: '20',
  });
  result.apiUnread = unreadApi;
  result.listApi = {
    status: listApi.status,
    count: listApi.notifications.length,
    unreadInPage: listApi.unreadInPage,
    meta: listApi.meta,
  };
  result.filterUnread = {
    apiStatus: listUnreadOnly.status,
    count: listUnreadOnly.notifications.length,
    unreadInPage: listUnreadOnly.unreadInPage,
  };

  // UI login
  await loginUi(page, email);
  let sn = await shot(page, `${key}-login-dashboard`);
  result.shots.push(sn);

  // Badge vs API
  await settle(page, 1500);
  const badge = await readBadge(page);
  result.badge = badge;
  sn = await shot(page, `${key}-badge-closed`);
  result.shots.push(sn);

  const badgeNum =
    badge.badgeText === '9+'
      ? 10
      : badge.badgeText
        ? Number(String(badge.badgeText).replace('+', ''))
        : badge.ariaUnread || 0;
  const apiCount = unreadApi.count;
  // Exact mismatch: badge shows N but API says M (treat 9+ as >=10)
  let mismatch = false;
  let mismatchWhy = '';
  if (typeof apiCount === 'number') {
    if (badge.badgeText === '9+') {
      if (apiCount < 10) {
        mismatch = true;
        mismatchWhy = `badge shows 9+ but API unread-count=${apiCount}`;
      }
    } else if (badge.badgeVisible) {
      if (badgeNum !== apiCount) {
        mismatch = true;
        mismatchWhy = `badge=${badgeNum} vs GET unread-count=${apiCount}`;
      }
    } else {
      // no badge → expect 0
      if (apiCount > 0) {
        mismatch = true;
        mismatchWhy = `no badge but GET unread-count=${apiCount}`;
      }
    }
    // Also compare client-list unread (how FE actually computes badge)
    if (listApi.unreadInPage !== apiCount && listApi.notifications.length >= 20 && apiCount > 20) {
      // expected architectural mismatch when >20 unread
      note({
        severity: 'HIGH',
        layer: 'FRONTEND',
        where: `${role} badge source`,
        why: `FE badge derives unread from list(limit=20) unreadInPage=${listApi.unreadInPage}; API unread-count=${apiCount}. notificationsApi.unreadCount() unused by NotificationBell.`,
        screenshot: sn,
        network: `GET /notifications/unread-count → ${apiCount}; list unreadInPage=${listApi.unreadInPage}`,
      });
    }
  }
  result.mismatch = mismatch;
  if (mismatch) {
    note({
      severity: 'HIGH',
      layer: 'FRONTEND',
      where: `${role} unread badge vs API`,
      why: mismatchWhy,
      screenshot: sn,
      network: `GET /notifications/unread-count ${unreadApi.status} count=${apiCount}; badge aria="${badge.aria}" text=${badge.badgeText}`,
    });
  }
  console.log(
    `  badge=${badge.badgeText ?? 'none'} ariaUnread=${badge.ariaUnread} apiUnread=${apiCount} listUnread=${listApi.unreadInPage} mismatch=${mismatch}`,
  );

  // Open drawer
  const opened = await openBell(page);
  await settle(page, 900);
  let drawer = await drawerState(page);
  result.drawer = drawer;
  sn = await shot(page, `${key}-drawer-open`);
  result.shots.push(sn);

  if (!opened || !drawer.open) {
    note({
      severity: 'CRITICAL',
      layer: 'FRONTEND',
      where: `${role} notification bell`,
      why: `Bell open failed: opened=${opened} drawer.open=${drawer.open}`,
      screenshot: sn,
      network: 'n/a',
    });
  }

  if (drawer.skeleton) {
    // wait and recheck for stuck skeleton
    await page.waitForTimeout(3000);
    const d2 = await drawerState(page);
    if (d2.skeleton) {
      sn = await shot(page, `${key}-stuck-skeleton`);
      result.shots.push(sn);
      note({
        severity: 'HIGH',
        layer: 'FRONTEND',
        where: `${role} notifications drawer`,
        why: 'Stuck skeleton/loading after 3s',
        screenshot: sn,
        network: apiLog
          .filter((a) => /notif/i.test(a.url))
          .slice(-5)
          .map((a) => `${a.status} ${a.method} ${a.url}`)
          .join('; '),
      });
    }
    drawer = d2;
    result.drawer = drawer;
  }

  if (drawer.empty && (apiCount > 0 || listApi.notifications.length > 0)) {
    note({
      severity: 'HIGH',
      layer: 'FRONTEND',
      where: `${role} empty drawer`,
      why: `UI empty ("all caught up") but API list=${listApi.notifications.length} unread-count=${apiCount}`,
      screenshot: sn,
      network: `list=${listApi.count} unread=${apiCount}`,
    });
    sn = await shot(page, `${key}-empty-mismatch`);
    result.shots.push(sn);
  }

  // UI filter unread — expect absent (no control in NotificationBell)
  result.pagination = { uiPresent: drawer.hasPagination };
  if (!drawer.hasUnreadFilter) {
    result.filterUnread = {
      ...result.filterUnread,
      uiPresent: false,
      note: 'No unread filter control in drawer (API supports ?unreadOnly=)',
    };
  } else {
    // try click
    const filterBtn = page
      .locator('[role="dialog"] button, [role="dialog"] [role="tab"]')
      .filter({ hasText: /unread/i })
      .first();
    if (await filterBtn.isVisible().catch(() => false)) {
      await filterBtn.click().catch(() => {});
      await settle(page, 600);
      sn = await shot(page, `${key}-filter-unread`);
      result.shots.push(sn);
      result.filterUnread.uiPresent = true;
    }
  }

  if (!drawer.hasPagination && listApi.notifications.length >= 20) {
    note({
      severity: 'MEDIUM',
      layer: 'FRONTEND',
      where: `${role} notifications pagination`,
      why: `List returns ${listApi.notifications.length} (limit 20) but drawer has no pagination/load-more`,
      screenshot: sn,
      network: `GET /notifications?limit=20 count=${listApi.notifications.length}`,
    });
  }

  // Click first item (mark one read via click)
  if (drawer.itemCount > 0) {
    const beforeUnread = await getUnreadCountApi(auth.token);
    const itemBtn = page
      .locator('[role="dialog"][aria-label*="otif" i] button')
      .filter({ hasNotText: /mark all/i })
      .first();
    const beforeApis = apiLog.length;
    if (await itemBtn.isVisible().catch(() => false)) {
      await itemBtn.click().catch(() => {});
      await settle(page, 1200);
      sn = await shot(page, `${key}-item-click`);
      result.shots.push(sn);
      const markApis = apiLog
        .slice(beforeApis)
        .filter((a) => /notifications/i.test(a.url) && /read/i.test(a.url));
      result.markOne = {
        apis: markApis.map((a) => ({ status: a.status, method: a.method, url: a.url })),
        navigated: page.url(),
      };
      if (markApis.some((a) => a.status >= 400)) {
        note({
          severity: 'HIGH',
          layer: 'BACKEND',
          where: `${role} mark one read (item click)`,
          why: markApis.map((a) => `${a.status} ${a.method} ${a.url}`).join('; '),
          screenshot: sn,
          network: markApis.map((a) => `${a.status} ${a.url}`).join('; '),
        });
      }
      // return to dashboard and reopen
      await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
      await settle(page, 1000);
      await openBell(page);
      await settle(page, 700);
      sn = await shot(page, `${key}-after-item-click-reopen`);
      result.shots.push(sn);
      const afterUnread = await getUnreadCountApi(auth.token);
      result.markOne.beforeApi = beforeUnread.count;
      result.markOne.afterApi = afterUnread.count;
    }
  } else {
    result.markOne = { skipped: true, reason: 'empty drawer' };
    sn = await shot(page, `${key}-empty-drawer`);
    result.shots.push(sn);
  }

  // Mark all as read
  drawer = await drawerState(page);
  if (!drawer.open) {
    await openBell(page);
    await settle(page, 600);
    drawer = await drawerState(page);
  }
  const markAllBtn = page
    .locator('[role="dialog"] button')
    .filter({ hasText: /mark all as read|mark all read/i })
    .first();
  if (await markAllBtn.isVisible({ timeout: 800 }).catch(() => false)) {
    const beforeApis = apiLog.length;
    await markAllBtn.click().catch(() => {});
    await settle(page, 1200);
    sn = await shot(page, `${key}-mark-all-read`);
    result.shots.push(sn);
    const patches = apiLog
      .slice(beforeApis)
      .filter((a) => /notifications/i.test(a.url) && /read-all|read/i.test(a.url));
    const after = await getUnreadCountApi(auth.token);
    const badgeAfter = await readBadge(page);
    result.markAll = {
      hit: true,
      apis: patches.map((a) => ({ status: a.status, method: a.method, url: a.url, body: a.body.slice(0, 120) })),
      apiUnreadAfter: after.count,
      badgeAfter,
    };
    if (patches.some((a) => a.status >= 400)) {
      note({
        severity: 'HIGH',
        layer: 'BACKEND',
        where: `${role} mark all read`,
        why: patches.map((a) => `${a.status} ${a.method} ${a.url} ${a.body}`).join('; '),
        screenshot: sn,
        network: patches.map((a) => `${a.status} ${a.url}`).join('; '),
      });
    }
    // badge should clear if API says 0
    if (after.count === 0 && badgeAfter.badgeVisible) {
      note({
        severity: 'HIGH',
        layer: 'FRONTEND',
        where: `${role} badge after mark-all`,
        why: `API unread-count=0 but badge still visible (${badgeAfter.badgeText})`,
        screenshot: sn,
        network: `GET unread-count → 0`,
      });
    }
  } else {
    result.markAll = { hit: false, reason: 'Mark all control absent (likely 0 unread)' };
    sn = await shot(page, `${key}-mark-all-absent`);
    result.shots.push(sn);
  }

  // Rapid open/close ×10
  await dismiss(page);
  await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await settle(page, 800);
  const rapidErrors = [];
  const rapidConsoleBefore = consoleLog.length;
  const rapidApiBefore = apiLog.length;
  for (let i = 0; i < 10; i++) {
    const okOpen = await openBell(page);
    await page.waitForTimeout(80);
    const st = await drawerState(page);
    await closeBell(page);
    await page.waitForTimeout(60);
    if (!okOpen || (i === 0 && !st.open && !st.empty && st.itemCount === 0)) {
      // first open must work; subsequent may race
    }
    if (i === 0 || i === 9) {
      // sample
    }
  }
  await openBell(page);
  await settle(page, 500);
  sn = await shot(page, `${key}-rapid-open-close-end`);
  result.shots.push(sn);
  const rapidConsole = consoleLog.slice(rapidConsoleBefore);
  const rapidApiFails = apiLog
    .slice(rapidApiBefore)
    .filter((a) => a.status >= 400 && /notif/i.test(a.url));
  result.rapid = {
    iterations: 10,
    newConsoleErrors: rapidConsole.length,
    notifApiFails: rapidApiFails,
    consoleSample: rapidConsole.slice(0, 5),
  };
  if (rapidConsole.length) {
    note({
      severity: 'MEDIUM',
      layer: 'FRONTEND',
      where: `${role} rapid open/close ×10`,
      why: `${rapidConsole.length} console error(s): ${rapidConsole[0]}`,
      screenshot: sn,
      network: rapidApiFails.map((a) => `${a.status} ${a.url}`).join('; ') || 'n/a',
    });
  }
  if (rapidApiFails.length) {
    note({
      severity: 'HIGH',
      layer: 'BACKEND',
      where: `${role} rapid open/close API`,
      why: rapidApiFails.map((a) => `${a.status} ${a.method} ${a.url}`).join('; '),
      screenshot: sn,
      network: rapidApiFails.map((a) => `${a.status} ${a.url}`).join('; '),
    });
  }

  // Final badge check after stress
  await closeBell(page);
  const finalBadge = await readBadge(page);
  const finalApi = await getUnreadCountApi(auth.token);
  result.final = { badge: finalBadge, apiUnread: finalApi.count };
  sn = await shot(page, `${key}-final-badge`);
  result.shots.push(sn);

  // console errors (non-auth noise)
  const meaningful = result.consoleErrors.filter(
    (e) => !/favicon|hydration|Download the React DevTools/i.test(e),
  );
  if (meaningful.length) {
    note({
      severity: 'MEDIUM',
      layer: 'FRONTEND',
      where: `${role} console`,
      why: meaningful.slice(0, 3).join(' | '),
      screenshot: sn,
      network: 'n/a',
    });
  }

  roleResults.push(result);
  persist();
  await ctx.close();
  return result;
}

function writeFindings() {
  const lines = [];
  lines.push('# NOTIF-UI Stress Findings');
  lines.push('');
  lines.push(`> Generated ${new Date().toISOString()}`);
  lines.push(`> FE \`${FE}\` · BE \`${BE}\` · tenant \`${TENANT}\``);
  lines.push(`> Evidence: \`${SHOT.replace(/.*docs/, 'docs')}/\` (**${shotIdx}** PNGs)`);
  lines.push('');
  lines.push('## Roles exercised');
  lines.push('');
  for (const r of roleResults) {
    lines.push(
      `- **${r.role}** (\`${r.email}\`): badge=${r.badge?.badgeText ?? 'none'} · API unread=${r.apiUnread?.count} · list=${r.listApi?.count} (unreadInPage=${r.listApi?.unreadInPage}) · mismatch=${r.mismatch} · markOne=${r.markOne?.skipped ? 'skip' : (r.markOne?.apis?.map((a) => a.status).join(',') || 'n/a')} · markAll=${r.markAll?.hit ? (r.markAll.apis?.map((a) => a.status).join(',') || 'ok') : 'absent'} · rapid console=${r.rapid?.newConsoleErrors ?? 0}`,
    );
  }
  lines.push('');
  lines.push('## Badge vs GET /notifications/unread-count');
  lines.push('');
  lines.push('| Role | Badge UI | API count | List unread (≤20) | Mismatch |');
  lines.push('|------|----------|-----------|-------------------|----------|');
  for (const r of roleResults) {
    lines.push(
      `| ${r.role} | ${r.badge?.badgeText ?? 'none'} (aria=${r.badge?.ariaUnread ?? 0}) | ${r.apiUnread?.count} | ${r.listApi?.unreadInPage} | ${r.mismatch ? 'YES' : 'no'} |`,
    );
  }
  lines.push('');
  lines.push('## UI capabilities (drawer)');
  lines.push('');
  lines.push('| Role | Open | Items | Empty | Mark all | Unread filter UI | Pagination UI |');
  lines.push('|------|------|-------|-------|----------|------------------|---------------|');
  for (const r of roleResults) {
    const d = r.drawer || {};
    lines.push(
      `| ${r.role} | ${d.open} | ${d.itemCount} | ${d.empty} | ${d.hasMarkAll} | ${d.hasUnreadFilter || false} | ${d.hasPagination || false} |`,
    );
  }
  lines.push('');
  lines.push('## Issues');
  lines.push('');
  if (!findings.length) {
    lines.push('_No defects recorded._');
  } else {
    findings.forEach((f, i) => {
      const id = `ISSUE-NOTIF-UI-${String(i + 1).padStart(2, '0')}`;
      lines.push(`### ${id}`);
      lines.push(`- **Where:** ${f.where}`);
      lines.push(`- **Why:** ${f.why}`);
      lines.push(`- **Classification:** ${f.layer}`);
      lines.push(`- **Severity:** ${f.severity}`);
      lines.push(`- **Screenshot:** ${f.screenshot || 'n/a'}`);
      lines.push(`- **Network:** ${f.network || 'n/a'}`);
      lines.push('');
    });
  }
  lines.push('## Code notes (observed)');
  lines.push('');
  lines.push('- `NotificationBell` badge = `useNotifications().unreadCount` = count of unread in **filtered list(limit=20)**, not `notificationsApi.unreadCount()`.');
  lines.push('- Drawer has no unread filter toggle and no pagination (scroll only).');
  lines.push('- Mark-one-read happens on item click via `PATCH /notifications/:id/read`; mark-all via `PATCH /notifications/read-all`.');
  lines.push('');
  fs.writeFileSync(path.join(SHOT, 'FINDINGS.md'), lines.join('\n'));
  console.log(`\nWrote FINDINGS.md (${findings.length} issues, ${shotIdx} shots)`);
}

async function main() {
  console.log('=== NOTIF-UI STRESS START ===');
  console.log(`FE=${FE} BE=${BE}`);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const r of ROLES) {
      await runRole(browser, r);
    }
  } finally {
    await browser.close();
  }
  writeFindings();
  persist();
  console.log('=== NOTIF-UI STRESS DONE ===');
  console.log(JSON.stringify({ shots: shotIdx, findings: findings.length, roles: roleResults.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  writeFindings();
  persist();
  process.exit(1);
});
