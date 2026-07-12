// Shared approver/actor authorization for team-scoped actions (BE-SEC-2/3/4).
// A MANAGER may act only on their own direct reports; HR_ADMIN/SUPER_ADMIN may
// act on anyone; nobody may approve their OWN request. Reused by leave,
// timesheet, and attendance-regularization approvals so no path is left open.

function forbidden(code, message, statusCode = 403) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

const HR_ROLES = ['HR_ADMIN', 'SUPER_ADMIN'];

/**
 * Assert `actor` may APPROVE/REJECT a request belonging to `subjectEmployeeId`.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ employeeId?: string, memberType: string }} actor
 * @param {string} subjectEmployeeId
 */
export async function assertCanApprove(prisma, tenantId, actor, subjectEmployeeId) {
  if (HR_ROLES.includes(actor.memberType)) return;
  if (!actor.employeeId) {
    throw forbidden('NO_EMPLOYEE_RECORD', 'Approver has no employee record');
  }
  if (actor.employeeId === subjectEmployeeId) {
    throw forbidden('SELF_APPROVAL_FORBIDDEN', 'You cannot approve or reject your own request');
  }
  const subject = await prisma.employee.findFirst({
    where: { id: subjectEmployeeId, tenantId },
    select: { managerId: true },
  });
  if (!subject) throw forbidden('EMPLOYEE_NOT_FOUND', 'Subject employee not found', 404);
  if (subject.managerId !== actor.employeeId) {
    throw forbidden('NOT_TEAM_APPROVER', 'You can only decide requests for your direct reports');
  }
}

/**
 * Assert `actor` may READ employee-scoped data for `subjectEmployeeId`:
 * self, HR/SA, or the subject's direct manager. (Reads allow self, unlike approve.)
 */
export async function assertCanViewEmployee(prisma, tenantId, actor, subjectEmployeeId) {
  if (HR_ROLES.includes(actor.memberType)) return;
  if (actor.employeeId && actor.employeeId === subjectEmployeeId) return;
  if (actor.memberType === 'MANAGER' && actor.employeeId) {
    const subject = await prisma.employee.findFirst({
      where: { id: subjectEmployeeId, tenantId },
      select: { managerId: true },
    });
    if (subject && subject.managerId === actor.employeeId) return;
  }
  throw forbidden('FORBIDDEN', 'Cannot view data for this employee');
}
