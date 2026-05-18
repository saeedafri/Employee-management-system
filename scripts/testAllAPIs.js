#!/usr/bin/env node

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash.js';

const API_BASE = 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();

let accessToken = '';
let tenantId = '';
let userId = '';
let challengeId = '';

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

async function test(name, fn) {
  try {
    await fn();
    results.passed++;
    results.tests.push({ name, status: '✅ PASS' });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: '❌ FAIL', error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function setupTestData() {
  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      tenantKey: `test-${Date.now()}`,
      name: 'Test Tenant',
      legalName: 'Test Tenant Inc',
      displayName: 'Test',
      country: 'US',
      primaryContactEmail: 'test@company.com'
    }
  });
  tenantId = tenant.id;

  // Create test user
  const passwordHash = await hashPassword('TestPass123!@');
  const user = await prisma.user.create({
    data: {
      tenantId,
      email: 'testuser@company.com',
      passwordHash,
      memberType: 'HR_ADMIN',
      status: 'ACTIVE',
      mfaEnabled: true
    }
  });
  userId = user.id;

  // Create employee
  await prisma.employee.create({
    data: {
      tenantId,
      userId,
      firstName: 'Test',
      lastName: 'User',
      employeeCode: 'TEST001',
      workEmail: 'testuser@company.com',
      joinedOn: new Date(),
      employmentStatus: 'ACTIVE'
    }
  });
}

async function runTests() {
  console.log('\n🚀 EMS API Comprehensive Test Suite\n');
  console.log('Setting up test data...');
  await setupTestData();

  // ==================== AUTH APIS ====================
  console.log('\n📝 AUTH ENDPOINTS (3 APIs)');

  await test('POST /auth/login - MFA trigger', async () => {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: 'testuser@company.com',
      password: 'TestPass123!@'
    }, {
      headers: { 'x-tenant-key': tenantId }
    });

    if (response.status !== 202) throw new Error(`Expected 202, got ${response.status}`);
    if (!response.data.data.challengeId) throw new Error('No challengeId returned');
    if (!response.data.data.destinationMasked) throw new Error('No destinationMasked');
    challengeId = response.data.data.challengeId;
  });

  await test('POST /auth/verify-otp - OTP verification', async () => {
    // First generate OTP
    const otp = await prisma.otpChallenge.findUnique({
      where: { challengeId }
    });

    const response = await axios.post(`${API_BASE}/auth/verify-otp`, {
      challengeId,
      code: 'invalid'  // Wrong code should fail with proper error
    }, {
      headers: { 'x-tenant-key': tenantId }
    }).catch(e => e.response);

    if (response.status !== 400) throw new Error(`Expected 400 for invalid OTP, got ${response.status}`);
    if (response.data.error.code !== 'OTP_INVALID') throw new Error('Expected OTP_INVALID error code');
  });

  await test('POST /auth/otp/resend - OTP resend', async () => {
    const response = await axios.post(`${API_BASE}/auth/otp/resend`, {
      challengeId
    }, {
      headers: { 'x-tenant-key': tenantId }
    });

    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });

  // ==================== EMPLOYEE APIS ====================
  console.log('\n👥 EMPLOYEE ENDPOINTS (3 APIs)');

  // Login without MFA for testing (create non-MFA user)
  const testUserNonMFA = await prisma.user.create({
    data: {
      tenantId,
      email: 'testuser2@company.com',
      passwordHash: await hashPassword('TestPass123!@'),
      memberType: 'HR_ADMIN',
      status: 'ACTIVE',
      mfaEnabled: false
    }
  });

  const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
    email: 'testuser2@company.com',
    password: 'TestPass123!@'
  }, {
    headers: { 'x-tenant-key': tenantId }
  });
  accessToken = loginResponse.data.data.accessToken;

  await test('GET /employees - List employees', async () => {
    const response = await axios.get(`${API_BASE}/employees`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-key': tenantId
      }
    });

    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!Array.isArray(response.data.data.employees)) throw new Error('Not an array');
    if (!response.data.data.pagination) throw new Error('Missing pagination');
  });

  await test('POST /employees - Create employee', async () => {
    const response = await axios.post(`${API_BASE}/employees`, {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@company.com',
      jobTitle: 'Developer',
      departmentId: (await prisma.department.create({
        data: {
          tenantId,
          name: 'Engineering',
          code: 'ENG'
        }
      })).id,
      employmentType: 'FULL_TIME'
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-key': tenantId
      }
    });

    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}`);
    if (!response.data.data.id) throw new Error('No employee ID returned');
  });

  await test('GET /employees/:id - Get employee profile', async () => {
    const emp = await prisma.employee.findFirst({ where: { tenantId } });
    const response = await axios.get(`${API_BASE}/employees/${emp.id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-key': tenantId
      }
    });

    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (response.data.data.firstName !== emp.firstName) throw new Error('Name mismatch');
  });

  // ==================== DEPARTMENT APIS ====================
  console.log('\n🏢 DEPARTMENT ENDPOINTS (4 APIs)');

  await test('GET /departments - List departments', async () => {
    const response = await axios.get(`${API_BASE}/departments`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-key': tenantId
      }
    });

    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!Array.isArray(response.data.data)) throw new Error('Not an array');
  });

  await test('POST /departments - Create department', async () => {
    const response = await axios.post(`${API_BASE}/departments`, {
      name: 'HR',
      code: 'HR',
      parentId: null
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-key': tenantId
      }
    });

    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}`);
  });

  await test('PATCH /departments/:id - Update department', async () => {
    const dept = await prisma.department.findFirst({ where: { tenantId } });
    const response = await axios.patch(`${API_BASE}/departments/${dept.id}`, {
      name: 'Updated HR'
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-key': tenantId
      }
    });

    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });

  await test('DELETE /departments/:id - Delete department', async () => {
    const dept = await prisma.department.create({
      data: {
        tenantId,
        name: 'ToDelete',
        code: 'DEL'
      }
    });

    const response = await axios.delete(`${API_BASE}/departments/${dept.id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-key': tenantId
      }
    });

    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });

  // ==================== HOLIDAYS APIS ====================
  console.log('\n🎉 HOLIDAYS ENDPOINTS (4 APIs)');

  await test('GET /holidays - List holidays', async () => {
    const response = await axios.get(`${API_BASE}/holidays?year=2026`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-key': tenantId
      }
    });

    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });

  await test('POST /holidays - Create holiday', async () => {
    const response = await axios.post(`${API_BASE}/holidays`, {
      name: 'Independence Day',
      holidayDate: '2026-07-04',
      location: 'US',
      isOptional: false
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-key': tenantId
      }
    });

    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}`);
  });

  await test('PATCH /holidays/:id - Update holiday', async () => {
    const holiday = await prisma.holiday.findFirst({ where: { tenantId } });
    const response = await axios.patch(`${API_BASE}/holidays/${holiday.id}`, {
      name: 'Updated Holiday'
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-key': tenantId
      }
    });

    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });

  await test('DELETE /holidays/:id - Delete holiday', async () => {
    const holiday = await prisma.holiday.findFirst({ where: { tenantId } });
    const response = await axios.delete(`${API_BASE}/holidays/${holiday.id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-key': tenantId
      }
    });

    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total: ${results.passed + results.failed}`);
  console.log('='.repeat(60) + '\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
