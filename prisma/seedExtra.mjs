import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const tenant = await p.tenant.findUniqueOrThrow({ where: { tenantKey: 'acme-corp-001' } });
const { id: tenantId } = tenant;

const employees = await p.employee.findMany({ where: { tenantId, deletedAt: null } });
const leaveTypes = await p.leaveType.findMany({ where: { tenantId } });
const hrUser = await p.user.findFirst({ where: { tenantId, memberType: 'HR_ADMIN' } });
const managerUser = await p.user.findFirst({ where: { tenantId, memberType: 'MANAGER' } });

console.log(`${employees.length} employees | ${leaveTypes.length} leave types`);

const leaveStatuses = ['PENDING','APPROVED','DENIED','WITHDRAWN','CANCELLED'];
const attStatuses   = ['PRESENT','ABSENT','WFH','HALF_DAY','LEAVE'];
const modes         = ['OFFICE','WFH','HYBRID'];
const regStatuses   = ['PENDING','APPROVED','DENIED','WITHDRAWN'];
const regTypes      = ['LATE','MISSED_CHECKOUT','EARLY_CHECKOUT','OTHER'];

// 40 more leave requests
let lr = 0;
for (let i = 0; i < 40; i++) {
  const emp = employees[i % employees.length];
  const lt  = leaveTypes[i % leaveTypes.length];
  const daysAgo = (i * 5) + 20;
  const start = new Date(); start.setDate(start.getDate() - daysAgo); start.setHours(0,0,0,0);
  const end   = new Date(start); end.setDate(end.getDate() + (1 + i % 4));
  const status = leaveStatuses[i % leaveStatuses.length];
  await p.leaveRequest.create({ data: {
    tenantId, employeeId: emp.id, leaveTypeId: lt.id,
    startDate: start, endDate: end, totalDays: 1 + i % 4,
    reason: `Batch-${i+1}: ${lt.name}`,
    status,
    approverId:    ['APPROVED','DENIED'].includes(status) ? hrUser?.id : null,
    approverComment: status === 'DENIED' ? 'Insufficient balance' : status === 'APPROVED' ? 'Approved' : null,
    decidedAt:     ['APPROVED','DENIED'].includes(status) ? new Date() : null,
  }});
  lr++;
}
console.log(`Leave requests: +${lr}`);

// ~600 attendance records — 10 employees × 60 days
let ar = 0;
for (const emp of employees.slice(0, 10)) {
  for (let d = 1; d <= 60; d++) {
    const date = new Date(); date.setDate(date.getDate() - d); date.setHours(0,0,0,0);
    const exists = await p.attendanceRecord.findFirst({ where: { tenantId, employeeId: emp.id, attendanceDate: date } });
    if (exists) continue;
    const status  = attStatuses[d % attStatuses.length];
    const checkIn  = new Date(date); checkIn.setHours(9, d % 30, 0);
    const checkOut = new Date(date); checkOut.setHours(17 + d % 2, d % 45, 0);
    await p.attendanceRecord.create({ data: {
      tenantId, employeeId: emp.id, attendanceDate: date,
      checkInAt:  ['ABSENT','LEAVE'].includes(status) ? null : checkIn,
      checkOutAt: ['ABSENT','LEAVE','HALF_DAY'].includes(status) ? null : checkOut,
      workMode: modes[d % modes.length], status,
      totalMinutes: ['ABSENT','LEAVE'].includes(status) ? null : status === 'HALF_DAY' ? 240 : 480,
    }});
    ar++;
  }
}
console.log(`Attendance records: +${ar}`);

// 25 regularization requests
let reg = 0;
for (let i = 0; i < 25; i++) {
  const emp  = employees[i % employees.length];
  const date = new Date(); date.setDate(date.getDate() - (i * 2 + 3)); date.setHours(0,0,0,0);
  const status = regStatuses[i % regStatuses.length];
  await p.attendanceRegularizationRequest.create({ data: {
    tenantId, employeeId: emp.id, attendanceDate: date,
    reason: `Forgot to check ${i % 2 === 0 ? 'in' : 'out'} — day ${i+1}`,
    status, type: regTypes[i % regTypes.length],
    reviewerId: ['APPROVED','DENIED'].includes(status) ? managerUser?.id : null,
    reviewerComment: status === 'DENIED' ? 'Not valid' : null,
  }});
  reg++;
}
console.log(`Regularizations: +${reg}`);

await p.$disconnect();
console.log('\nExtra seed done.');
