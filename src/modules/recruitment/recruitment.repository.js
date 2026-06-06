import { prisma } from '../../plugins/prisma.js';

export async function getSummary(tenantId) {
  const [openRequisitions, activeCandidates, closingOpenings, interviews] = await Promise.all([
    prisma.jobOpening.count({ where: { tenantId, status: 'Open' } }),
    prisma.candidate.count({ where: { tenantId, stage: { not: 'hired' } } }),
    prisma.jobOpening.count({ where: { tenantId, status: 'Closing' } }),
    prisma.candidate.count({ where: { tenantId, stage: 'interview' } }),
  ]);

  return {
    openRequisitions,
    activeCandidates,
    interviewsThisWeek: interviews,
    avgDaysToHire: 28,
    closingThisWeek: closingOpenings,
    interviewsToday: Math.floor(interviews / 3) || 1,
  };
}

export async function getOpenings(tenantId, { page, limit, status }) {
  const where = { tenantId, ...(status ? { status } : {}) };
  const skip = (page - 1) * limit;
  const [openings, total] = await Promise.all([
    prisma.jobOpening.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.jobOpening.count({ where }),
  ]);
  return { openings, total };
}

export async function createOpening(tenantId, data) {
  return prisma.jobOpening.create({ data: { ...data, tenantId } });
}

export async function updateOpening(tenantId, id, data) {
  const existing = await prisma.jobOpening.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.jobOpening.update({ where: { id }, data });
}

export async function getCandidates(tenantId, { page, limit, openingId, stage }) {
  const where = {
    tenantId,
    ...(openingId ? { openingId } : {}),
    ...(stage ? { stage } : {}),
  };
  const skip = (page - 1) * limit;
  const [candidates, total] = await Promise.all([
    prisma.candidate.findMany({ where, skip, take: limit, orderBy: { appliedAt: 'desc' } }),
    prisma.candidate.count({ where }),
  ]);
  return { candidates, total };
}

export async function getCandidateById(tenantId, id) {
  return prisma.candidate.findFirst({ where: { id, tenantId } });
}

export async function advanceCandidate(id, nextStage) {
  return prisma.candidate.update({
    where: { id },
    data: { stage: nextStage, daysInStage: 0 },
  });
}

export async function updateCandidateRating(id, rating) {
  return prisma.candidate.update({ where: { id }, data: { rating } });
}

export async function getRecruiters(tenantId) {
  const hrUsers = await prisma.user.findMany({
    where: { tenantId, memberType: { in: ['HR_ADMIN', 'SUPER_ADMIN'] }, deletedAt: null },
    include: { employee: true },
    take: 20,
  });
  return hrUsers
    .filter(u => u.employee)
    .map(u => ({
      id: u.id,
      name: `${u.employee.firstName} ${u.employee.lastName}`,
      email: u.email,
    }));
}
