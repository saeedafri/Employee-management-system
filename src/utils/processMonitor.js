import os from 'os';
import { logger } from './logger.js';

const RING_MAX = 200;
const recentErrors = [];
let handlersInstalled = false;

function pushError(entry) {
  recentErrors.push(entry);
  if (recentErrors.length > RING_MAX) recentErrors.shift();
}

export function recordProcessError(kind, error, extra = {}) {
  const entry = {
    at: new Date().toISOString(),
    kind,
    message: error?.message || String(error),
    stack: error?.stack || null,
    ...extra,
  };
  pushError(entry);
  logger.error({ type: 'process_error', ...entry });
  return entry;
}

export function getRecentProcessErrors(limit = 50) {
  return recentErrors.slice(-limit).reverse();
}

export function getProcessSnapshot() {
  const mem = process.memoryUsage();
  const load = os.loadavg();
  return {
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    uptimeSec: Math.round(process.uptime()),
    memory: {
      rssBytes: mem.rss,
      heapTotalBytes: mem.heapTotal,
      heapUsedBytes: mem.heapUsed,
      externalBytes: mem.external,
      rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
    },
    loadavg: { '1m': load[0], '5m': load[1], '15m': load[2] },
    cpus: os.cpus()?.length ?? null,
    freememMb: Math.round(os.freemem() / 1024 / 1024),
    totalmemMb: Math.round(os.totalmem() / 1024 / 1024),
    recentErrors: getRecentProcessErrors(25),
  };
}

/**
 * Install once per process. Persists crash-class errors into the ring buffer.
 * Optional persistFn(entry) can write to LogEntry asynchronously.
 */
export function installProcessErrorHandlers(persistFn) {
  if (handlersInstalled) return;
  handlersInstalled = true;

  process.on('uncaughtException', (err) => {
    const entry = recordProcessError('uncaughtException', err);
    if (typeof persistFn === 'function') {
      Promise.resolve(persistFn(entry)).catch(() => {});
    }
  });

  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    const entry = recordProcessError('unhandledRejection', err);
    if (typeof persistFn === 'function') {
      Promise.resolve(persistFn(entry)).catch(() => {});
    }
  });

  process.on('warning', (warning) => {
    recordProcessError('warning', warning);
  });
}
