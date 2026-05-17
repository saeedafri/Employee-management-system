import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const OUTPUT_DIR = './artifacts/api-responses';

let managerToken = null;
let employeeToken = null;
let testTenantKey = null;

const endpoints = [
  // Page 04 - HR Admin Dashboard (Analytics)
  {
    name: 'page-04-analytics/01-analytics-summary-success',
    method: 'GET',
    path: '/api/v1/analytics/summary',
    requireAuth: 'admin',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-04-analytics/02-analytics-summary-unauthorized',
    method: 'GET',
    path: '/api/v1/analytics/summary',
    requireAuth: false,
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-04-analytics/03-analytics-attendance-7d',
    method: 'GET',
    path: '/api/v1/analytics/attendance?range=7d',
    requireAuth: 'admin',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-04-analytics/04-analytics-attendance-invalid-range',
    method: 'GET',
    path: '/api/v1/analytics/attendance?range=invalid',
    requireAuth: 'admin',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-04-analytics/05-headcount-by-department',
    method: 'GET',
    path: '/api/v1/analytics/headcount-by-department',
    requireAuth: 'admin',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-04-analytics/06-recent-activity',
    method: 'GET',
    path: '/api/v1/analytics/recent-activity',
    requireAuth: 'admin',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-04-analytics/07-leave-summary',
    method: 'GET',
    path: '/api/v1/analytics/leave-summary',
    requireAuth: 'admin',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },

  // Page 05 - Manager Dashboard
  {
    name: 'page-05-manager-dashboard/01-manager-dashboard-success',
    method: 'GET',
    path: '/api/v1/dashboard/manager',
    requireAuth: 'manager',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-05-manager-dashboard/02-manager-team',
    method: 'GET',
    path: '/api/v1/dashboard/manager/team',
    requireAuth: 'manager',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-05-manager-dashboard/03-manager-team-attendance-7d',
    method: 'GET',
    path: '/api/v1/dashboard/manager/team-attendance?range=7d',
    requireAuth: 'manager',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-05-manager-dashboard/04-manager-pending-approvals',
    method: 'GET',
    path: '/api/v1/dashboard/manager/pending-approvals',
    requireAuth: 'manager',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-05-manager-dashboard/05-manager-pending-approvals-employee-403',
    method: 'GET',
    path: '/api/v1/dashboard/manager/pending-approvals',
    requireAuth: 'employee',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },

  // Page 06 - Employee Dashboard
  {
    name: 'page-06-employee-dashboard/01-employee-dashboard-success',
    method: 'GET',
    path: '/api/v1/dashboard/employee',
    requireAuth: 'employee',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-06-employee-dashboard/02-employee-today',
    method: 'GET',
    path: '/api/v1/dashboard/employee/today',
    requireAuth: 'employee',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-06-employee-dashboard/03-employee-balance',
    method: 'GET',
    path: '/api/v1/dashboard/employee/balance',
    requireAuth: 'employee',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-06-employee-dashboard/04-employee-holidays',
    method: 'GET',
    path: '/api/v1/dashboard/employee/holidays',
    requireAuth: 'employee',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-06-employee-dashboard/05-employee-documents',
    method: 'GET',
    path: '/api/v1/dashboard/employee/documents',
    requireAuth: 'employee',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
  {
    name: 'page-06-employee-dashboard/06-employee-team',
    method: 'GET',
    path: '/api/v1/dashboard/employee/team',
    requireAuth: 'employee',
    headers: { 'x-tenant-key': '{{tenantKey}}' },
  },
];

async function httpRequest(method, url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, { method, ...options }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          });
        } catch {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);
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
    if (response.statusCode === 200 && response.body?.data?.accessToken) {
      return `Bearer ${response.body.data.accessToken}`;
    }
  } catch (error) {
    console.error(`Failed to login ${email}:`, error.message);
  }
  return null;
}

async function setupTokens() {
  console.log('Setting up test tokens...');
  managerToken = await loginUser('manager@test.com', 'MANAGER');
  employeeToken = await loginUser('emp@test.com', 'EMPLOYEE');
  console.log('Tokens ready:', !!managerToken, !!employeeToken);
}

async function captureEndpoint(endpoint) {
  try {
    let token = null;
    if (endpoint.requireAuth === 'admin') {
      token = managerToken; // Use manager token for admin endpoints for now
    } else if (endpoint.requireAuth === 'manager') {
      token = managerToken;
    } else if (endpoint.requireAuth === 'employee') {
      token = employeeToken;
    }

    const headers = {
      'content-type': 'application/json',
    };

    // Replace placeholders
    const urlPath = endpoint.path.replace('{{tenantKey}}', testTenantKey);
    Object.entries(endpoint.headers).forEach(([key, value]) => {
      headers[key] = value.replace('{{tenantKey}}', testTenantKey);
    });

    if (token) {
      headers.authorization = token;
    }

    const url = `${BASE_URL}${urlPath}`;
    console.log(`Capturing ${endpoint.name}...`);

    const response = await httpRequest(endpoint.method, url, { headers });

    // Sanitize sensitive data
    const sanitized = sanitizeResponse(response.body);

    const result = {
      endpoint: endpoint.name,
      url: urlPath,
      method: endpoint.method,
      statusCode: response.statusCode,
      timestamp: new Date().toISOString(),
      response: sanitized,
    };

    // Create output file
    const outputPath = path.join(OUTPUT_DIR, `${endpoint.name}.json`);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`✓ Saved ${endpoint.name}`);
  } catch (error) {
    console.error(`✗ Failed ${endpoint.name}:`, error.message);
  }
}

function sanitizeResponse(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeResponse(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Remove sensitive fields
    if (
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('key') ||
      key === 'authorization'
    ) {
      continue;
    }

    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeResponse(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

async function main() {
  console.log('Starting API Response Capture...');
  console.log(`Base URL: ${BASE_URL}`);

  // For now, set a default test tenant key
  testTenantKey = 'test-tenant-key';

  await setupTokens();

  for (const endpoint of endpoints) {
    await captureEndpoint(endpoint);
  }

  console.log('✓ API response capture complete. Results saved to artifacts/api-responses/');
}

main().catch(console.error);
