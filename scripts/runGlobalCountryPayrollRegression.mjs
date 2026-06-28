/**
 * Run 5-country payroll regression against live API + write per-country reports.
 *
 *   node scripts/runGlobalCountryPayrollRegression.mjs --seed   # seed Hostinger DB first
 *   node scripts/runGlobalCountryPayrollRegression.mjs
 *
 * Env: API_URL (default https://ems-api.saqibsaeed.cloud/api/v1)
 */
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  COUNTRY_LITMUS,
  LITMUS_HR_EMAIL,
  LITMUS_PASSWORD,
  LITMUS_PERIOD,
  LITMUS_TENANT_KEY,
  computeExpectedLitmus,
} from './globalCountryLitmusConfig.mjs';

const API = process.env.API_URL || 'https://ems-api.saqibsaeed.cloud/api/v1';
const REPORT_DIR = path.resolve('docs/payroll/regression-reports');
const TOL = 1.5; // major-unit tolerance for rounding

async function api(method, urlPath, { token, body, tenant } = {}) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': tenant,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    // Fastify routes with `body: { type: 'object' }` reject missing body — send {} when omitted.
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* noop */ }
  return { status: res.status, json };
}

function money(n, currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 4 }).format(n);
}

function near(a, b, tol = TOL) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

function pickDeductions(payslip) {
  const ded = Array.isArray(payslip?.deductions) ? payslip.deductions
    : Array.isArray(payslip?.deductionsJson) ? payslip.deductionsJson : [];
  const stat = Array.isArray(payslip?.statutoryDeductionsJson) ? payslip.statutoryDeductionsJson : [];
  const er = Array.isArray(payslip?.employerContributions) ? payslip.employerContributions : [];
  return [...ded, ...stat].map((d) => ({
    code: d.code || d.name,
    amount: Number(d.amount ?? 0),
  })).concat(er.map((d) => ({
    code: d.code || d.name,
    amount: Number(d.amount ?? 0),
    employer: true,
  })));
}

function writeReport(cfg, expected, actual, issues, meta) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const out = path.join(REPORT_DIR, cfg.reportFile);
  const lines = [
    `# Payroll Regression — ${cfg.name} (${cfg.code})`,
    '',
    `> Generated: ${new Date().toISOString()}`,
    `> API: ${API}`,
    `> Tenant: \`${LITMUS_TENANT_KEY}\``,
    `> Period: \`${LITMUS_PERIOD}\``,
    `> Pack version: \`${cfg.packVersion}\``,
    '',
    '## Configuration (data-driven)',
    '',
    '| Field | Value |',
    '|-------|-------|',
    `| Currency | ${cfg.currency} |`,
    `| Annual CTC | ${money(cfg.annualCtcMajor, cfg.currency)} |`,
    `| Monthly gross (100% BASIC) | ${money(expected.monthlyGross, cfg.currency)} |`,
    `| Work week | ${cfg.workWeekDays.join('–')} |`,
    `| Legal entity | ${cfg.name} Entity |`,
    `| Employee | ${cfg.employeeCode} / ${cfg.employeeEmail} |`,
    '',
    '### Statutory pack summary',
    '',
    '```json',
    JSON.stringify(cfg.pack, null, 2),
    '```',
    '',
    `**Sources:** ${cfg.sources}`,
    '',
    '## Expected engine output (reference litmus)',
    '',
    '| Metric | Amount |',
    '|--------|--------|',
    `| Monthly gross | ${money(expected.monthlyGross, cfg.currency)} |`,
    `| Monthly income tax | ${money(expected.monthlyTax, cfg.currency)} |`,
    ...expected.statutoryDeductions.map((d) => `| Deduction ${d.code} | ${money(d.amount, cfg.currency)} |`),
    ...expected.employerContributions.map((d) => `| Employer ${d.code} | ${money(d.amount, cfg.currency)} |`),
    `| **Net monthly** | **${money(expected.netMonthly, cfg.currency)}** |`,
    '',
    '## Live API payroll run output',
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| Run ID | \`${meta.runId}\` |`,
    `| Run status | ${meta.runStatus} |`,
    `| Payslip gross | ${money(actual.gross, cfg.currency)} |`,
    `| Payslip deductions | ${money(actual.totalDeductions, cfg.currency)} |`,
    `| Payslip net | ${money(actual.net, cfg.currency)} |`,
    `| Currency | ${actual.currency} |`,
    '',
    '### Payslip deduction lines',
    '',
    '| Code | Amount |',
    '|------|--------|',
    ...actual.deductionLines.map((d) => `| ${d.code} | ${money(d.amount, cfg.currency)} |`),
    '',
    '## Verdict',
    '',
  ];
  if (!issues.length) {
    lines.push('**PASS** — Live payroll output matches expected litmus within tolerance.');
  } else {
    lines.push('**FAIL** — Issues that break multi-country payroll for this jurisdiction:');
    lines.push('');
    for (const i of issues) {
      lines.push(`- **${i.field}**: expected \`${i.expected}\`, actual \`${i.actual}\` — ${i.note}`);
    }
  }
  lines.push('');
  fs.writeFileSync(out, lines.join('\n'));
  return out;
}

async function waitForReview(token, tenant, runId, maxMs = 120_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const r = await api('GET', `/payroll/runs/${runId}`, { token, tenant });
    const status = r.json?.data?.status;
    if (status === 'REVIEW' || status === 'APPROVED' || status === 'PAID') return r.json.data;
    if (status === 'CALCULATING') {
      await new Promise((res) => setTimeout(res, 2000));
      continue;
    }
    if (status === 'DRAFT' || status === 'FAILED') break;
    await new Promise((res) => setTimeout(res, 2000));
  }
  const r = await api('GET', `/payroll/runs/${runId}`, { token, tenant });
  return r.json?.data;
}

async function runCountry(token, tenant, cfg, employeeId) {
  const expected = computeExpectedLitmus(cfg);
  const period = `${LITMUS_PERIOD}-${cfg.code}`;

  const create = await api('POST', '/payroll/runs', {
    token,
    tenant,
    body: {
      period: LITMUS_PERIOD,
      type: 'OFF_CYCLE',
      employeeIds: [employeeId],
      paySchedule: 'MONTHLY',
      currency: cfg.currency,
      notes: `Global litmus regression ${cfg.code}`,
    },
  });
  if (create.status !== 201 && create.status !== 200) {
    return { cfg, expected, error: `create run ${create.status} ${JSON.stringify(create.json?.error)}` };
  }
  const runId = create.json?.data?.id;

  const calc = await api('POST', `/payroll/runs/${runId}/calculate`, { token, tenant, body: {} });
  if (calc.status !== 200 && calc.status !== 202) {
    return { cfg, expected, error: `calculate ${calc.status} ${JSON.stringify(calc.json?.error)}` };
  }

  const run = await waitForReview(token, tenant, runId);
  const payslips = await api('GET', `/payroll/runs/${runId}/payslips?limit=5`, { token, tenant });
  const psSummary = payslips.json?.data?.items?.[0] ?? payslips.json?.data?.[0];
  if (!psSummary?.id) {
    return { cfg, expected, error: `no payslip (run status ${run?.status})` };
  }
  const psDetail = await api('GET', `/payroll/runs/${runId}/payslips/${psSummary.id}`, { token, tenant });
  const ps = psDetail.json?.data ?? psSummary;

  const actual = {
    gross: Number(ps.grossEarnings ?? 0),
    totalDeductions: Number(ps.totalDeductions ?? 0),
    net: Number(ps.netPay ?? 0),
    currency: ps.currency || cfg.currency,
    deductionLines: pickDeductions(ps),
  };

  const issues = [];
  if (!near(actual.gross, expected.monthlyGross)) {
    issues.push({
      field: 'grossEarnings',
      expected: expected.monthlyGross.toFixed(2),
      actual: actual.gross.toFixed(2),
      note: 'Monthly BASIC/CTC split mismatch — breaks payslip gross.',
    });
  }
  if (!near(actual.net, expected.netMonthly, TOL * 2)) {
    issues.push({
      field: 'netPay',
      expected: expected.netMonthly.toFixed(2),
      actual: actual.net.toFixed(2),
      note: 'Net pay diverges from config-driven statutory engine — multi-country correctness broken.',
    });
  }
  for (const exp of expected.statutoryDeductions) {
    const line = actual.deductionLines.find((d) => d.code === exp.code && !d.employer);
    if (!line || !near(line.amount, exp.amount)) {
      issues.push({
        field: exp.code,
        expected: exp.amount.toFixed(2),
        actual: line ? line.amount.toFixed(2) : 'MISSING',
        note: 'Statutory contribution not computed from pack data.',
      });
    }
  }
  for (const exp of expected.employerContributions) {
    const line = actual.deductionLines.find((d) => d.code === exp.code && d.employer);
    if (!line || !near(line.amount, exp.amount)) {
      issues.push({
        field: exp.code,
        expected: exp.amount.toFixed(2),
        actual: line ? line.amount.toFixed(2) : 'MISSING',
        note: 'Employer statutory contribution not computed from pack data.',
      });
    }
  }
  if (cfg.code === 'AE' && actual.totalDeductions > 0.01) {
    issues.push({
      field: 'UAE deductions',
      expected: '0',
      actual: String(actual.totalDeductions),
      note: 'UAE expat model should have zero employee statutory deductions in this litmus.',
    });
  }

  const reportPath = writeReport(cfg, expected, actual, issues, { runId, runStatus: run?.status });
  return { cfg, expected, actual, issues, reportPath, pass: issues.length === 0 };
}

async function main() {
  if (process.argv.includes('--seed')) {
    const { execSync } = await import('node:child_process');
    execSync('node scripts/seedGlobalCountryLitmus.mjs', { stdio: 'inherit', cwd: path.resolve('.') });
  }

  const login = await api('POST', '/auth/login', {
    tenant: LITMUS_TENANT_KEY,
    body: { email: LITMUS_HR_EMAIL, password: LITMUS_PASSWORD },
  });
  if (!login.json?.data?.accessToken) {
    console.error('Login failed — run with --seed first', login);
    process.exit(1);
  }
  const token = login.json.data.accessToken;
  const tenant = LITMUS_TENANT_KEY;

  const prisma = new PrismaClient();
  const t = await prisma.tenant.findUnique({ where: { tenantKey: tenant } });
  if (!t) {
    console.error('Tenant missing — run with --seed');
    process.exit(1);
  }

  const results = [];
  for (const [code, cfg] of Object.entries(COUNTRY_LITMUS)) {
    const emp = await prisma.employee.findFirst({
      where: { tenantId: t.id, employeeCode: cfg.employeeCode },
    });
    if (!emp) {
      console.error(`Employee ${cfg.employeeCode} missing — run --seed`);
      continue;
    }
    console.log(`\n=== ${code} ${cfg.name} ===`);
    const r = await runCountry(token, tenant, cfg, emp.id);
    if (r.error) {
      console.log('ERROR', r.error);
      writeReport(cfg, computeExpectedLitmus(cfg), { gross: 0, totalDeductions: 0, net: 0, currency: cfg.currency, deductionLines: [] }, [{
        field: 'API',
        expected: 'success',
        actual: r.error,
        note: 'Payroll run failed before payslip could be verified.',
      }], { runId: 'n/a', runStatus: 'ERROR' });
      results.push({ code, pass: false });
      continue;
    }
    console.log(r.pass ? 'PASS' : 'FAIL', '→', r.reportPath);
    results.push({ code, pass: r.pass, issues: r.issues?.length ?? 0 });
  }
  await prisma.$disconnect();

  const summaryPath = path.join(REPORT_DIR, 'SUMMARY.md');
  const passN = results.filter((r) => r.pass).length;
  fs.writeFileSync(summaryPath, [
    '# Global Payroll Regression Summary',
    '',
    `Date: ${new Date().toISOString()}`,
    `API: ${API}`,
    `Tenant: ${LITMUS_TENANT_KEY}`,
    '',
    `**${passN}/${results.length} countries PASS**`,
    '',
    '| Country | Result | Report |',
    '|---------|--------|--------|',
    ...results.map((r) => `| ${r.code} | ${r.pass ? 'PASS' : 'FAIL'} | [${COUNTRY_LITMUS[r.code].reportFile}](./${COUNTRY_LITMUS[r.code].reportFile}) |`),
    '',
  ].join('\n'));

  console.log(`\nSummary: ${passN}/${results.length} PASS → ${summaryPath}`);
  process.exit(passN === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
