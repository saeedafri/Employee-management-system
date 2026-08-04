/**
 * Emailed links must be openable by the recipient.
 * Run: node --test tests/email-link-guard.test.js
 *
 * FRONTEND_APP_URL and FRONTEND_RESET_PASSWORD_URL both default to localhost. In
 * production that silently shipped invite emails pointing at
 * http://localhost:3000/set-password — a dead button, with the token burned.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLocalUrl, EMAIL_LINK_SETTINGS } from '../src/utils/publicUrl.js';

test('localhost forms are all recognised', () => {
  for (const url of [
    'http://localhost:3000/set-password?token=abc',
    'http://127.0.0.1:5173/reset-password',
    'http://0.0.0.0:3000',
    'https://localhost/set-password',
  ]) {
    assert.equal(isLocalUrl(url), true, url);
  }
});

test('real public URLs pass', () => {
  for (const url of [
    'https://ems-frontend-iota-ten.vercel.app/set-password?token=abc',
    'https://ems.example.com/reset-password',
  ]) {
    assert.equal(isLocalUrl(url), false, url);
  }
});

test('unparseable values count as unusable, never as public', () => {
  for (const url of ['', 'not a url', '/set-password', undefined, null]) {
    assert.equal(isLocalUrl(url), true, String(url));
  }
});

test('a hostname merely containing "localhost" is not treated as local', () => {
  assert.equal(isLocalUrl('https://localhost.attacker.com/set-password'), false);
});

test('both emailed-link settings are covered by the boot check', () => {
  const names = EMAIL_LINK_SETTINGS.map(([envName]) => envName);
  assert.deepEqual(names.sort(), ['FRONTEND_APP_URL', 'FRONTEND_RESET_PASSWORD_URL']);
});
