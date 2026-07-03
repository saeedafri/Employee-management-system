/**
 * Phase 3 — Master deep E2E audit orchestrator.
 * Runs API battery + CRUD/Engine/UI, writes all deliverables.
 *
 * Usage: npm run test:e2e:deep
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_JSON = path.join(ROOT, 'docs/e2e-deep-api-results.json');
const CRUD_JSON = path.join(ROOT, 'docs/e2e-deep-crud-results.json');
const SUMMARY_JSON = path.join(ROOT, 'docs/e2e-deep-summary.json');
const MASTER_MD = path.join(ROOT, 'docs/E2E_DEEP_AUDIT.md');
const BACKEND_MD = path.join(ROOT, 'docs/E2E_BACKEND_ISSUES.md');
const FRONTEND_MD = path.join(ROOT, 'docs/E2E_FRONTEND_ISSUES.md');

function runScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [script], {
      cwd: ROOT,
      env: { ...process.env, API_URL: process.env.API_URL || 'https://ems-api.saqibsaeed.cloud/api/v1', FE_BASE: process.env.FE_BASE || 'http://localhost:3001' },
      stdio: 'inherit',
    });
    child.on('close', (code) => resolve(code));
    child.on('error', reject);
  });
}

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function appendPhaseSection(filePath, title, issues, phaseLabel = 'Phase 3') {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (existing.includes(`## ${phaseLabel}`)) {
    // Replace existing Phase 3 section
    const idx = existing.indexOf(`## ${phaseLabel}`);
    const trimmed = existing.slice(0, idx).trimEnd();
    fs.writeFileSync(filePath, trimmed + '\n\n');
  }
  const lines = [
    '',
    `## ${phaseLabel}`,
    '',
    `> Deep audit: ${new Date().toISOString()}`,
    `> Scripts: \`scripts/deepApiAudit.mjs\`, \`scripts/deepCrudE2EAudit.mjs\``,
    '',
    `**New issues this phase: ${issues.length}**`,
    '',
  ];
  issues.forEach((issue, i) => {
    lines.push(`### P3-${i + 1}. ${issue.title || issue.id || issue.area}`);
    lines.push('');
    lines.push(`- **Severity:** ${issue.severity || 'P2'}`);
    lines.push(`- **Classification:** ${issue.classification || (filePath.includes('BACKEND') ? 'Backend' : 'Frontend')}`);
    if (issue.endpoint) lines.push(`- **API endpoint:** \`${issue.endpoint}\``);
    if (issue.area) lines.push(`- **Area:** ${issue.area}`);
    if (issue.steps) lines.push(`- **Steps:** ${issue.steps}`);
    if (issue.expected) lines.push(`- **Expected:** ${issue.expected}`);
    if (issue.actual) lines.push(`- **Actual:** ${issue.actual}`);
    if (issue.note) lines.push(`- **Detail:** ${issue.note}`);
    if (issue.status) lines.push(`- **Status/body:** \`${issue.status}\``);
    if (issue.screenshot) lines.push(`- **Screenshot:** \`${issue.screenshot}\``);
    if (issue.apis) lines.push(`- **API failures:** ${JSON.stringify(issue.apis)}`);
    lines.push('');
  });
  fs.appendFileSync(filePath, lines.join('\n'));
}

function buildMasterReport(api, crud, summary) {
  const apiSum = api?.summary ?? {};
  const crudData = crud?.crud ?? {};
  const engineData = crud?.engine ?? {};
  const p1Blockers = [];

  // Collect P1 blockers
  if (apiSum.p1FailureCount > 0) p1Blockers.push(`API matrix: ${apiSum.p1FailureCount} P1 failures`);
  const crudFails = (crudData.results ?? []).filter((r) => !r.pass);
  const engineFails = (engineData.results ?? []).filter((r) => !r.pass);
  if (crudFails.length) p1Blockers.push(`CRUD: ${crudFails.length} operations failed`);
  if (engineFails.length) p1Blockers.push(`Payroll engine: ${engineFails.length} checks failed`);
  for (const issue of [...(crud?.backendIssues ?? []), ...(crud?.frontendIssues ?? [])]) {
    if (issue.severity === 'P1') p1Blockers.push(issue.id || issue.area);
  }

  const verdict = p1Blockers.length === 0 && apiSum.fail === 0
    ? '**CONDITIONAL PASS** — re-verify manually; automated suite found no P1 blockers'
    : '**NOT READY FOR PRODUCTION**';

  const crudMatrix = buildCrudMatrix(crudData.results ?? []);
  const engineTable = (engineData.results ?? []).map((r) => `| ${r.name} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.note || r.status || ''} |`).join('\n');

  return `# E2E Deep Audit — Phase 3 Master Report

> Generated: ${new Date().toISOString()}  
> API: https://ems-api.saqibsaeed.cloud/api/v1  
> Frontend: http://localhost:3001 (MSW OFF)  
> Scripts: \`scripts/deepApiAudit.mjs\`, \`scripts/deepCrudE2EAudit.mjs\`, \`npm run test:e2e:deep\`

---

## Executive Summary

| Metric | Value |
|--------|-------|
| API routes catalogued | ${apiSum.totalRoutes ?? '—'} |
| API GET matrix tests run | ${apiSum.getTestsRun ?? '—'} |
| API pass (incl. expected 403/400) | ${apiSum.pass ?? '—'} |
| API unexpected failures | ${apiSum.fail ?? '—'} |
| API mutation probes | ${apiSum.mutationProbes ?? '—'} |
| CRUD operations tested | ${crudData.total ?? '—'} |
| CRUD pass | ${crudData.pass ?? '—'} |
| CRUD fail | ${crudData.fail ?? '—'} |
| Payroll engine checks | ${engineData.total ?? '—'} |
| Engine pass | ${engineData.pass ?? '—'} |
| Engine fail | ${engineData.fail ?? '—'} |
| UI deep interactions (beyond Phase 2) | ${crud?.ui?.interactions ?? '—'} |
| New backend issues (Phase 3) | ${(crud?.backendIssues ?? []).length + dedupeApiIssues(api).length} |
| New frontend issues (Phase 3) | ${(crud?.frontendIssues ?? []).length} |

---

## Final Verdict

${verdict}

${p1Blockers.length ? `### Blockers (${p1Blockers.length})\n\n${p1Blockers.map((b, i) => `${i + 1}. ${b}`).join('\n')}` : ''}

---

## CRUD Matrix

| Module | Create | Read | Update | Delete | Notes |
|--------|--------|------|--------|--------|-------|
${crudMatrix}

---

## Payroll Engine Results

| Check | Result | Detail |
|-------|--------|--------|
${engineTable || '| — | — | — |'}

---

## Multi-Tenant

| Tenant | Login | Notes |
|--------|-------|-------|
${(apiSum.loginResults ?? []).map((l) => `| ${l.tenant} (${l.actor}) | ${l.ok ? 'OK' : 'FAIL'} | ${l.error || (l.mfa ? 'MFA required' : '')} |`).join('\n')}

### Cross-tenant isolation

${(apiSum.isolation ?? []).map((t) => `- **${t.test}**: ${t.pass ? 'PASS' : 'FAIL'} (HTTP ${t.status}) — ${t.detail}`).join('\n') || 'Not tested'}

---

## API Role Matrix (failures only)

${formatApiFailures(api)}

---

## Evidence Paths

- Machine-readable: \`docs/e2e-deep-summary.json\`
- API results: \`docs/e2e-deep-api-results.json\`
- CRUD/Engine/UI: \`docs/e2e-deep-crud-results.json\`
- Screenshots: \`docs/e2e-screenshots/deep/\`
- Backend issues: \`docs/E2E_BACKEND_ISSUES.md\` (## Phase 3)
- Frontend issues: \`docs/E2E_FRONTEND_ISSUES.md\` (## Phase 3)
- Phase 2 baseline: \`docs/E2E_STRICT_AUDIT.md\` (1731 button clicks)

---

## Honest Assessment

This Phase 3 audit **extends** Phase 2 (strict button sweep) with:
- Full route extraction (${apiSum.totalRoutes ?? 409} endpoints from source)
- Role matrix on all GET endpoints (acme: 6 roles; KWD: payroll subset)
- API-level CRUD with test-prefixed data + cleanup
- India payroll engine calculation + statutory component verification
- KWD tenant currency/work-week/salary checks
- UI deep sweep: employee profile tabs, payroll run detail, dashboard widgets, RBAC edge cases

**Not claimed:** 100% mutation coverage on all 409 routes (destructive ops skipped by design). AUDITOR role not seeded on Hostinger. testorg tenant login ${(apiSum.loginResults ?? []).find((l) => l.tenant?.includes('test'))?.ok ? 'works' : 'still broken'}.
`;
}

function buildCrudMatrix(results) {
  const modules = ['employees', 'departments', 'holidays', 'leave', 'attendance', 'leave_types', 'timesheets', 'payroll', 'pay_components', 'statutory_packs', 'legal_entities', 'pay_groups', 'settings', 'announcements', 'assets', 'notifications'];
  const ops = ['create', 'read', 'update', 'delete', 'read_balance', 'read_list', 'withdraw', 'check_in', 'read_records', 'regularization', 'create_draft', 'read_detail', 'calculate', 'locks_read', 'history_employee_403', 'history_manager', 'unread_count', 'mark_read', 'soft_delete', 'documents_read'];
  return modules.map((mod) => {
    const modResults = results.filter((r) => r.module === mod);
    const cell = (op) => {
      const r = modResults.find((x) => x.op === op || x.op?.includes(op));
      if (!r) return '—';
      return r.pass ? '✅' : `❌ ${r.status || r.note || ''}`;
    };
    const notes = modResults.filter((r) => !r.pass).map((r) => `${r.op}:${r.note || r.status}`).join('; ');
    return `| ${mod} | ${cell('create')} | ${cell('read')} | ${cell('update')} | ${cell('delete')} | ${notes || '—'} |`;
  }).join('\n');
}

function dedupeApiIssues(api) {
  const failures = api?.summary?.failures ?? [];
  return failures.filter((f) => f.verdict === 'fail' || f.verdict === 'fail_rbac').slice(0, 20).map((f) => ({
    id: `api-${f.route}`,
    severity: f.verdict === 'fail_rbac' ? 'P1' : 'P2',
    title: `${f.method} ${f.route} (${f.actor})`,
    endpoint: `${f.method} ${f.route}`,
    status: f.status,
    note: f.errorCode || f.verdict,
    classification: 'Backend',
  }));
}

function formatApiFailures(api) {
  const failures = (api?.summary?.failures ?? []).slice(0, 50);
  if (!failures.length) return '_No unexpected API failures in sampled matrix._';
  return failures.map((f) => `- \`${f.method} ${f.route}\` — ${f.actor} — HTTP ${f.status} — ${f.verdict} — ${f.errorCode || ''}`).join('\n');
}

async function main() {
  console.log('\n████████ Phase 3 Deep E2E Audit Orchestrator ████████\n');

  const apiCode = await runScript('scripts/deepApiAudit.mjs');
  const crudCode = await runScript('scripts/deepCrudE2EAudit.mjs');

  const api = loadJson(API_JSON);
  const crud = loadJson(CRUD_JSON);

  const backendIssues = [
    ...dedupeApiIssues(api),
    ...(crud?.backendIssues ?? []).map((i) => ({ ...i, classification: 'Backend', title: i.id })),
  ];
  const frontendIssues = (crud?.frontendIssues ?? []).map((i) => ({ ...i, classification: 'Frontend', title: i.id }));

  // Deduplicate known Phase 2 issues
  const newBackend = backendIssues.filter((i) => !String(i.title).includes('testorg') || i.note?.includes('failed'));
  const newFrontend = frontendIssues;

  appendPhaseSection(BACKEND_MD, 'Backend', newBackend);
  appendPhaseSection(FRONTEND_MD, 'Frontend', newFrontend);

  const summary = {
    generatedAt: new Date().toISOString(),
    api: api?.summary,
    crud: crud?.crud,
    engine: crud?.engine,
    ui: crud?.ui,
    newBackendIssueCount: newBackend.length,
    newFrontendIssueCount: newFrontend.length,
    verdict: newBackend.some((i) => i.severity === 'P1') || newFrontend.some((i) => i.severity === 'P1') ? 'NOT READY FOR PRODUCTION' : 'NOT READY FOR PRODUCTION',
    scripts: { apiExit: apiCode, crudExit: crudCode },
  };
  // Always NOT READY if any failures
  if ((api?.summary?.fail ?? 0) > 0 || (crud?.crud?.fail ?? 0) > 0 || (crud?.engine?.fail ?? 0) > 0) {
    summary.verdict = 'NOT READY FOR PRODUCTION';
  }

  fs.writeFileSync(SUMMARY_JSON, JSON.stringify({ ...summary, api, crud }, null, 2));
  fs.writeFileSync(MASTER_MD, buildMasterReport(api, crud, summary));

  console.log(`\n✓ Wrote ${MASTER_MD}`);
  console.log(`✓ Wrote ${SUMMARY_JSON}`);
  console.log(`\nVERDICT: ${summary.verdict}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
