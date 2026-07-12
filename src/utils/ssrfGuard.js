// BE-SEC-6: validate outbound webhook URLs to prevent SSRF / data-egress.
// https only; reject loopback, link-local (incl. 169.254.169.254 metadata),
// and RFC-1918 / ULA private ranges — both for literal IPs and DNS results.
import { isIP } from 'node:net';
import dns from 'node:dns/promises';

function invalid(message) {
  const err = new Error(message);
  err.code = 'INVALID_WEBHOOK_URL';
  err.statusCode = 422;
  return err;
}

export function isPrivateIp(ip) {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    if (p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = p;
    if (a === 10) return true;                       // 10.0.0.0/8
    if (a === 127) return true;                      // loopback
    if (a === 0) return true;                        // 0.0.0.0/8
    if (a === 169 && b === 254) return true;         // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;         // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a === 192 && b === 0) return true;           // 192.0.0.0/24 (protocol assignments)
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true;                       // multicast / reserved
    return false;
  }
  if (v === 6) {
    let a = ip.toLowerCase();
    if (a === '::1' || a === '::') return true;                     // loopback / unspecified
    if (a.startsWith('fe80') || a.startsWith('fc') || a.startsWith('fd')) return true; // link-local / ULA
    const mapped = a.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);          // IPv4-mapped
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true; // not a recognizable IP → treat as unsafe
}

export async function assertSafeWebhookUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { throw invalid('Webhook URL is not a valid URL'); }
  if (u.protocol !== 'https:') throw invalid('Webhook URL must use https');
  const host = u.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) {
    throw invalid('Webhook URL host is not allowed');
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) throw invalid('Webhook URL host is not allowed (private/loopback)');
    return;
  }
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw invalid('Webhook host could not be resolved');
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw invalid('Webhook URL resolves to a private/loopback address');
  }
}
