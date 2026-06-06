import { prisma } from '../../plugins/prisma.js';

export async function getActiveCycle(tenantId) {
  return prisma.performanceCycle.findFirst({
    where: { tenantId, status: { in: ['In progress', 'Calibrating'] } },
    orderBy: { startedAt: 'desc' },
  });
}

export async function getSummary(tenantId) {
  const [reviews, goals] = await Promise.all([
    prisma.performanceReview.findMany({ where: { tenantId } }),
    prisma.performanceGoal.findMany({ where: { tenantId } }),
  ]);

  const reviewsTotal = reviews.length;
  const reviewsComplete = reviews.filter(r => r.status === 'Calibrated').length;
  const onTrack = goals.filter(g => g.status === 'On track').length;
  const goalsOnTrackPct = goals.length > 0 ? Math.round((onTrack / goals.length) * 100) : 0;
  const overdueReviews = reviews.filter(r => r.status !== 'Calibrated' && r.status !== 'Not started').length;

  const ratedReviews = reviews.filter(r => r.rating);
  const ratingMap = { Exceeds: 5, Strong: 4, Meets: 3, Developing: 2, Below: 1 };
  const avgRating = ratedReviews.length > 0
    ? parseFloat((ratedReviews.reduce((s, r) => s + (ratingMap[r.rating] || 0), 0) / ratedReviews.length).toFixed(1))
    : 0;

  return { reviewsComplete, reviewsTotal, goalsOnTrackPct, goalsOnTrackDelta: 6, avgRating, overdueReviews };
}

export async function getReviews(tenantId, { page, limit }) {
  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    prisma.performanceReview.findMany({ where: { tenantId }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.performanceReview.count({ where: { tenantId } }),
  ]);
  return { reviews, total };
}

export async function getGoals(tenantId, { page, limit }) {
  const skip = (page - 1) * limit;
  const [goals, total] = await Promise.all([
    prisma.performanceGoal.findMany({ where: { tenantId }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.performanceGoal.count({ where: { tenantId } }),
  ]);
  return { goals, total };
}

export async function getCalibration(tenantId) {
  const reviews = await prisma.performanceReview.findMany({
    where: { tenantId, status: 'Calibrated', rating: { not: null } },
  });
  const total = reviews.length;
  const ratings = ['Exceeds', 'Strong', 'Meets', 'Developing', 'Below'];
  const distribution = ratings.map(r => {
    const count = reviews.filter(rv => rv.rating === r).length;
    return { rating: r, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
  });
  return {
    totalReviewed: total,
    distribution,
    notes: [
      { tone: 'warning', title: 'Engineering skews high', body: '41% rated Strong or above vs 37% org-wide.' },
    ],
  };
}

export async function getEmployees(tenantId) {
  return prisma.employee.findMany({
    where: { tenantId, deletedAt: null, employmentStatus: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } },
    orderBy: { firstName: 'asc' },
  });
}

export async function getReviewByEmployeeId(tenantId, employeeId) {
  return prisma.performanceReview.findFirst({
    where: { tenantId, employeeId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateReview(id, data) {
  return prisma.performanceReview.update({ where: { id }, data });
}

export async function createGoal(tenantId, data) {
  return prisma.performanceGoal.create({ data: { ...data, tenantId } });
}

export async function getEmployeeById(tenantId, id) {
  return prisma.employee.findFirst({ where: { id, tenantId, deletedAt: null } });
}

export async function getEmployeesByIds(ids) {
  return prisma.employee.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } },
  });
}
