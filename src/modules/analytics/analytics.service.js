import { prisma } from '../../plugins/prisma.js';
import { getCachedOrFetch } from './analytics.cache.js';

export async function getDashboardSummary(tenantId) {
  return getCachedOrFetch(
    `analytics:dashboard-summary:${tenantId}`,
    async () => {
      const [
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        onLeaveToday,
        newHiresLast7Days,
        departmentBreakdown,
      ] = await Promise.all([
        prisma.employee.count({ where: { tenantId } }),
        prisma.employee.count({ where: { tenantId, employmentStatus: 'ACTIVE' } }),
        prisma.employee.count({ where: { tenantId, employmentStatus: 'INACTIVE' } }),
        prisma.leave.count({
          where: {
            tenantId,
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
            status: 'APPROVED',
          },
        }),
        prisma.employee.count({
          where: {
            tenantId,
            joinedOn: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.employee.groupBy({
          by: ['department'],
          where: { tenantId },
          _count: { id: true },
        }),
      ]);

      const deptMap = {};
      departmentBreakdown.forEach(d => {
        if (d.department) deptMap[d.department] = d._count.id;
      });

      return {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        onLeaveToday,
        departmentBreakdown: deptMap,
        newHiresLast7Days,
      };
    },
    3600 // 1 hour cache
  );
}

export async function getAttendanceAnalytics(tenantId, filters = {}) {
  const startDate = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = filters.endDate ? new Date(filters.endDate) : new Date();

  return getCachedOrFetch(
    `analytics:attendance:${tenantId}:${startDate.toISOString()}:${endDate.toISOString()}`,
    async () => {
      // Query attendance records
      // This would query audit logs or attendance table
      // Placeholder implementation
      return {
        period: { start: startDate, end: endDate },
        totalWorkDays: 22,
        averageAttendanceRate: 96.5,
        departmentRates: {},
        trends: [],
      };
    },
    7200 // 2 hours cache
  );
}

export async function getLeaveAnalytics(tenantId, filters = {}) {
  const year = filters.year || new Date().getFullYear();

  return getCachedOrFetch(
    `analytics:leave:${tenantId}:${year}`,
    async () => {
      const leaves = await prisma.leave.findMany({
        where: {
          tenantId,
          startDate: {
            gte: new Date(`${year}-01-01`),
            lte: new Date(`${year}-12-31`),
          },
        },
      });

      return {
        year,
        totalLeavesTaken: leaves.length,
        leaveByType: {
          CASUAL: leaves.filter(l => l.type === 'CASUAL').length,
          SICK: leaves.filter(l => l.type === 'SICK').length,
          ANNUAL: leaves.filter(l => l.type === 'ANNUAL').length,
        },
        pendingApprovals: leaves.filter(l => l.status === 'PENDING').length,
        usage: [],
      };
    },
    7200 // 2 hours cache
  );
}

export async function getPayrollAnalytics(tenantId, filters = {}) {
  const month = filters.month || new Date().getMonth() + 1;
  const year = filters.year || new Date().getFullYear();

  return getCachedOrFetch(
    `analytics:payroll:${tenantId}:${year}-${month}`,
    async () => {
      // Query payroll records
      // Placeholder implementation
      return {
        period: `${year}-${String(month).padStart(2, '0')}`,
        totalSalaryCost: 0,
        employeeCount: 0,
        averageSalary: 0,
        deductionBreakdown: {},
        status: 'PROCESSED',
      };
    },
    14400 // 4 hours cache
  );
}

export async function getDepartmentAnalytics(tenantId, departmentId) {
  return getCachedOrFetch(
    `analytics:department:${tenantId}:${departmentId}`,
    async () => {
      const employees = await prisma.employee.findMany({
        where: { tenantId, department: departmentId },
      });

      return {
        departmentId,
        totalMembers: employees.length,
        activeMembers: employees.filter(e => e.employmentStatus === 'ACTIVE').length,
        composition: {
          byRole: {}, // Would be populated from actual data
          byLevel: {}, // Would be populated from actual data
        },
        metrics: {
          averageTenure: 0,
          turnoverRate: 0,
          performanceScore: 0,
        },
        trends: [],
      };
    },
    7200 // 2 hours cache
  );
}
