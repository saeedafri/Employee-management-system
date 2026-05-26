// In-memory job store for holiday .ics import (TTL 15 min, no Redis needed)
const jobs = new Map();
const TTL_MS = 15 * 60 * 1000;

export function createJob(jobId, data) {
  jobs.set(jobId, { ...data, createdAt: Date.now(), committed: false });
  setTimeout(() => jobs.delete(jobId), TTL_MS);
}

export function getJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  if (Date.now() - job.createdAt > TTL_MS) { jobs.delete(jobId); return null; }
  return job;
}

export function markCommitted(jobId) {
  const job = jobs.get(jobId);
  if (job) job.committed = true;
}

export function deleteJob(jobId) {
  jobs.delete(jobId);
}
