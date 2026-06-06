import { prisma } from '../../plugins/prisma.js';

export async function getChannels(tenantId) {
  return prisma.announcementChannel.findMany({
    where: { tenantId },
    orderBy: { postCount: 'desc' },
  });
}

export async function getEvents(tenantId) {
  return prisma.announcementEvent.findMany({
    where: { tenantId },
    orderBy: { date: 'asc' },
  });
}

export async function createEvent(tenantId, data) {
  return prisma.announcementEvent.create({ data: { ...data, tenantId } });
}

export async function getAnnouncements(tenantId, { page, limit, channelId }) {
  const where = { tenantId, ...(channelId ? { channelId } : {}) };
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ isPinned: 'desc' }, { postedAt: 'desc' }],
    }),
    prisma.announcement.count({ where }),
  ]);
  return { items, total };
}

export async function getPinnedAnnouncement(tenantId) {
  return prisma.announcement.findFirst({
    where: { tenantId, isPinned: true },
    orderBy: { postedAt: 'desc' },
  });
}

export async function createAnnouncement(tenantId, data) {
  return prisma.announcement.create({ data: { ...data, tenantId } });
}

export async function getAnnouncementById(tenantId, id) {
  return prisma.announcement.findFirst({ where: { id, tenantId } });
}

export async function unpinAll(tenantId) {
  await prisma.announcement.updateMany({
    where: { tenantId, isPinned: true },
    data: { isPinned: false },
  });
}

export async function updateAnnouncement(id, data) {
  return prisma.announcement.update({ where: { id }, data });
}

export async function getChannelById(tenantId, id) {
  return prisma.announcementChannel.findFirst({ where: { id, tenantId } });
}
