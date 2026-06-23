// Payroll CALCULATING runs as a BullMQ job off the request path (per the backend
// contract: "heavy payroll compute runs as a BullMQ job, not on the request path").
// The heavy math is UNCHANGED — the worker calls the same repo.calculatePayrollRun
// the synchronous path used. Idempotency: jobId `calc:<runId>` dedupes concurrent
// enqueues, and the repo's DRAFT-status guard makes a late/duplicate job a no-op.
import { Queue, Worker } from 'bullmq';
import { createQueueConnection, redisEnabled } from './redis.js';
import { prisma } from '../plugins/prisma.js';
import * as payrollRepo from '../modules/payroll/payroll.repository.js';
import { logger } from '../utils/logger.js';

const QUEUE_NAME = 'payroll-calculate';

let queue = null;
let worker = null;

export function getPayrollQueue() {
  if (!redisEnabled) return null;
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: createQueueConnection() });
  }
  return queue;
}

/**
 * Enqueue a calculate job. Returns true if queued (Redis available), false if not
 * (caller should compute synchronously). jobId dedupes double-submits.
 */
export async function enqueueCalculate(runId, tenantId) {
  const q = getPayrollQueue();
  if (!q) return false;
  try {
    await q.add(
      'calculate',
      { runId, tenantId },
      {
        jobId: `calc:${runId}`,
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    return true;
  } catch (e) {
    // Redis unreachable mid-flight → let the caller fall back to synchronous compute.
    logger.error({ runId, err: e?.message }, 'enqueueCalculate failed; falling back to sync');
    return false;
  }
}

/** Start the in-process worker (no-op if Redis disabled or already started). */
export function startPayrollWorker() {
  if (!redisEnabled || worker) return null;
  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { runId, tenantId } = job.data;
      try {
        await payrollRepo.calculatePayrollRun(prisma, runId, tenantId);
      } catch (e) {
        // A duplicate/late job for an already-processed run is an idempotent no-op.
        if (e.code === 'INVALID_STATUS' || e.code === 'NOT_FOUND') {
          logger.info({ runId, code: e.code }, 'payroll calculate job skipped (idempotent)');
          return;
        }
        throw e;
      }
    },
    { connection: createQueueConnection(), concurrency: 2 },
  );
  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'payroll calculate completed'));
  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err: err?.message }, 'payroll calculate failed'));
  logger.info('payroll BullMQ worker started');
  return worker;
}

export async function closePayrollQueue() {
  if (worker) await worker.close();
  if (queue) await queue.close();
}
