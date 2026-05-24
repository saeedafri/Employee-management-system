import { prisma } from '../../plugins/prisma.js';

export async function listHolidays(tenantId, year, country = null) {
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31`);

  return prisma.holiday.findMany({
    where: {
      tenantId,
      holidayDate: {
        gte: startDate,
        lte: endDate,
      },
      ...(country && { location: country }),
    },
    orderBy: { holidayDate: 'asc' },
  });
}

export async function getHolidayById(id, tenantId) {
  return prisma.holiday.findFirst({
    where: { id, tenantId },
  });
}

export async function createHoliday(tenantId, data) {
  return prisma.holiday.create({
    data: {
      tenantId,
      name: data.name,
      holidayDate: data.holidayDate,
      location: data.location,
      isOptional: data.isOptional,
    },
  });
}

export async function updateHoliday(id, tenantId, data) {
  const updateData = {};
  if (data.holidayDate !== undefined) updateData.holidayDate = new Date(data.holidayDate);
  if (data.name !== undefined) updateData.name = data.name;
  if (data.isOptional !== undefined) updateData.isOptional = data.isOptional;
  updateData.updatedAt = new Date();

  return prisma.holiday.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteHoliday(id, _tenantId) {
  return prisma.holiday.delete({
    where: { id },
  });
}

export async function getUpcomingHolidays(tenantId, limit = 3) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.holiday.findMany({
    where: { tenantId, holidayDate: { gte: today } },
    orderBy: { holidayDate: 'asc' },
    take: limit,
  });
}

export async function checkHolidayExists(tenantId, holidayDate, location = null, excludeId = null) {
  const where = {
    tenantId,
    holidayDate,
    location: location || null,
  };

  if (excludeId) {
    Object.assign(where, { NOT: { id: excludeId } });
  }

  return prisma.holiday.findFirst({ where });
}
