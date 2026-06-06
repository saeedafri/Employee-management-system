import { prisma } from '../../plugins/prisma.js';
import * as repo from './performance.repository.js';

export async function getActiveCycle(tenantId) {
  const cycle = await repo.getActiveCycle(tenantId);
  if (!cycle) return null;
  return {
    id: cycle.id,
    name: cycle.name,
    selfReviewDue: cycle.selfReviewDue.toISOString().slice(0, 10),
    managerReviewDue: cycle.managerReviewDue.toISOString().slice(0, 10),
    calibrationDate: cycle.calibrationDate.toISOString().slice(0, 10),
    progressPct: cycle.progressPct,
    status: cycle.status,
    startedAt: cycle.startedAt.toISOString(),
  };
}

export async function getSummary(tenantId) {
  return repo.getSummary(tenantId);
}

export async function getReviews(tenantId, query) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 50;

  const { reviews, total } = await repo.getReviews(tenantId, { page, limit, status: query.status });

  const employeeIds = [...new Set(reviews.map(r => r.employeeId))];
  const reviewerIds = [...new Set(reviews.map(r => r.reviewerId).filter(Boolean))];

  const [employees, reviewers] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } },
    }),
    reviewerIds.length > 0
      ? prisma.employee.findMany({
        where: { id: { in: reviewerIds } },
        select: { id: true, firstName: true, lastName: true },
      })
      : Promise.resolve([]),
  ]);

  const empMap = Object.fromEntries(employees.map(e => [e.id, e]));
  const revMap = Object.fromEntries(reviewers.map(e => [e.id, e]));

  const shaped = reviews.map(r => {
    const emp = empMap[r.employeeId];
    const reviewer = r.reviewerId ? revMap[r.reviewerId] : null;
    return {
      employeeId: r.employeeId,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
      department: emp?.department?.name || 'Unknown',
      reviewerName: reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : null,
      status: r.status,
      rating: r.rating,
      selfComplete: r.selfComplete,
      managerComplete: r.managerComplete,
    };
  });

  return { reviews: shaped, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getGoals(tenantId, query) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 50;

  const { goals, total } = await repo.getGoals(tenantId, { page, limit, status: query.status });

  const employeeIds = [...new Set(goals.map(g => g.employeeId))];
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const empMap = Object.fromEntries(employees.map(e => [e.id, e]));

  const shaped = goals.map(g => {
    const emp = empMap[g.employeeId];
    return {
      id: g.id,
      employeeId: g.employeeId,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
      title: g.title,
      progressPct: g.progressPct,
      dueDate: g.dueDate.toISOString().slice(0, 10),
      status: g.status,
    };
  });

  return { goals: shaped, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getCalibration(tenantId) {
  return repo.getCalibration(tenantId);
}

export async function getEmployees(tenantId) {
  const employees = await repo.getEmployees(tenantId);
  return employees.map(e => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
    department: e.department?.name || 'Unknown',
  }));
}

const VALID_RATINGS = ['Exceeds', 'Strong', 'Meets', 'Developing', 'Below'];

export async function updateReview(tenantId, employeeId, data) {
  if (data.rating && !VALID_RATINGS.includes(data.rating)) {
    const err = new Error(`rating must be one of: ${VALID_RATINGS.join(', ')}`);
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 422;
    throw err;
  }

  const review = await repo.getReviewByEmployeeId(tenantId, employeeId);
  if (!review) {
    const err = new Error('Performance review not found for this employee');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  if (review.status === 'Calibrated') {
    const err = new Error('Review is already calibrated');
    err.code = 'ALREADY_CALIBRATED';
    err.statusCode = 409;
    throw err;
  }

  const updated = await repo.updateReview(review.id, {
    ...data,
    status: 'Calibrated',
    managerComplete: true,
  });

  const [employees, reviewers] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: [updated.employeeId] } },
      select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } },
    }),
    updated.reviewerId
      ? prisma.employee.findMany({
          where: { id: { in: [updated.reviewerId] } },
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
  ]);

  const emp = employees[0];
  const reviewer = reviewers[0] || null;
  return {
    employeeId: updated.employeeId,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
    department: emp?.department?.name || 'Unknown',
    reviewerName: reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : null,
    status: updated.status,
    rating: updated.rating,
    selfComplete: updated.selfComplete,
    managerComplete: updated.managerComplete,
  };
}

export async function createGoal(tenantId, data) {
  const { employeeId, title, dueDate, progressPct } = data;
  if (!employeeId || !title || !dueDate) {
    const err = new Error('employeeId, title, dueDate are required');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 422;
    throw err;
  }
  const emp = await repo.getEmployeeById(tenantId, employeeId);
  if (!emp) {
    const err = new Error('Employee not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  return repo.createGoal(tenantId, {
    employeeId,
    title,
    dueDate: new Date(dueDate),
    progressPct: progressPct || 0,
  });
}
