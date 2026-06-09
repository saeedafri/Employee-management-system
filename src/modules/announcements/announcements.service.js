import * as repo from './announcements.repository.js';

/** Phase 3 UI reads `color` from category config — must always be present. */
export const ANNOUNCEMENT_CATEGORY_COLORS = {
  Company: '#3b82f6',
  People: '#ec4899',
  Product: '#8b5cf6',
  IT: '#f59e0b',
  Office: '#10b981',
};

function normalizeCategory(category) {
  return ANNOUNCEMENT_CATEGORY_COLORS[category] ? category : 'Company';
}

function categoryColor(category) {
  return ANNOUNCEMENT_CATEGORY_COLORS[normalizeCategory(category)];
}

function shapeAnnouncement(a) {
  const category = normalizeCategory(a.category);
  return {
    id: a.id,
    category,
    color: categoryColor(category),
    channelId: a.channelId,
    title: a.title,
    body: a.body,
    author: { name: a.authorName, role: a.authorRole || null },
    audience: a.audience,
    readCount: a.readCount,
    postedAt: a.postedAt.toISOString(),
    isPinned: a.isPinned,
  };
}

export async function getAnnouncements(tenantId, query) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const channelId = query.channelId || null;

  const [{ items, total }, pinned] = await Promise.all([
    repo.getAnnouncements(tenantId, { page, limit, channelId }),
    repo.getPinnedAnnouncement(tenantId),
  ]);

  const feed = items.filter(a => !a.isPinned).map(shapeAnnouncement);

  return {
    pinned: pinned ? shapeAnnouncement(pinned) : null,
    feed,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getChannels(tenantId) {
  const channels = await repo.getChannels(tenantId);
  return channels.map(ch => ({
    id: ch.id,
    name: ch.name,
    postCount: ch.postCount,
    category: ch.category,
    color: categoryColor(ch.category),
  }));
}

export async function getEvents(tenantId) {
  const events = await repo.getEvents(tenantId);
  return events.map(e => ({
    id: e.id,
    date: e.date,
    title: e.title,
    meta: e.meta,
    color: '#64748b',
  }));
}

export async function createEvent(tenantId, data) {
  const { date, title, meta } = data;
  if (!date || !title || !meta) {
    const err = new Error('date, title, meta are required');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 422;
    throw err;
  }
  const event = await repo.createEvent(tenantId, { date, title, meta });
  return { id: event.id, date: event.date, title: event.title, meta: event.meta };
}

export async function createAnnouncement(tenantId, userRole, data) {
  if (userRole === 'EMPLOYEE') {
    const err = new Error('Employees cannot post announcements');
    err.code = 'FORBIDDEN';
    err.statusCode = 403;
    throw err;
  }
  const { title, body, category, channelId, audience, isPinned, authorName, authorRole } = data;
  if (!title || !body || !category) {
    const err = new Error('title, body, category are required');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 422;
    throw err;
  }

  if (channelId) {
    const ch = await repo.getChannelById(tenantId, channelId);
    if (!ch) {
      const err = new Error('Channel not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }
  }

  if (isPinned) {
    await repo.unpinAll(tenantId);
  }

  const channels = await repo.getChannels(tenantId);
  const resolvedChannelId = channelId || (channels[0]?.id) || null;
  if (!resolvedChannelId) {
    const err = new Error('No channels available. Create a channel first.');
    err.code = 'NO_CHANNEL';
    err.statusCode = 422;
    throw err;
  }

  const ann = await repo.createAnnouncement(tenantId, {
    channelId: resolvedChannelId,
    category,
    title,
    body,
    authorName: authorName || 'System',
    authorRole: authorRole || null,
    audience: audience || 'All employees',
    isPinned: !!isPinned,
  });
  return shapeAnnouncement(ann);
}

export async function pinAnnouncement(tenantId, id) {
  const ann = await repo.getAnnouncementById(tenantId, id);
  if (!ann) {
    const err = new Error('Announcement not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  await repo.unpinAll(tenantId);
  const updated = await repo.updateAnnouncement(id, { isPinned: true });
  return shapeAnnouncement(updated);
}

export async function unpinAnnouncement(tenantId, id) {
  const ann = await repo.getAnnouncementById(tenantId, id);
  if (!ann) {
    const err = new Error('Announcement not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  if (!ann.isPinned) {
    const err = new Error('Announcement is not currently pinned');
    err.code = 'NOT_PINNED';
    err.statusCode = 409;
    throw err;
  }
  await repo.updateAnnouncement(id, { isPinned: false });
  return { unpinned: true };
}
