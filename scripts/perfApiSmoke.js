import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const OUTPUT_DIR = './artifacts/performance';

let managerToken = null;
let employeeToken = null;
let testTenantKey = null;

const tests = [
  {
    name: 'analytics-summary-cached',
    method: 'GET',
    path: '/api/v1/analytics/summary',
    requireAuth: 'admin',
    warmupRuns: 1,
    measuredRuns: 10,
    expectedP95: 20,
  },
  {
    name: 'manager-dashboard',
    method: 'GET',
    path: '/api/v1/dashboard/manager',
    requireAuth: 'manager',
    warmupRuns: 0,
    measuredRuns: 10,
    expectedP95: 150,
  },
  {
    name: 'manager-team-attendance',
    method: 'GET',
    path: '/api/v1/dashboard/manager/team-attendance?range=7d',
    requireAuth: 'manager',
    warmupRuns: 0,
    measuredRuns: 10,
    expectedP95: 150,
  },
  {
    name: 'employee-dashboard',
    method: 'GET',
    path: '/api/v1/dashboard/employee',
    requireAuth: 'employee',
    warmupRuns: 0,
    measuredRuns: 10,
    expectedP95: 120,
  },
  {
    name: 'employee-today',
    method: 'GET',
    path: '/api/v1/dashboard/employee/today',
    requireAuth: 'employee',
    warmupRuns: 0,
    measuredRuns: 10,
    expectedP95: 120,
  },
];

async function httpRequest(method, url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const startTime = process.hrtime.bigint();

    const req = client.request(url, { method, ...options }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1000000;

        try {
          resolve({
            statusCode: res.statusCode,
            durationMs,
            success: res.statusCode >= 200 && res.statusCode < 300,
          });
        } catch {
          resolve({
            statusCode: res.statusCode,
            durationMs,
            success: false,
          });
        }
      });
    });

    req.on('error', (error) => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1000000;
      resolve({
        statusCode: 0,
        durationMs,
        success: false,
        error: error.message,
      });
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function loginUser(email, memberType) {
  try {
    const response = await httpRequest('POST', `${BASE_URL}/api/v1/auth/login`, {
      headers: { 'content-type': 'application/json', 'x-tenant-key': testTenantKey },
      body: { email, password: 'password' },
    });
    if (response.statusCode === 200 && response.success) {
      // Parse response to get token
      return null; // Would need to parse body - simplified for now
    }
  } catch (error) {
    console.error(`Failed to login ${email}:`, error.message);
  }
  return null;
}

async function setupTokens() {
  console.log('Setting up test tokens...');
  // Use hardcoded tokens for testing - in real scenario would login
  managerToken = 'Bearer test-manager-token';
  employeeToken = 'Bearer test-employee-token';
  testTenantKey = 'test-tenant-key';
  console.log('Tokens ready (test mode)');
}

async function runPerfTest(test) {
  const results = {
    name: test.name,
    path: test.path,
    warmupRuns: test.warmupRuns,
    measuredRuns: test.measuredRuns,
    expectedP95: test.expectedP95,
    times: [],
    p50: 0,
    p95: 0,
    p99: 0,
    min: 0,
    max: 0,
    mean: 0,
    passed: false,
    timestamp: new Date().toISOString(),
  };

  let token = null;
  if (test.requireAuth === 'admin') {
    token = managerToken;
  } else if (test.requireAuth === 'manager') {
    token = managerToken;
  } else if (test.requireAuth === 'employee') {
    token = employeeToken;
  }

  const headers = {
    'content-type': 'application/json',
    'x-tenant-key': testTenantKey,
  };

  if (token) {
    headers.authorization = token;
  }

  const url = `${BASE_URL}${test.path}`;

  // Warmup runs
  console.log(`  Warming up ${test.name}... (${test.warmupRuns} runs)`);
  for (let i = 0; i < test.warmupRuns; i++) {
    await httpRequest(test.method, url, { headers });
  }

  // Measured runs
  console.log(`  Measuring ${test.name}... (${test.measuredRuns} runs)`);
  for (let i = 0; i < test.measuredRuns; i++) {
    const response = await httpRequest(test.method, url, { headers });
    if (response.success) {
      results.times.push(response.durationMs);
    }
  }

  // Calculate statistics
  if (results.times.length > 0) {
    results.times.sort((a, b) => a - b);
    results.min = results.times[0];
    results.max = results.times[results.times.length - 1];
    results.mean = results.times.reduce((a, b) => a + b) / results.times.length;
    results.p50 = results.times[Math.floor(results.times.length * 0.5)];
    results.p95 = results.times[Math.floor(results.times.length * 0.95)];
    results.p99 = results.times[Math.floor(results.times.length * 0.99)];
    results.passed = results.p95 <= test.expectedP95;
  }

  return results;
}

async function main() {
  console.log('Starting Performance Smoke Tests...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  await setupTokens();

  const allResults = [];

  for (const test of tests) {
    console.log(`Running: ${test.name}`);
    const result = await runPerfTest(test);
    allResults.push(result);
    console.log(
      `  P95: ${result.p95.toFixed(2)}ms (target: ${test.expectedP95}ms) - ${result.passed ? '✓ PASS' : '✗ FAIL'}`,
    );
    console.log('');
  }

  // Save results
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const reportPath = path.join(OUTPUT_DIR, 'performance-smoke-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(allResults, null, 2));

  // Print summary
  console.log('=== PERFORMANCE SUMMARY ===');
  const passed = allResults.filter((r) => r.passed).length;
  const total = allResults.length;
  console.log(`Tests Passed: ${passed}/${total}`);
  allResults.forEach((result) => {
    const status = result.passed ? '✓' : '✗';
    console.log(
      `${status} ${result.name}: P95=${result.p95.toFixed(2)}ms (target=${result.expectedP95}ms)`,
    );
  });

  console.log(`\nReport saved to: ${reportPath}`);

  process.exit(passed === total ? 0 : 1);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
