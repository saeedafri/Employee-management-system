/**
 * resolveEmployeeTimezone documents its chain as legal entity -> tenant -> UTC,
 * but only ever read TenantConfig.timezone. Tenant.timezone -- where seed.js and
 * the tenant record actually store it -- was skipped, so a tenant with no
 * TenantConfig row silently got UTC.
 *
 * That is not cosmetic: attendance day boundaries come from this. For an
 * Asia/Kolkata tenant it puts every check-in after 18:30 local on the PREVIOUS
 * day. Caught by the attendance timezone contract test once CI actually ran the
 * DB suite on a UTC host; an IST laptop hid it.
 *
 * Run: node --test --experimental-test-module-mocks tests/employee-timezone-fallback.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveEmployeeTimezone } from '../src/modules/holidays/holidayResolver.service.js';

/** @param {{config?: string|null, tenant?: string|null, entity?: string|null}} setup */
function fakePrisma({ config = null, tenant = null, entity = null } = {}) {
  return {
    employeeSalary: {
      findFirst: async () => (entity ? { legalEntityId: 'le-1' } : null),
    },
    legalEntity: {
      findFirst: async () => (entity ? { timezone: entity } : null),
    },
    tenantConfig: {
      findUnique: async () => (config ? { timezone: config } : null),
    },
    tenant: {
      findUnique: async () => (tenant ? { timezone: tenant } : null),
    },
  };
}

describe('resolveEmployeeTimezone fallback chain', () => {
  it('falls back to Tenant.timezone when there is no TenantConfig row', async () => {
    const timezone = await resolveEmployeeTimezone(fakePrisma({ tenant: 'Asia/Kolkata' }), 't1', 'emp-1');
    assert.equal(timezone, 'Asia/Kolkata', 'must not silently become UTC');
  });

  it('prefers the legal entity over everything', async () => {
    const prisma = fakePrisma({ entity: 'Europe/Dublin', config: 'Asia/Kolkata', tenant: 'America/New_York' });
    assert.equal(await resolveEmployeeTimezone(prisma, 't1', 'emp-1'), 'Europe/Dublin');
  });

  it('prefers TenantConfig over Tenant when both are set', async () => {
    const prisma = fakePrisma({ config: 'Asia/Kolkata', tenant: 'America/New_York' });
    assert.equal(await resolveEmployeeTimezone(prisma, 't1', 'emp-1'), 'Asia/Kolkata');
  });

  it('still ends at UTC when nothing is configured anywhere', async () => {
    assert.equal(await resolveEmployeeTimezone(fakePrisma(), 't1', 'emp-1'), 'UTC');
  });

  it('resolves without an employeeId (tenant-scoped callers)', async () => {
    assert.equal(await resolveEmployeeTimezone(fakePrisma({ tenant: 'Asia/Kolkata' }), 't1', null), 'Asia/Kolkata');
  });
});
