import * as repo from './holidays.repository.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export async function listHolidays(tenantId, filters) {
  try {
    const { year = new Date().getFullYear(), country } = filters;
    const holidays = await repo.listHolidays(tenantId, year, country);
    return successResponse({ holidays, total: holidays.length }, { cached: false });
  } catch (error) {
    return errorResponse('LIST_ERROR', error.message, null);
  }
}

export async function createHoliday(tenantId, data, userId) {
  try {
    const holidayDate = new Date(data.holidayDate);

    if (holidayDate < new Date()) {
      return errorResponse('INVALID_DATE', 'Holiday date cannot be in the past', null);
    }

    const duplicate = await repo.checkHolidayExists(tenantId, holidayDate, data.location);
    if (duplicate) {
      return errorResponse('DUPLICATE_HOLIDAY', 'Holiday already exists for this date and location', null);
    }

    const holiday = await repo.createHoliday(tenantId, {
      name: data.name,
      holidayDate,
      location: data.location || null,
      isOptional: data.isOptional || false,
    });

    return successResponse(holiday, { cached: false });
  } catch (error) {
    return errorResponse('CREATE_ERROR', error.message, null);
  }
}

export async function updateHoliday(id, tenantId, data) {
  try {
    const existing = await repo.getHolidayById(id, tenantId);
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Holiday not found', null);
    }

    if (data.holidayDate) {
      const holidayDate = new Date(data.holidayDate);
      if (holidayDate < new Date()) {
        return errorResponse('INVALID_DATE', 'Holiday date cannot be in the past', null);
      }

      const duplicate = await repo.checkHolidayExists(tenantId, holidayDate, existing.location, id);
      if (duplicate) {
        return errorResponse('DUPLICATE_HOLIDAY', 'Holiday already exists for this date', null);
      }
    }

    const holiday = await repo.updateHoliday(id, tenantId, data);
    return successResponse(holiday, { cached: false });
  } catch (error) {
    return errorResponse('UPDATE_ERROR', error.message, null);
  }
}

export async function deleteHoliday(id, tenantId) {
  try {
    const existing = await repo.getHolidayById(id, tenantId);
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Holiday not found', null);
    }

    const deleted = await repo.deleteHoliday(id, tenantId);
    return successResponse({ id: deleted.id, status: 'deleted' }, { cached: false });
  } catch (error) {
    return errorResponse('DELETE_ERROR', error.message, null);
  }
}
