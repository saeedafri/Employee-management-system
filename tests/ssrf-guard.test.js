// BE-SEC-6: webhook URL SSRF guard. Offline — literal IPs + protocol only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp, assertSafeWebhookUrl } from '../src/utils/ssrfGuard.js';

test('isPrivateIp flags loopback/link-local/RFC-1918/ULA', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '169.254.169.254', '0.0.0.0', '::1', 'fe80::1', 'fd00::1']) {
    assert.equal(isPrivateIp(ip), true, `${ip} should be private`);
  }
});

test('isPrivateIp allows public addresses', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '203.0.113.10']) {
    assert.equal(isPrivateIp(ip), false, `${ip} should be public`);
  }
});

test('assertSafeWebhookUrl rejects non-https', async () => {
  await assert.rejects(() => assertSafeWebhookUrl('http://example.com/hook'), (e) => e.statusCode === 422);
});

test('assertSafeWebhookUrl rejects localhost + private/metadata literals', async () => {
  for (const url of ['https://localhost/h', 'https://127.0.0.1/h', 'https://169.254.169.254/latest/meta-data', 'https://192.168.0.10/h', 'https://10.1.2.3/h']) {
    await assert.rejects(() => assertSafeWebhookUrl(url), (e) => e.code === 'INVALID_WEBHOOK_URL' && e.statusCode === 422, url);
  }
});

test('assertSafeWebhookUrl accepts a public https literal IP', async () => {
  await assertSafeWebhookUrl('https://8.8.8.8/hook'); // no throw (literal, no DNS)
});
