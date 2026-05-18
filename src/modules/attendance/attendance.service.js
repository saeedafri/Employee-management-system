import * as attendanceRepository from './attendance.repository.js';

class AppError extends Error {
  constructor(message, code, statusCode = 400, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = (Math.sin(dLat / 2) * Math.sin(dLat / 2)) + (Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2));
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function checkIn(tenantId, employeeId, { latitude, longitude, note }) {
  const existingRecord = await attendanceRepository.getTodayAttendance(tenantId, employeeId);

  if (existingRecord && existingRecord.checkInAt) {
    throw new AppError('Already checked in today', 'ALREADY_CHECKED_IN', 400);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let geofenceValid = true;
  let locationJson = null;

  if (latitude !== undefined && longitude !== undefined) {
    locationJson = {
      latitude,
      longitude,
      checkedInAt: new Date(),
    };

    const officeLatitude = 28.5244;
    const officeLongitude = 77.1855;
    const distance = calculateDistance(latitude, longitude, officeLatitude, officeLongitude);
    geofenceValid = distance <= 100;
  }

  let attendanceRecord;
  if (existingRecord) {
    attendanceRecord = await attendanceRepository.updateAttendanceRecord(tenantId, existingRecord.id, {
      checkInAt: new Date(),
      notes: note || null,
      locationJson,
    });
  } else {
    attendanceRecord = await attendanceRepository.createAttendanceRecord({
      tenantId,
      employeeId,
      attendanceDate: today,
      checkInAt: new Date(),
      status: 'PRESENT',
      notes: note || null,
      locationJson,
    });
  }

  return {
    id: attendanceRecord.id,
    checkInAt: attendanceRecord.checkInAt,
    geofenceValid,
  };
}

export async function checkOut(tenantId, employeeId, { note } = {}) {
  const existingRecord = await attendanceRepository.getTodayAttendance(tenantId, employeeId);

  if (!existingRecord) {
    throw new AppError('No check-in record found for today', 'NO_CHECK_IN', 400);
  }

  if (!existingRecord.checkInAt) {
    throw new AppError('Not checked in yet', 'NOT_CHECKED_IN', 400);
  }

  if (existingRecord.checkOutAt) {
    throw new AppError('Already checked out today', 'ALREADY_CHECKED_OUT', 400);
  }

  const checkOutTime = new Date();
  const checkInTime = new Date(existingRecord.checkInAt);
  const durationMinutes = Math.round((checkOutTime - checkInTime) / (1000 * 60));

  const attendanceRecord = await attendanceRepository.updateAttendanceRecord(
    tenantId,
    existingRecord.id,
    {
      checkOutAt: checkOutTime,
      totalMinutes: durationMinutes,
      notes: note || null,
    },
  );

  return {
    id: attendanceRecord.id,
    checkInAt: attendanceRecord.checkInAt,
    checkOutAt: attendanceRecord.checkOutAt,
    durationMinutes,
  };
}

export async function getAttendanceRecords(tenantId, employeeId, filters = {}) {
  const {
    page = 1, limit = 10, fromDate, toDate,
  } = filters;

  const offset = (page - 1) * limit;

  return attendanceRepository.getAttendanceRecords(tenantId, employeeId, {
    fromDate,
    toDate,
    limit,
    offset,
  });
}

export async function getTeamAttendanceRecords(tenantId, managerEmployeeId, filters = {}) {
  const {
    page = 1, limit = 10, fromDate, toDate,
  } = filters;

  const offset = (page - 1) * limit;

  return attendanceRepository.getTeamAttendanceRecords(tenantId, managerEmployeeId, {
    fromDate,
    toDate,
    limit,
    offset,
  });
}

export async function getAttendanceSummary(tenantId, employeeId, fromDate, toDate) {
  const startDate = fromDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endDate = toDate || new Date();

  return attendanceRepository.getAttendanceSummary(tenantId, employeeId, startDate, endDate);
}

export async function submitRegularizationRequest(tenantId, employeeId, {
  attendanceDate, type, reason,
}) {
  const request = await attendanceRepository.createRegularizationRequest({
    tenantId,
    employeeId,
    attendanceDate: new Date(attendanceDate),
    type,
    reason,
    status: 'PENDING',
  });

  return request;
}

export async function getRegularizationRequests(tenantId, employeeId, filters = {}) {
  const {
    page = 1, limit = 10, status,
  } = filters;

  const offset = (page - 1) * limit;

  return attendanceRepository.getRegularizationRequests(tenantId, employeeId, {
    limit,
    offset,
    status,
  });
}

export async function getTeamRegularizationRequests(tenantId, managerEmployeeId, filters = {}) {
  const {
    page = 1, limit = 10, status,
  } = filters;

  const offset = (page - 1) * limit;

  return attendanceRepository.getTeamRegularizationRequests(tenantId, managerEmployeeId, {
    limit,
    offset,
    status,
  });
}

export async function approveRegularization(tenantId, regularizationId, reviewerId, comment = '') {
  const request = await attendanceRepository.findRegularizationRequest(tenantId, regularizationId);

  if (!request) {
    throw new AppError('Regularization request not found', 'REGULARIZATION_NOT_FOUND', 404);
  }

  if (request.status !== 'PENDING') {
    throw new AppError(
      `Cannot approve request with status ${request.status}`,
      'INVALID_REQUEST_STATUS',
      400,
    );
  }

  const updated = await attendanceRepository.updateRegularizationRequest(tenantId, regularizationId, {
    status: 'APPROVED',
    reviewerId,
    reviewerComment: comment || null,
  });

  await attendanceRepository.updateAttendanceStatus(tenantId, request.employeeId, request.attendanceDate, 'PRESENT');

  return updated;
}

export async function denyRegularization(tenantId, regularizationId, reviewerId, comment) {
  const request = await attendanceRepository.findRegularizationRequest(tenantId, regularizationId);

  if (!request) {
    throw new AppError('Regularization request not found', 'REGULARIZATION_NOT_FOUND', 404);
  }

  if (request.status !== 'PENDING') {
    throw new AppError(
      `Cannot deny request with status ${request.status}`,
      'INVALID_REQUEST_STATUS',
      400,
    );
  }

  const updated = await attendanceRepository.updateRegularizationRequest(tenantId, regularizationId, {
    status: 'DENIED',
    reviewerId,
    reviewerComment: comment,
  });

  return updated;
}
