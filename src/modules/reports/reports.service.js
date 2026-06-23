import * as reportsRepository from './reports.repository.js';

class AppError extends Error {
  constructor(message, code, statusCode = 400, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function getAttendanceReport(tenantId, filters) {
  // Bound an unfiltered request to the current month so it can't scan the whole
  // attendance table (which OOM-killed the container on large tenants). The FE
  // always sends a range; this only guards the no-filter case.
  let fromDate = filters.from_date;
  let toDate = filters.to_date;
  if (!fromDate && !toDate) {
    const now = new Date();
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  const records = await reportsRepository.getAttendanceRecords(tenantId, {
    fromDate,
    toDate,
    departmentId: filters.department_id,
  });

  const holidays = await reportsRepository.getHolidays(tenantId, {
    fromDate,
    toDate,
  });

  const summary = {
    present: 0,
    absent: 0,
    late: 0,
    on_time: 0,
    leave: 0,
    wfh: 0,
    half_day: 0,
    holiday: 0,
  };

  const byDepartment = {};

  records.forEach((record) => {
    const status = record.status.toLowerCase();
    summary[status] = (summary[status] || 0) + 1;

    const deptId = record.employee.departmentId || 'Unassigned';
    const deptName = record.employee.department?.name || 'Unassigned';

    if (!byDepartment[deptId]) {
      byDepartment[deptId] = {
        department_id: deptId,
        department_name: deptName,
        present: 0,
        absent: 0,
        late: 0,
        on_time: 0,
        leave: 0,
        wfh: 0,
        half_day: 0,
        holiday: 0,
      };
    }
    byDepartment[deptId][status] = (byDepartment[deptId][status] || 0) + 1;
  });

  return {
    period: {
      from_date: fromDate,
      to_date: toDate,
    },
    summary,
    by_department: Object.values(byDepartment),
    total_records: records.length,
    total_holidays: holidays.length,
  };
}

export async function getLeavesReport(tenantId, filters) {
  const leaves = await reportsRepository.getLeaveRequests(tenantId, {
    fromDate: filters.from_date,
    toDate: filters.to_date,
    leaveType: filters.leave_type,
    departmentId: filters.department_id,
  });

  const byStatus = {
    approved: 0,
    rejected: 0,
    pending: 0,
    withdrawn: 0,
    cancelled: 0,
  };

  const byType = {};
  const byDepartment = {};

  leaves.forEach((leave) => {
    const status = leave.status.toLowerCase();
    byStatus[status] = (byStatus[status] || 0) + 1;

    const typeKey = leave.leaveType.code.toLowerCase();
    byType[typeKey] = (byType[typeKey] || 0) + 1;

    const deptId = leave.employee.departmentId || 'Unassigned';
    const deptName = leave.employee.department?.name || 'Unassigned';

    if (!byDepartment[deptId]) {
      byDepartment[deptId] = {
        department_id: deptId,
        department_name: deptName,
        approved: 0,
        rejected: 0,
        pending: 0,
      };
    }
    byDepartment[deptId][status] = (byDepartment[deptId][status] || 0) + 1;
  });

  return {
    period: {
      from_date: filters.from_date,
      to_date: filters.to_date,
    },
    by_status: byStatus,
    by_type: byType,
    by_department: Object.values(byDepartment),
    total_requests: leaves.length,
  };
}

export async function getPayrollReport(tenantId, filters) {
  const month = filters.month;
  const year = filters.year;
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const records = await reportsRepository.getAttendanceRecords(tenantId, {
    fromDate: startDate,
    toDate: endDate,
    departmentId: filters.department_id,
  });

  const byDepartment = {};
  let totalEmployees = 0;
  const uniqueEmployees = new Set();

  records.forEach((record) => {
    const deptId = record.employee.departmentId || 'Unassigned';
    const deptName = record.employee.department?.name || 'Unassigned';
    const empId = record.employee.id;

    uniqueEmployees.add(empId);

    if (!byDepartment[deptId]) {
      byDepartment[deptId] = {
        department_id: deptId,
        department_name: deptName,
        employee_count: 0,
        total_payroll: 0,
      };
    }
    if (!byDepartment[deptId].employee_ids) {
      byDepartment[deptId].employee_ids = new Set();
    }
    byDepartment[deptId].employee_ids.add(empId);
  });

  Object.values(byDepartment).forEach((dept) => {
    dept.employee_count = dept.employee_ids.size;
    dept.total_payroll = dept.employee_count * 50000;
    delete dept.employee_ids;
  });

  totalEmployees = uniqueEmployees.size;

  return {
    month,
    year,
    total_employees: totalEmployees,
    total_payroll: totalEmployees * 50000,
    by_department: Object.values(byDepartment),
  };
}

export async function createScheduledReport(tenantId, userId, data) {
  const report = await reportsRepository.createScheduledReport(tenantId, userId, data);

  return {
    id: report.id,
    report_type: report.reportType,
    frequency: report.frequency,
    next_run_date: report.nextRunDate,
    is_active: report.isActive,
  };
}

export async function getScheduledReports(tenantId, page, limit) {
  const { reports, total } = await reportsRepository.getScheduledReports(tenantId, page, limit);

  return {
    reports: reports.map((r) => ({
      id: r.id,
      report_type: r.reportType,
      frequency: r.frequency,
      email_recipients: r.emailRecipients,
      next_run_date: r.nextRunDate,
      is_active: r.isActive,
      last_run_at: r.lastRunAt,
      created_at: r.createdAt,
    })),
    total,
  };
}

export async function updateScheduledReport(id, tenantId, data) {
  try {
    const report = await reportsRepository.updateScheduledReport(id, tenantId, data);

    return {
      id: report.id,
      frequency: report.frequency,
      is_active: report.isActive,
    };
  } catch (error) {
    if (error.code === 'P2025') {
      throw new AppError('Scheduled report not found', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

export async function deleteScheduledReport(id, tenantId) {
  try {
    const report = await reportsRepository.deleteScheduledReport(id, tenantId);

    return {
      id: report.id,
      status: 'archived',
    };
  } catch (error) {
    if (error.code === 'P2025') {
      throw new AppError('Scheduled report not found', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

export async function getExportHistory(tenantId, page, limit, status) {
  const { exports, total } = await reportsRepository.getReportExports(tenantId, page, limit, status);

  return {
    exports: exports.map((exp) => ({
      id: exp.id,
      report_type: exp.reportType,
      format: exp.format,
      status: exp.status,
      file_url: exp.fileUrl,
      error_message: exp.errorMessage,
      created_at: exp.createdAt,
      completed_at: exp.completedAt,
    })),
    total,
    page,
  };
}

// ── Domain 4 service wrappers ─────────────────────────────────────────────────

function reportMeta(reportName, filters) {
  return { reportName, generatedAt: new Date().toISOString(), filters };
}

export async function getWorkforceHeadcount(tenantId, filters) {
  const data = await reportsRepository.getWorkforceHeadcount(tenantId, filters);
  return { meta: reportMeta('Headcount Report', filters), ...data };
}

export async function getWorkforceTurnover(tenantId, filters) {
  const data = await reportsRepository.getWorkforceTurnover(tenantId, filters);
  return { meta: reportMeta('Workforce Turnover Report', filters), ...data };
}

export async function getWorkforceDemographics(tenantId, filters) {
  const data = await reportsRepository.getWorkforceDemographics(tenantId, filters);
  return { meta: reportMeta('Workforce Demographics Report', filters), ...data };
}

export async function getAttendanceSummaryReport(tenantId, filters) {
  const data = await reportsRepository.getAttendanceSummaryReport(tenantId, filters);
  return { meta: reportMeta('Attendance Summary Report', filters), ...data };
}

export async function getAttendanceAbsenteeism(tenantId, filters) {
  const data = await reportsRepository.getAttendanceAbsenteeism(tenantId, filters);
  return { meta: reportMeta('Absenteeism Report', filters), ...data };
}

export async function getLeaveUtilization(tenantId, filters) {
  const data = await reportsRepository.getLeaveUtilization(tenantId, filters);
  return { meta: reportMeta('Leave Utilization Report', filters), ...data };
}

export async function getLeavePending(tenantId, filters) {
  const data = await reportsRepository.getLeavePending(tenantId, filters);
  return { meta: reportMeta('Pending Leave Report', filters), ...data };
}

export async function getPayrollSummaryReport(tenantId, filters) {
  const data = await reportsRepository.getPayrollSummaryReport(tenantId, filters);
  return { meta: reportMeta('Payroll Summary Report', filters), ...data };
}

export async function getPayrollCtcAnalysis(tenantId, filters) {
  const data = await reportsRepository.getPayrollCtcAnalysis(tenantId, filters);
  return { meta: reportMeta('CTC Analysis Report', filters), ...data };
}

const VALID_EXPORT_TYPES = [
  'workforce/headcount', 'workforce/turnover', 'workforce/demographics',
  'attendance/summary', 'attendance/absenteeism',
  'leave/utilization', 'leave/pending',
  'payroll/summary', 'payroll/ctc-analysis',
];

export async function exportReport(tenantId, userId, { reportType, format, filters = {} }) {
  if (!VALID_EXPORT_TYPES.includes(reportType)) {
    throw new AppError('Invalid reportType', 'INVALID_REPORT_TYPE', 400);
  }
  if (format !== 'CSV') {
    throw new AppError('Only CSV format is supported', 'UNSUPPORTED_FORMAT', 400);
  }

  const exportRecord = await reportsRepository.createReportExport(tenantId, userId, reportType, format);

  // Generate CSV synchronously — no queue
  setImmediate(() => _processExportJob(exportRecord.id, tenantId, reportType, filters));

  return { jobId: exportRecord.id, status: 'PENDING', message: 'Export processing. Poll GET /reports/export/:jobId/status or download at GET /reports/export/:jobId/download when ready.' };
}

async function _processExportJob(jobId, tenantId, reportType, filters) {
  try {
    let data;
    switch (reportType) {
    case 'workforce/headcount':    data = await reportsRepository.getWorkforceHeadcount(tenantId, filters); break;
    case 'workforce/turnover':     data = await reportsRepository.getWorkforceTurnover(tenantId, filters); break;
    case 'workforce/demographics': data = await reportsRepository.getWorkforceDemographics(tenantId, filters); break;
    case 'attendance/summary':     data = await reportsRepository.getAttendanceSummaryReport(tenantId, filters); break;
    case 'attendance/absenteeism': data = await reportsRepository.getAttendanceAbsenteeism(tenantId, filters); break;
    case 'leave/utilization':      data = await reportsRepository.getLeaveUtilization(tenantId, filters); break;
    case 'leave/pending':          data = await reportsRepository.getLeavePending(tenantId, filters); break;
    case 'payroll/summary':        data = await reportsRepository.getPayrollSummaryReport(tenantId, filters); break;
    case 'payroll/ctc-analysis':   data = await reportsRepository.getPayrollCtcAnalysis(tenantId, filters); break;
    default: throw new Error(`Unknown reportType: ${reportType}`);
    }
    const rows = data?.tableData?.items || data?.chartData || (Array.isArray(data) ? data : [data]);
    const csv = _toCsv(rows);
    await reportsRepository.completeReportExport(jobId, 'SUCCESS', csv);
  } catch (err) {
    await reportsRepository.completeReportExport(jobId, 'FAILED', null, err.message).catch(() => {});
  }
}

function _toCsv(rows) {
  if (!rows || rows.length === 0) return 'no_data\n(empty result set)\n';
  const keys = Object.keys(rows[0]);
  const header = keys.map(k => `"${k}"`).join(',');
  const lines = rows.map(row =>
    keys.map(k => {
      const v = row[k];
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    }).join(','),
  );
  return [header, ...lines].join('\n') + '\n';
}

export async function getExportJobStatus(tenantId, jobId) {
  const job = await reportsRepository.getReportExportById(tenantId, jobId);
  if (!job) throw new AppError('Export job not found', 'NOT_FOUND', 404);
  return {
    jobId: job.id,
    status: job.status,
    reportType: job.reportType,
    format: job.format,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    errorMessage: job.errorMessage || null,
  };
}

export async function downloadExportJob(tenantId, jobId) {
  const job = await reportsRepository.getReportExportById(tenantId, jobId);
  if (!job) throw new AppError('Export job not found', 'NOT_FOUND', 404);
  if (job.status === 'PENDING') throw new AppError('Export is still processing', 'EXPORT_PENDING', 202);
  if (job.status === 'FAILED') throw new AppError(job.errorMessage || 'Export failed', 'EXPORT_FAILED', 500);
  if (!job.csvContent) throw new AppError('Export file not available', 'NO_CONTENT', 404);
  return { csv: job.csvContent, reportType: job.reportType };
}
