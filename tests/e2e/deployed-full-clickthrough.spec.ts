import { test, expect } from '@playwright/test';
import { runCompleteFinalAudit } from '../../scripts/deployed-ui-complete-final-audit.mjs';

test.describe.serial('Deployed UI complete final audit', () => {
  test('full E2E — all modules, mutations, evidence', async () => {
    test.setTimeout(900000);
    const summary = await runCompleteFinalAudit({ headless: true, seedFirst: true });
    expect(summary.failures, JSON.stringify(summary.results.filter((r) => r.result === 'FAIL'), null, 2)).toBe(0);
    expect(['PASS', 'PARTIAL']).toContain(summary.verdict);
  });
});
