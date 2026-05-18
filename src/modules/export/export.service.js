import { v4 as uuidv4 } from 'uuid';
import { exportQueue } from '../../jobs/exportQueue.js';
import * as exportRepository from './export.repository.js';
import { logger } from '../../utils/logger.js';

class AppError extends Error {
  constructor(message, code, statusCode = 400, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

const EXPORT_TIMEOUT_MINUTES = 30;

export async function queueEmployeeExport(tenantId, userId, filters) {
  const jobId = uuidv4();
  const estimatedTime = calculateEstimatedTime('employees', filters);

  await exportRepository.createExportJob(tenantId, userId, {
    jobId,
    exportType: 'EMPLOYEES',
    format: filters.format,
    filters,
  });

  await exportQueue.add('export_employees', {
    jobId,
    tenantId,
    userId,
    filters,
  }, {
    removeOnComplete: false,
    removeOnFail: false,
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    jobId,
  });

  logger.info({
    type: 'export_queued',
    jobId,
    exportType: 'EMPLOYEES',
    tenantId,
  });

  return {
    job_id: jobId,
    status: 'QUEUED',
    estimated_completion_time: estimatedTime,
  };
}

export async function queueAttendanceExport(tenantId, userId, filters) {
  const jobId = uuidv4();
  const estimatedTime = calculateEstimatedTime('attendance', filters);

  await exportRepository.createExportJob(tenantId, userId, {
    jobId,
    exportType: 'ATTENDANCE',
    format: filters.format,
    filters,
  });

  await exportQueue.add('export_attendance', {
    jobId,
    tenantId,
    userId,
    filters,
  }, {
    removeOnComplete: false,
    removeOnFail: false,
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    jobId,
  });

  logger.info({
    type: 'export_queued',
    jobId,
    exportType: 'ATTENDANCE',
    tenantId,
  });

  return {
    job_id: jobId,
    status: 'QUEUED',
    estimated_completion_time: estimatedTime,
  };
}

export async function queueLeaveExport(tenantId, userId, filters) {
  const jobId = uuidv4();
  const estimatedTime = calculateEstimatedTime('leave', filters);

  await exportRepository.createExportJob(tenantId, userId, {
    jobId,
    exportType: 'LEAVE',
    format: filters.format,
    filters,
  });

  await exportQueue.add('export_leave', {
    jobId,
    tenantId,
    userId,
    filters,
  }, {
    removeOnComplete: false,
    removeOnFail: false,
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    jobId,
  });

  logger.info({
    type: 'export_queued',
    jobId,
    exportType: 'LEAVE',
    tenantId,
  });

  return {
    job_id: jobId,
    status: 'QUEUED',
    estimated_completion_time: estimatedTime,
  };
}

export async function getExportStatus(jobId, tenantId) {
  const exportJob = await exportRepository.getExportJobStatus(jobId, tenantId);

  if (!exportJob) {
    throw new AppError('Export job not found', 'NOT_FOUND', 404);
  }

  const response = {
    job_id: exportJob.jobId,
    status: exportJob.status,
    export_type: exportJob.exportType,
    format: exportJob.format,
    created_at: exportJob.createdAt,
  };

  if (exportJob.status === 'SUCCESS') {
    response.file_url = exportJob.fileUrl;
    response.completed_at = exportJob.completedAt;
  } else if (exportJob.status === 'FAILED') {
    response.error_message = exportJob.errorMessage;
    response.completed_at = exportJob.completedAt;
  } else if (exportJob.status === 'PROCESSING') {
    const job = await exportQueue.getJob(jobId);
    if (job) {
      const progress = job.progress();
      response.progress_percentage = progress || 0;
    }
  }

  return response;
}

export async function listExports(tenantId, page, limit, status) {
  const { jobs, total } = await exportRepository.listExportJobs(tenantId, page, limit, status);

  return {
    exports: jobs.map((job) => ({
      job_id: job.jobId,
      export_type: job.exportType,
      format: job.format,
      status: job.status,
      file_url: job.fileUrl,
      error_message: job.errorMessage,
      created_at: job.createdAt,
      completed_at: job.completedAt,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function scheduleExportCleanup() {
  try {
    const { prisma } = await import('../../plugins/prisma.js');
    setInterval(async () => {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);

        const result = await prisma.exportJob.deleteMany({
          where: {
            status: { in: ['SUCCESS', 'FAILED'] },
            completedAt: { lt: cutoffDate },
          },
        });

        logger.info({
          type: 'export_cleanup',
          deletedCount: result.count,
        });
      } catch (error) {
        logger.error({
          type: 'export_cleanup_failed',
          error: error.message,
        });
      }
    }, 24 * 60 * 60 * 1000);
  } catch (error) {
    logger.error({
      type: 'export_cleanup_init_failed',
      error: error.message,
    });
  }
}

function calculateEstimatedTime(exportType, filters) {
  let minutes = 1;

  if (exportType === 'employees') {
    minutes = 2;
  } else if (exportType === 'attendance') {
    minutes = 3;
  } else if (exportType === 'leave') {
    minutes = 2;
  }

  return minutes;
}
