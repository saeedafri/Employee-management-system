/**
 * Payroll Module Seed — Production-safe (idempotent, no deletes)
 *
 * Creates:
 *   - 7 salary components (BASIC, HRA, CONVEYANCE, MEDICAL, SPECIAL_ALLOW, PF, PT)
 *   - 2 pay groups (Standard Monthly, Senior Monthly)
 *   - Employee salaries for 6 employees with realistic CTCs + bank details
 *   - 3 completed payroll runs (March, April, May 2026) with payslips
 *   - Payslip documents uploaded to Cloudinary for each employee
 *
 * Run:  node prisma/seedPayroll.mjs
 */

import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { createCanvas } from 'canvas';
import sharp from 'sharp';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync, existsSync } from 'fs';

dotenv.config();

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const TENANT_KEY = 'acme-corp-001';

// ── Formula evaluator (inline — no circular imports) ───────────────────────

function topologicalSort(components) {
  const codeMap = Object.fromEntries(components.map((c) => [c.code, c]));
  const deps = {};
  for (const c of components) {
    deps[c.code] = [];
    if (c.calculationType === 'PERCENTAGE' && c.basisCode && codeMap[c.basisCode]) {
      deps[c.code].push(c.basisCode);
    } else if (c.calculationType === 'FORMULA' && c.formula) {
      const tokens = (c.formula.match(/[A-Z][A-Z0-9_]*/g) || []);
      deps[c.code] = tokens.filter((t) => codeMap[t]);
    }
  }
  const result = [];
  const visited = new Set();
  function visit(code) {
    if (visited.has(code)) return;
    visited.add(code);
    for (const dep of deps[code] || []) visit(dep);
    if (codeMap[code]) result.push(codeMap[code]);
  }
  for (const code of Object.keys(deps)) visit(code);
  return result;
}

function calcComponents(pgComponents, annualCtc) {
  const ctcMonthly = Number(annualCtc) / 12;
  const effectiveComponents = pgComponents.map((pgc) => ({
    code: pgc.component.code, name: pgc.component.name,
    type: pgc.component.type, taxable: pgc.component.taxable,
    calculationType: pgc.overrideCalculationType || pgc.component.calculationType,
    value: pgc.overrideValue != null ? Number(pgc.overrideValue) : (pgc.component.value != null ? Number(pgc.component.value) : null),
    basisCode: pgc.component.basisCode,
    formula: pgc.overrideFormula || pgc.component.formula,
    displayOrder: pgc.component.displayOrder,
  }));

  const sorted = topologicalSort(effectiveComponents);
  const computed = { CTC: ctcMonthly };
  const earningsArr = [], deductionsArr = [], calculated = [];

  for (const comp of sorted) {
    let amount = 0;
    try {
      if (comp.calculationType === 'FLAT') {
        amount = comp.value || 0;
      } else if (comp.calculationType === 'PERCENTAGE') {
        amount = ((comp.value || 0) / 100) * (computed[comp.basisCode] || 0);
      } else if (comp.calculationType === 'FORMULA') {
        computed.GROSS = earningsArr.reduce((s, e) => s + e.amount, 0);
        computed.NET = computed.GROSS - deductionsArr.reduce((s, d) => s + d.amount, 0);
        // safe eval — formula only contains arithmetic ops
        const scope = { ...computed, MIN: Math.min, MAX: Math.max, ABS: Math.abs, ROUND: Math.round, FLOOR: Math.floor, CEIL: Math.ceil, IF: (c, t, f) => (c ? t : f) };
        const fn = new Function(...Object.keys(scope), `"use strict"; return (${comp.formula});`);
        amount = fn(...Object.values(scope));
      }
    } catch {
      amount = 0;
    }
    amount = Math.round(amount * 100) / 100;
    computed[comp.code] = amount;
    const item = { code: comp.code, name: comp.name, type: comp.type, monthlyAmount: amount, taxable: comp.taxable };
    calculated.push(item);
    if (comp.type === 'EARNING') earningsArr.push({ amount });
    else if (comp.type === 'DEDUCTION') deductionsArr.push({ amount });
  }

  const gross = earningsArr.reduce((s, e) => s + e.amount, 0);
  const deductions = deductionsArr.reduce((s, d) => s + d.amount, 0);
  return { calculated, gross, deductions, net: gross - deductions };
}

// ── Payslip SVG document generator ─────────────────────────────────────────

function buildPayslipSvg({ employee, period, earnings, deductions, gross, totalDed, net, company, currency }) {
  const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
  const periodLabel = (() => {
    const [y, m] = period.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  })();

  const earningRows = earnings.map((e, i) => `
    <rect x="30" y="${280 + i * 28}" width="360" height="26" fill="${i % 2 === 0 ? '#F8FAFF' : '#FFFFFF'}"/>
    <text x="40" y="${297 + i * 28}" font-size="12" fill="#374151">${e.name}</text>
    <text x="380" y="${297 + i * 28}" font-size="12" fill="#374151" text-anchor="end">${currency} ${fmt(e.monthlyAmount)}</text>
  `).join('');

  const dedRows = deductions.map((d, i) => `
    <rect x="30" y="${280 + i * 28}" width="360" height="26" fill="${i % 2 === 0 ? '#FFF8F8' : '#FFFFFF'}"/>
    <text x="40" y="${297 + i * 28}" font-size="12" fill="#374151">${d.name}</text>
    <text x="380" y="${297 + i * 28}" font-size="12" fill="#DC2626" text-anchor="end">- ${currency} ${fmt(d.monthlyAmount)}</text>
  `).join('');

  const earningsHeight = earnings.length * 28 + 20;
  const deductionsHeight = deductions.length * 28 + 20;
  const totalHeight = 520 + earningsHeight + deductionsHeight;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="${totalHeight}" viewBox="0 0 420 ${totalHeight}">
  <!-- Background -->
  <rect width="420" height="${totalHeight}" fill="#FFFFFF"/>

  <!-- Header band -->
  <rect x="0" y="0" width="420" height="80" fill="#1E3A5F"/>
  <text x="20" y="32" font-size="18" font-weight="bold" fill="#FFFFFF">${company}</text>
  <text x="20" y="52" font-size="11" fill="#93C5FD">PAYSLIP</text>
  <text x="20" y="68" font-size="11" fill="#93C5FD">${periodLabel}</text>

  <!-- Employee info box -->
  <rect x="15" y="90" width="390" height="90" rx="6" fill="#F0F4FF" stroke="#C7D7FD" stroke-width="1"/>
  <text x="25" y="112" font-size="11" fill="#6B7280">EMPLOYEE NAME</text>
  <text x="25" y="128" font-size="13" font-weight="bold" fill="#111827">${employee.name}</text>
  <text x="25" y="146" font-size="11" fill="#6B7280">Employee ID: ${employee.code}</text>
  <text x="25" y="162" font-size="11" fill="#6B7280">Designation: ${employee.designation || '—'} | Dept: ${employee.dept || '—'}</text>

  <text x="290" y="112" font-size="11" fill="#6B7280">PAY PERIOD</text>
  <text x="290" y="128" font-size="12" font-weight="bold" fill="#111827">${periodLabel}</text>
  <text x="290" y="146" font-size="11" fill="#6B7280">Bank: ${employee.bankName || 'N/A'}</text>
  <text x="290" y="162" font-size="11" fill="#6B7280">A/C: XXXX${employee.bankLast4 || '0000'}</text>

  <!-- EARNINGS section -->
  <text x="20" y="205" font-size="13" font-weight="bold" fill="#1E3A5F">EARNINGS</text>
  <line x1="15" y1="210" x2="405" y2="210" stroke="#E5E7EB" stroke-width="1"/>
  <rect x="15" y="215" width="390" height="24" fill="#EEF2FF"/>
  <text x="25" y="231" font-size="11" font-weight="bold" fill="#4B5563">Component</text>
  <text x="395" y="231" font-size="11" font-weight="bold" fill="#4B5563" text-anchor="end">Amount (${currency})</text>

  <g transform="translate(15, 239)">
    ${earningRows}
    <!-- Gross total -->
    <rect x="0" y="${earningsHeight - 8}" width="390" height="28" fill="#1E3A5F" rx="3"/>
    <text x="10" y="${earningsHeight + 10}" font-size="12" font-weight="bold" fill="#FFFFFF">Gross Earnings</text>
    <text x="380" y="${earningsHeight + 10}" font-size="12" font-weight="bold" fill="#FFFFFF" text-anchor="end">${currency} ${fmt(gross)}</text>
  </g>

  <!-- DEDUCTIONS section -->
  <text x="20" y="${260 + earningsHeight}" font-size="13" font-weight="bold" fill="#DC2626">DEDUCTIONS</text>
  <line x1="15" y1="${265 + earningsHeight}" x2="405" y2="${265 + earningsHeight}" stroke="#E5E7EB" stroke-width="1"/>
  <rect x="15" y="${270 + earningsHeight}" width="390" height="24" fill="#FEF2F2"/>
  <text x="25" y="${286 + earningsHeight}" font-size="11" font-weight="bold" fill="#4B5563">Component</text>
  <text x="395" y="${286 + earningsHeight}" font-size="11" font-weight="bold" fill="#4B5563" text-anchor="end">Amount (${currency})</text>

  <g transform="translate(15, ${294 + earningsHeight})">
    ${dedRows}
    <!-- Total deductions -->
    <rect x="0" y="${deductionsHeight - 8}" width="390" height="28" fill="#991B1B" rx="3"/>
    <text x="10" y="${deductionsHeight + 10}" font-size="12" font-weight="bold" fill="#FFFFFF">Total Deductions</text>
    <text x="380" y="${deductionsHeight + 10}" font-size="12" font-weight="bold" fill="#FFFFFF" text-anchor="end">- ${currency} ${fmt(totalDed)}</text>
  </g>

  <!-- NET PAY band -->
  <rect x="0" y="${370 + earningsHeight + deductionsHeight}" width="420" height="60" fill="#065F46"/>
  <text x="20" y="${402 + earningsHeight + deductionsHeight}" font-size="14" font-weight="bold" fill="#FFFFFF">NET PAY</text>
  <text x="400" y="${402 + earningsHeight + deductionsHeight}" font-size="18" font-weight="bold" fill="#6EE7B7" text-anchor="end">${currency} ${fmt(net)}</text>
  <text x="20" y="${418 + earningsHeight + deductionsHeight}" font-size="10" fill="#A7F3D0">Credited to your bank account</text>

  <!-- Footer -->
  <text x="210" y="${460 + earningsHeight + deductionsHeight}" font-size="9" fill="#9CA3AF" text-anchor="middle">This is a computer-generated payslip. No signature required.</text>
  <text x="210" y="${475 + earningsHeight + deductionsHeight}" font-size="9" fill="#9CA3AF" text-anchor="middle">Generated by ${company} HR System</text>
</svg>`;
}

async function uploadPayslipToCloudinary(svgContent, publicId) {
  const buffer = Buffer.from(svgContent, 'utf-8');
  const webpBuffer = await sharp(buffer).webp({ quality: 90 }).toBuffer();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: 'ems/payslips',
        resource_type: 'image',
        format: 'webp',
        overwrite: true,
        tags: ['payslip', 'auto-generated'],
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(webpBuffer);
  });
}

// ── Main seed ───────────────────────────────────────────────────────────────

async function main() {
  console.log('💰 Seeding payroll data...\n');

  // 1. Get tenant
  const tenant = await prisma.tenant.findUnique({ where: { tenantKey: TENANT_KEY } });
  if (!tenant) throw new Error(`Tenant ${TENANT_KEY} not found — run npm run db:seed first`);
  const tenantId = tenant.id;

  // 2. Get HR admin user (for initiatedById on payroll runs)
  const hrUser = await prisma.user.findFirst({ where: { tenantId, email: 'hr@acme.test' } });
  if (!hrUser) throw new Error('HR user hr@acme.test not found — run npm run db:seed first');

  // 3. Get employees to assign salaries
  const targetEmails = [
    'hr@acme.test',
    'aman@acme.test',
    'priya@acme.test',
    'dev1@acme.test',
    'dev2@acme.test',
    'fin1@acme.test',
    'riya@acme.test',
  ];
  const users = await prisma.user.findMany({
    where: { tenantId, email: { in: targetEmails } },
    include: { employee: { include: { department: { select: { name: true } } } } },
  });
  const empByEmail = Object.fromEntries(
    users.filter((u) => u.employee).map((u) => [u.email, u.employee])
  );

  console.log(`Found ${Object.keys(empByEmail).length} employees to seed salaries for`);

  // ── 4. Create Salary Components (idempotent) ────────────────────────────

  const componentDefs = [
    { code: 'BASIC', name: 'Basic Salary', type: 'EARNING', calculationType: 'PERCENTAGE', value: 40, basisCode: 'CTC', taxable: true, displayOrder: 1, description: '40% of monthly CTC' },
    { code: 'HRA', name: 'House Rent Allowance', type: 'EARNING', calculationType: 'PERCENTAGE', value: 50, basisCode: 'BASIC', taxable: true, displayOrder: 2, description: '50% of Basic' },
    { code: 'CONVEYANCE', name: 'Conveyance Allowance', type: 'EARNING', calculationType: 'FLAT', value: 1600, basisCode: null, taxable: false, displayOrder: 3, description: 'Fixed conveyance' },
    { code: 'MEDICAL', name: 'Medical Allowance', type: 'EARNING', calculationType: 'FLAT', value: 1250, basisCode: null, taxable: false, displayOrder: 4, description: 'Fixed medical reimbursement' },
    { code: 'SPECIAL_ALLOW', name: 'Special Allowance', type: 'EARNING', calculationType: 'FORMULA', value: null, formula: 'CTC - BASIC - HRA - CONVEYANCE - MEDICAL', taxable: true, displayOrder: 5, description: 'Balancer = CTC - all other components' },
    { code: 'PF', name: 'Provident Fund (Employee)', type: 'DEDUCTION', calculationType: 'PERCENTAGE', value: 12, basisCode: 'BASIC', taxable: false, displayOrder: 10, description: '12% of Basic (EPF)' },
    { code: 'PROF_TAX', name: 'Professional Tax', type: 'DEDUCTION', calculationType: 'FLAT', value: 200, basisCode: null, taxable: false, displayOrder: 11, description: 'State professional tax' },
  ];

  const componentMap = {};
  for (const def of componentDefs) {
    const existing = await prisma.salaryComponent.findUnique({
      where: { tenantId_code: { tenantId, code: def.code } },
    });
    if (existing) {
      componentMap[def.code] = existing;
      console.log(`  ↳ Component ${def.code} already exists`);
    } else {
      const created = await prisma.salaryComponent.create({
        data: { tenantId, ...def, basisCode: def.basisCode ?? null, formula: def.formula ?? null, active: true },
      });
      componentMap[def.code] = created;
      console.log(`  ✅ Created component: ${def.code}`);
    }
  }

  // ── 5. Create Pay Groups ────────────────────────────────────────────────

  const payGroupDefs = [
    {
      code: 'STD_MONTHLY', name: 'Standard Monthly', paySchedule: 'MONTHLY', currency: 'INR',
      description: 'Standard pay group for regular employees',
      components: ['BASIC', 'HRA', 'CONVEYANCE', 'MEDICAL', 'SPECIAL_ALLOW', 'PF', 'PROF_TAX'],
    },
    {
      code: 'SENIOR_MONTHLY', name: 'Senior Monthly', paySchedule: 'MONTHLY', currency: 'INR',
      description: 'Pay group for senior/managerial staff — same structure, higher CTC band',
      components: ['BASIC', 'HRA', 'CONVEYANCE', 'MEDICAL', 'SPECIAL_ALLOW', 'PF', 'PROF_TAX'],
    },
  ];

  const payGroupMap = {};
  for (const pgDef of payGroupDefs) {
    const existing = await prisma.payGroup.findUnique({
      where: { tenantId_code: { tenantId, code: pgDef.code } },
      include: { components: true },
    });
    if (existing) {
      payGroupMap[pgDef.code] = existing;
      console.log(`  ↳ Pay group ${pgDef.code} already exists`);
    } else {
      const pg = await prisma.payGroup.create({
        data: {
          tenantId, name: pgDef.name, code: pgDef.code, paySchedule: pgDef.paySchedule,
          currency: pgDef.currency, description: pgDef.description, active: true,
          components: {
            create: pgDef.components.map((code) => ({ componentId: componentMap[code].id })),
          },
        },
        include: { components: { include: { component: true } } },
      });
      payGroupMap[pgDef.code] = pg;
      console.log(`  ✅ Created pay group: ${pgDef.code}`);
    }
  }

  // ── 6. Assign Employee Salaries ─────────────────────────────────────────

  const salaryAssignments = [
    { email: 'hr@acme.test',    payGroupCode: 'SENIOR_MONTHLY', annualCtc: 1440000, bankName: 'HDFC Bank',  bankAccountName: 'HR Admin',      bankAccountNumber: '50100123456789', bankIfscCode: 'HDFC0001234' },
    { email: 'aman@acme.test',  payGroupCode: 'SENIOR_MONTHLY', annualCtc: 1800000, bankName: 'ICICI Bank', bankAccountName: 'Aman Sharma',    bankAccountNumber: '000801234567890', bankIfscCode: 'ICIC0000215' },
    { email: 'riya@acme.test',  payGroupCode: 'SENIOR_MONTHLY', annualCtc: 1560000, bankName: 'Axis Bank',  bankAccountName: 'Riya Mehta',     bankAccountNumber: '917020098765432', bankIfscCode: 'UTIB0002147' },
    { email: 'priya@acme.test', payGroupCode: 'STD_MONTHLY',    annualCtc: 900000,  bankName: 'SBI',        bankAccountName: 'Priya Singh',    bankAccountNumber: '20234567890123',  bankIfscCode: 'SBIN0001234' },
    { email: 'dev1@acme.test',  payGroupCode: 'STD_MONTHLY',    annualCtc: 1080000, bankName: 'Kotak Bank', bankAccountName: 'Dev Engineer 1', bankAccountNumber: '1234567890123',   bankIfscCode: 'KKBK0007458' },
    { email: 'dev2@acme.test',  payGroupCode: 'STD_MONTHLY',    annualCtc: 840000,  bankName: 'Yes Bank',   bankAccountName: 'Dev Engineer 2', bankAccountNumber: '0046789012345',   bankIfscCode: 'YESB0000185' },
    { email: 'fin1@acme.test',  payGroupCode: 'STD_MONTHLY',    annualCtc: 960000,  bankName: 'PNB',        bankAccountName: 'Finance Staff 1', bankAccountNumber: '7654321098765',  bankIfscCode: 'PUNB0234500' },
  ];

  const salaryMap = {}; // email → salary record
  for (const assignment of salaryAssignments) {
    const employee = empByEmail[assignment.email];
    if (!employee) {
      console.log(`  ⚠️  Employee not found for ${assignment.email} — skipping`);
      continue;
    }
    const existing = await prisma.employeeSalary.findFirst({
      where: { tenantId, employeeId: employee.id, effectiveTo: null },
    });
    if (existing) {
      salaryMap[assignment.email] = existing;
      console.log(`  ↳ Salary for ${assignment.email} already set`);
    } else {
      const payGroupId = payGroupMap[assignment.payGroupCode].id;
      const sal = await prisma.employeeSalary.create({
        data: {
          tenantId, employeeId: employee.id, payGroupId,
          annualCtc: assignment.annualCtc,
          effectiveFrom: new Date('2026-01-01'),
          bankName: assignment.bankName,
          bankAccountName: assignment.bankAccountName,
          bankAccountNumber: assignment.bankAccountNumber,
          bankIfscCode: assignment.bankIfscCode,
        },
      });
      salaryMap[assignment.email] = sal;
      console.log(`  ✅ Salary set for ${assignment.email}: ₹${(assignment.annualCtc / 100000).toFixed(1)}L CTC`);
    }
  }

  // ── 7. Create Payroll Runs + Payslips ───────────────────────────────────

  const periods = ['2026-03', '2026-04', '2026-05'];
  const runMap = {}; // period → run record

  for (const period of periods) {
    const existingRun = await prisma.payrollRun.findFirst({
      where: { tenantId, period, status: { not: 'CANCELLED' } },
    });
    if (existingRun) {
      runMap[period] = existingRun;
      console.log(`  ↳ Payroll run ${period} already exists (${existingRun.status})`);
      continue;
    }

    // Compute payslips manually for this period
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // Working days in period
    let workingDays = 0;
    const cur = new Date(periodStart);
    while (cur <= periodEnd) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) workingDays++;
      cur.setDate(cur.getDate() + 1);
    }

    // Build payslip data for each salary assignment
    const payslipData = [];
    for (const assignment of salaryAssignments) {
      const employee = empByEmail[assignment.email];
      if (!employee) continue;

      const pg = await prisma.payGroup.findUnique({
        where: { tenantId_code: { tenantId, code: assignment.payGroupCode } },
        include: { components: { include: { component: true }, orderBy: [{ component: { displayOrder: 'asc' } }] } },
      });
      if (!pg) continue;

      const { calculated, gross, deductions: ded, net } = calcComponents(pg.components, assignment.annualCtc);
      const earnings = calculated.filter((c) => c.type === 'EARNING');
      const deductionsList = calculated.filter((c) => c.type === 'DEDUCTION');

      payslipData.push({
        employee, assignment, pg,
        earnings, deductionsList, calculated,
        gross, ded, net,
        workingDays, presentDays: workingDays,
      });
    }

    const totalGross = payslipData.reduce((s, p) => s + p.gross, 0);
    const totalDed = payslipData.reduce((s, p) => s + p.ded, 0);
    const totalNet = payslipData.reduce((s, p) => s + p.net, 0);

    const byDept = {};
    for (const p of payslipData) {
      const deptName = p.employee.department?.name || 'Unassigned';
      if (!byDept[deptName]) byDept[deptName] = { name: deptName, employeeCount: 0, totalNet: 0 };
      byDept[deptName].employeeCount++;
      byDept[deptName].totalNet += p.net;
    }

    const run = await prisma.payrollRun.create({
      data: {
        tenantId, period, initiatedById: hrUser.id,
        status: 'PAID',
        currency: 'INR',
        employeeCount: payslipData.length,
        totalGross, totalDeductions: totalDed, totalNet,
        summaryJson: { byDepartment: Object.values(byDept), warnings: [] },
        processedAt: new Date(periodEnd.getTime() + 1 * 24 * 60 * 60 * 1000),
        approvedById: hrUser.id,
        approvedAt: new Date(periodEnd.getTime() + 2 * 24 * 60 * 60 * 1000),
        paidAt: new Date(periodEnd.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
    });
    runMap[period] = run;
    console.log(`\n  ✅ Payroll run ${period}: ${payslipData.length} employees, ₹${(totalNet / 1000).toFixed(1)}K net`);

    // Create payslips
    const paymentDate = new Date(periodEnd.getTime() + 3 * 24 * 60 * 60 * 1000);
    for (const p of payslipData) {
      const existingSlip = await prisma.payslip.findFirst({
        where: { tenantId, employeeId: p.employee.id, period },
      });
      if (existingSlip) {
        console.log(`    ↳ Payslip for ${p.assignment.email} ${period} already exists`);
        continue;
      }

      // Generate and upload document to Cloudinary
      let documentUrl = null;
      try {
        const svgContent = buildPayslipSvg({
          employee: {
            name: `${p.employee.firstName} ${p.employee.lastName}`,
            code: p.employee.employeeCode || 'EMP',
            designation: p.employee.designation,
            dept: p.employee.department?.name,
            bankName: p.assignment.bankName,
            bankLast4: p.assignment.bankAccountNumber.slice(-4),
          },
          period,
          earnings: p.earnings,
          deductions: p.deductionsList,
          gross: p.gross,
          totalDed: p.ded,
          net: p.net,
          company: 'Acme Corporation',
          currency: '₹',
        });

        const publicId = `payslip_${p.employee.employeeCode || p.employee.id}_${period.replace('-', '_')}`;
        documentUrl = await uploadPayslipToCloudinary(svgContent, publicId);
        console.log(`    📄 Uploaded payslip for ${p.assignment.email} → ${documentUrl}`);
      } catch (err) {
        console.warn(`    ⚠️  Cloudinary upload failed for ${p.assignment.email}: ${err.message}`);
      }

      await prisma.payslip.create({
        data: {
          tenantId, employeeId: p.employee.id, payrollRunId: run.id,
          period, currency: 'INR',
          earningsJson: p.earnings,
          deductionsJson: p.deductionsList,
          oneTimeAdditionsJson: [],
          oneTimeDeductionsJson: [],
          grossEarnings: p.gross,
          totalDeductions: p.ded,
          netPay: p.net,
          workingDays: p.workingDays,
          presentDays: p.presentDays,
          leaveDays: 0, lopDays: 0,
          status: 'PAID',
          paymentDate,
          paymentReference: `PAY-${period}-${(p.employee.employeeCode || p.employee.id).toUpperCase()}`,
          generatedAt: new Date(periodEnd.getTime() + 1000),
          documentUrl,
        },
      });
      console.log(`    ✅ Payslip created for ${p.assignment.email} (${period})`);
    }
  }

  // ── 8. Create a DRAFT run for June 2026 (to test the full lifecycle) ────

  const draftPeriod = '2026-06';
  const existingDraft = await prisma.payrollRun.findFirst({
    where: { tenantId, period: draftPeriod, status: { not: 'CANCELLED' } },
  });
  if (!existingDraft) {
    await prisma.payrollRun.create({
      data: { tenantId, period: draftPeriod, initiatedById: hrUser.id, currency: 'INR' },
    });
    console.log(`\n  ✅ DRAFT payroll run for ${draftPeriod} created (ready to test calculate → approve → pay lifecycle)`);
  } else {
    console.log(`\n  ↳ Draft run for ${draftPeriod} already exists`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  const [compCount, pgCount, salaryCount, runCount, slipCount] = await Promise.all([
    prisma.salaryComponent.count({ where: { tenantId } }),
    prisma.payGroup.count({ where: { tenantId } }),
    prisma.employeeSalary.count({ where: { tenantId } }),
    prisma.payrollRun.count({ where: { tenantId } }),
    prisma.payslip.count({ where: { tenantId } }),
  ]);

  console.log(`
╔══════════════════════════════════════════╗
║       Payroll Seed Complete              ║
╠══════════════════════════════════════════╣
║  Salary Components : ${String(compCount).padEnd(20)}║
║  Pay Groups        : ${String(pgCount).padEnd(20)}║
║  Employee Salaries : ${String(salaryCount).padEnd(20)}║
║  Payroll Runs      : ${String(runCount).padEnd(20)}║
║  Payslips          : ${String(slipCount).padEnd(20)}║
╚══════════════════════════════════════════╝
`);
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
