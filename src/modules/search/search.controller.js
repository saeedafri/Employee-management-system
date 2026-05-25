import { prisma } from '../../plugins/prisma.js';
import { successResponse } from '../../utils/response.js';

const ALL_TYPES = ['employee', 'department', 'leave', 'holiday'];

export async function searchAll(request, reply) {
  const tenantId = request.tenant.id;
  const { q, types, limit = 8 } = request.query;
  const { memberType, employeeId } = request.user;

  const requestedTypes = types ? types.split(',').map(t => t.trim()) : ALL_TYPES;
  const perType = Math.max(2, Math.ceil(limit / requestedTypes.length));
  const results = [];
  const groupedCounts = {};

  if (requestedTypes.includes('employee')) {
    const canSeeAll = ['SUPER_ADMIN', 'HR_ADMIN'].includes(memberType);
    const empWhere = {
      tenantId, deletedAt: null,
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { employeeCode: { contains: q, mode: 'insensitive' } },
        { designation: { contains: q, mode: 'insensitive' } },
      ],
    };
    if (!canSeeAll && employeeId) {
      empWhere.OR.push({ managerId: employeeId });
      empWhere.id = { in: [employeeId] }; // simplification — show self + reports
    }
    const [employees, empTotal] = await Promise.all([
      prisma.employee.findMany({ where: empWhere, select: { id: true, firstName: true, lastName: true, designation: true, department: { select: { name: true } } }, take: perType }),
      prisma.employee.count({ where: empWhere }),
    ]);
    employees.forEach(e => results.push({ type: 'employee', id: e.id, label: `${e.firstName} ${e.lastName}`, sublabel: `${e.designation || 'Employee'} · ${e.department?.name || ''}`, url: `/employees/${e.id}` }));
    groupedCounts.employee = empTotal;
  }

  if (requestedTypes.includes('department')) {
    const deptWhere = { tenantId, deletedAt: null, name: { contains: q, mode: 'insensitive' } };
    const [depts, deptTotal] = await Promise.all([
      prisma.department.findMany({ where: deptWhere, select: { id: true, name: true, _count: { select: { employees: { where: { deletedAt: null } } } } }, take: perType }),
      prisma.department.count({ where: deptWhere }),
    ]);
    depts.forEach(d => results.push({ type: 'department', id: d.id, label: d.name, sublabel: `${d._count.employees} employees`, url: `/departments?id=${d.id}` }));
    groupedCounts.department = deptTotal;
  }

  if (requestedTypes.includes('leave')) {
    const leaveWhere = { tenantId, reason: { contains: q, mode: 'insensitive' } };
    if (!['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'].includes(memberType) && employeeId) leaveWhere.employeeId = employeeId;
    const [leaves, leaveTotal] = await Promise.all([
      prisma.leaveRequest.findMany({ where: leaveWhere, select: { id: true, seqNo: true, status: true, leaveType: { select: { name: true } } }, take: perType }),
      prisma.leaveRequest.count({ where: leaveWhere }),
    ]);
    leaves.forEach(l => results.push({ type: 'leave', id: l.id, label: `${l.leaveType?.name || 'Leave'} Request #${l.seqNo || l.id.slice(-6)}`, sublabel: l.status, url: `/leave?id=${l.id}` }));
    groupedCounts.leave = leaveTotal;
  }

  if (requestedTypes.includes('holiday')) {
    const holWhere = { tenantId, name: { contains: q, mode: 'insensitive' } };
    const [hols, holTotal] = await Promise.all([
      prisma.holiday.findMany({ where: holWhere, select: { id: true, name: true, holidayDate: true }, take: perType }),
      prisma.holiday.count({ where: holWhere }),
    ]);
    hols.forEach(h => results.push({ type: 'holiday', id: h.id, label: h.name, sublabel: h.holidayDate?.toISOString().split('T')[0] || '', url: `/holidays?id=${h.id}` }));
    groupedCounts.holiday = holTotal;
  }

  return reply.send(successResponse({ results: results.slice(0, limit), groupedCounts }));
}
