import { Worker } from 'bullmq';
import { createWriteStream, mkdirSync } from 'fs';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config/index.js';
import { exportQueue, redisConnection } from './exportQueue.js';
import { logger } from '../utils/logger.js';
import * as exportRepository from '../modules/export/export.repository.js';

const EXPORTS_DIR = config.exportsDir || '/tmp/exports';
mkdirSync(EXPORTS_DIR, { recursive: true });

async function processEmployeeExport(job) {
  const { jobId, tenantId, filters } = job.data;

  try {
    job.updateProgress(10);

    const employees = await exportRepository.getEmployeesForExport(tenantId, {
      departmentId: filters.department_id,
      status: filters.status,
      include_archived: filters.include_archived,
    });

    job.updateProgress(30);

    const filename = await generateExportFile(
      employees,
      'employees',
      filters.format,
      jobId,
    );

    job.updateProgress(90);

    const fileUrl = `${config.apiUrl}/files/${jobId}`;

    await exportRepository.updateExportJobStatus(jobId, 'SUCCESS', fileUrl);

    logger.info({
      type: 'export_completed',
      jobId,
      exportType: 'EMPLOYEES',
      recordCount: employees.length,
      filename,
    });

    return { success: true, filename, recordCount: employees.length };
  } catch (error) {
    logger.error({
      type: 'export_failed',
      jobId,
      exportType: 'EMPLOYEES',
      error: error.message,
    });

    await exportRepository.updateExportJobStatus(
      jobId,
      'FAILED',
      null,
      error.message,
    );

    throw error;
  }
}

async function processAttendanceExport(job) {
  const { jobId, tenantId, filters } = job.data;

  try {
    job.updateProgress(10);

    const records = await exportRepository.getAttendanceForExport(tenantId, {
      departmentId: filters.department_id,
      fromDate: filters.from_date,
      toDate: filters.to_date,
    });

    job.updateProgress(30);

    const filename = await generateExportFile(
      records,
      'attendance',
      filters.format,
      jobId,
    );

    job.updateProgress(90);

    const fileUrl = `${config.apiUrl}/files/${jobId}`;

    await exportRepository.updateExportJobStatus(jobId, 'SUCCESS', fileUrl);

    logger.info({
      type: 'export_completed',
      jobId,
      exportType: 'ATTENDANCE',
      recordCount: records.length,
      filename,
    });

    return { success: true, filename, recordCount: records.length };
  } catch (error) {
    logger.error({
      type: 'export_failed',
      jobId,
      exportType: 'ATTENDANCE',
      error: error.message,
    });

    await exportRepository.updateExportJobStatus(
      jobId,
      'FAILED',
      null,
      error.message,
    );

    throw error;
  }
}

async function processLeaveExport(job) {
  const { jobId, tenantId, filters } = job.data;

  try {
    job.updateProgress(10);

    const leaves = await exportRepository.getLeaveForExport(tenantId, {
      fromDate: filters.from_date,
      toDate: filters.to_date,
      leaveType: filters.leave_type,
      status: filters.status,
    });

    job.updateProgress(30);

    const filename = await generateExportFile(
      leaves,
      'leave',
      filters.format,
      jobId,
    );

    job.updateProgress(90);

    const fileUrl = `${config.apiUrl}/files/${jobId}`;

    await exportRepository.updateExportJobStatus(jobId, 'SUCCESS', fileUrl);

    logger.info({
      type: 'export_completed',
      jobId,
      exportType: 'LEAVE',
      recordCount: leaves.length,
      filename,
    });

    return { success: true, filename, recordCount: leaves.length };
  } catch (error) {
    logger.error({
      type: 'export_failed',
      jobId,
      exportType: 'LEAVE',
      error: error.message,
    });

    await exportRepository.updateExportJobStatus(
      jobId,
      'FAILED',
      null,
      error.message,
    );

    throw error;
  }
}

async function generateExportFile(data, type, format, jobId) {
  const ext = format === 'excel' ? 'xlsx' : format;
  const filename = `${jobId}.${ext}`;
  const filepath = join(EXPORTS_DIR, filename);

  if (format === 'csv') {
    return generateCSV(data, filepath, filename);
  } else if (format === 'excel') {
    return generateExcel(data, filepath, filename);
  } else if (format === 'json') {
    return generateJSON(data, filepath, filename);
  }

  throw new Error(`Unsupported format: ${format}`);
}

async function generateCSV(data, filepath, filename) {
  const flatData = data.map((item) => flattenObject(item));

  if (flatData.length === 0) {
    writeFileSync(filepath, '');
    return filename;
  }

  const headers = Object.keys(flatData[0]);
  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...flatData.map((row) =>
      headers.map((h) => escapeCSV(String(row[h] || ''))).join(','),
    ),
  ].join('\n');

  writeFileSync(filepath, csvContent);
  return filename;
}

async function generateExcel(data, filepath, filename) {
  const flatData = data.map((item) => flattenObject(item));

  if (flatData.length === 0) {
    writeFileSync(filepath, '');
    return filename;
  }

  const headers = Object.keys(flatData[0]);
  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...flatData.map((row) =>
      headers.map((h) => escapeCSV(String(row[h] || ''))).join(','),
    ),
  ].join('\n');

  writeFileSync(filepath, csvContent);
  return filename;
}

async function generateJSON(data, filepath, filename) {
  const json = JSON.stringify(data, null, 2);
  writeFileSync(filepath, json);
  return filename;
}

function escapeCSV(value) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function flattenObject(obj, prefix = '') {
  const result = {};

  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) {
      result[newKey] = '';
    } else if (typeof value === 'object' && !(value instanceof Date)) {
      Object.assign(result, flattenObject(value, newKey));
    } else if (value instanceof Date) {
      result[newKey] = value.toISOString();
    } else {
      result[newKey] = value;
    }
  });

  return result;
}

let exportWorker;

if (config.isTesting) {
  exportWorker = null;
} else {
  exportWorker = new Worker('export', async (job) => {
    if (job.name === 'export_employees') {
      return processEmployeeExport(job);
    } else if (job.name === 'export_attendance') {
      return processAttendanceExport(job);
    } else if (job.name === 'export_leave') {
      return processLeaveExport(job);
    }
  }, {
    connection: redisConnection,
    concurrency: 3,
  });

  exportWorker.on('completed', (job) => {
    logger.info({
      type: 'export_job_completed',
      jobId: job.id,
      jobName: job.name,
    });
  });

  exportWorker.on('failed', (job, err) => {
    logger.error({
      type: 'export_job_failed',
      jobId: job.id,
      jobName: job.name,
      error: err.message,
    });
  });

  exportWorker.on('error', (err) => {
    logger.error({
      type: 'export_worker_error',
      error: err.message,
    });
  });
}

export default exportWorker;
