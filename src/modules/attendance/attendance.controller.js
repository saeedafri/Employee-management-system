import { successResponse, errorResponse } from '../../utils/response.js';
import * as attendanceService from './attendance.service.js';
import * as attendanceValidator from './attendance.validator.js';
import { uploadToCloudinary, isCloudinaryConfigured } from '../../utils/cloudinary.js';
import { prisma } from '../../plugins/prisma.js';

export async function checkIn(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const employeeId = request.user.employeeId;

    if (!employeeId) {
      return reply.status(400).send(errorResponse('NO_EMPLOYEE_RECORD', 'User has no employee record', {}, request.id));
    }

    const body = attendanceValidator.checkInSchema.parse(request.body);

    const result = await attendanceService.checkIn(tenantId, employeeId, body);

    await request.log.info({
      action: 'ATTENDANCE_CHECK_IN',
      employeeId,
      geofenceValid: result.geofenceValid,
    });

    return reply.status(201).send(
      successResponse({
        id: result.id,
        referenceNo: result.referenceNo,
        checkInAt: result.checkInAt,
        geofenceValid: result.geofenceValid,
        message: 'Checked in successfully',
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function checkOut(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const employeeId = request.user.employeeId;

    if (!employeeId) {
      return reply.status(400).send(errorResponse('NO_EMPLOYEE_RECORD', 'User has no employee record', {}, request.id));
    }

    const body = attendanceValidator.checkOutSchema.parse(request.body || {});

    const result = await attendanceService.checkOut(tenantId, employeeId, body);

    await request.log.info({
      action: 'ATTENDANCE_CHECK_OUT',
      employeeId,
      durationMinutes: result.durationMinutes,
    });

    return reply.send(
      successResponse({
        id: result.id,
        referenceNo: result.referenceNo,
        checkInAt: result.checkInAt,
        checkOutAt: result.checkOutAt,
        durationMinutes: result.durationMinutes,
        message: 'Checked out successfully',
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function getAttendanceRecords(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const employeeId = request.user.employeeId;

    const query = attendanceValidator.getAttendanceRecordsSchema.parse(request.query);

    const { records, total } = await attendanceService.getAttendanceRecords(tenantId, employeeId, query);

    return reply.send(
      successResponse({
        records: records.map((r) => ({
          id: r.id,
          referenceNo: r.referenceNo,
          attendanceDate: r.attendanceDate,
          checkInAt: r.checkInAt,
          checkOutAt: r.checkOutAt,
          status: r.status,
          workMode: r.workMode,
          totalMinutes: r.totalMinutes,
          notes: r.notes,
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.ceil(total / query.limit),
        },
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function getTeamAttendanceRecords(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const managerEmployeeId = request.user.employeeId;

    const query = attendanceValidator.getAttendanceRecordsSchema.parse(request.query);

    const { records, total } = await attendanceService.getTeamAttendanceRecords(
      tenantId,
      managerEmployeeId,
      query,
    );

    return reply.send(
      successResponse({
        records: records.map((r) => ({
          id: r.id,
          referenceNo: r.referenceNo,
          employeeId: r.employeeId,
          employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
          employeeCode: r.employee.employeeCode,
          attendanceDate: r.attendanceDate,
          checkInAt: r.checkInAt,
          checkOutAt: r.checkOutAt,
          status: r.status,
          workMode: r.workMode,
          totalMinutes: r.totalMinutes,
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.ceil(total / query.limit),
        },
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function getAttendanceSummary(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const employeeId = request.user.employeeId;

    const query = attendanceValidator.getAttendanceSummarySchema.parse(request.query);

    const summary = await attendanceService.getAttendanceSummary(tenantId, employeeId, query.fromDate, query.toDate);

    return reply.send(successResponse(summary));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function submitRegularization(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const employeeId = request.user.employeeId;

    const body = attendanceValidator.regularizationRequestSchema.parse(request.body);

    const regularization = await attendanceService.submitRegularizationRequest(tenantId, employeeId, body);

    await request.log.info({
      action: 'REGULARIZATION_REQUEST_CREATED',
      regularizationId: regularization.id,
      employeeId,
    });

    return reply.status(201).send(
      successResponse({
        id: regularization.id,
        referenceNo: regularization.referenceNo,
        attendanceDate: regularization.attendanceDate,
        type: regularization.type,
        status: regularization.status,
        reason: regularization.reason,
        createdAt: regularization.createdAt,
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function getRegularizationRequests(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const employeeId = request.user.employeeId;

    const query = attendanceValidator.getAttendanceRecordsSchema.parse(request.query);

    const { requests, total } = await attendanceService.getRegularizationRequests(
      tenantId,
      employeeId,
      query,
    );

    return reply.send(
      successResponse({
        requests: requests.map((r) => ({
          id: r.id,
          referenceNo: r.referenceNo,
          attendanceDate: r.attendanceDate,
          reason: r.reason,
          status: r.status,
          reviewerComment: r.reviewerComment,
          createdAt: r.createdAt,
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.ceil(total / query.limit),
        },
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function getTeamRegularizationRequests(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const managerEmployeeId = request.user.employeeId;

    const query = attendanceValidator.getAttendanceRecordsSchema.parse(request.query);

    const { requests, total } = await attendanceService.getTeamRegularizationRequests(
      tenantId,
      managerEmployeeId,
      query,
    );

    return reply.send(
      successResponse({
        requests: requests.map((r) => ({
          id: r.id,
          referenceNo: r.referenceNo,
          employeeId: r.employeeId,
          employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
          employeeCode: r.employee.employeeCode,
          attendanceDate: r.attendanceDate,
          reason: r.reason,
          status: r.status,
          createdAt: r.createdAt,
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.ceil(total / query.limit),
        },
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function approveRegularization(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const reviewerId = request.user.id;
    const { id } = request.params;

    const body = attendanceValidator.approveRegularizationSchema.parse(request.body || {});

    const regularization = await attendanceService.approveRegularization(
      tenantId,
      id,
      reviewerId,
      body.reviewerComment,
    );

    await request.log.info({
      action: 'REGULARIZATION_APPROVED',
      regularizationId: id,
      reviewerId,
    });

    return reply.send(
      successResponse({
        id: regularization.id,
        referenceNo: regularization.referenceNo,
        status: regularization.status,
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function denyRegularization(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const reviewerId = request.user.id;
    const { id } = request.params;

    const body = attendanceValidator.denyRegularizationSchema.parse(request.body);

    const regularization = await attendanceService.denyRegularization(
      tenantId,
      id,
      reviewerId,
      body.reviewerComment,
    );

    await request.log.info({
      action: 'REGULARIZATION_DENIED',
      regularizationId: id,
      reviewerId,
    });

    return reply.send(
      successResponse({
        id: regularization.id,
        referenceNo: regularization.referenceNo,
        status: regularization.status,
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function uploadRegularizationDocument(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const { employeeId } = request.user;
    const { id } = request.params;

    if (!employeeId) return reply.code(400).send(errorResponse('NO_EMPLOYEE_RECORD', 'No employee linked to your account', {}, request.id));

    const reg = await prisma.attendanceRegularizationRequest.findFirst({ where: { id, tenantId } });
    if (!reg) return reply.code(404).send(errorResponse('REGULARIZATION_NOT_FOUND', 'Regularization request not found', {}, request.id));
    if (reg.employeeId !== employeeId) return reply.code(403).send(errorResponse('FORBIDDEN', 'Not your regularization request', {}, request.id));
    if (reg.documentUrl) return reply.code(409).send(errorResponse('DOCUMENT_ALREADY_EXISTS', 'A document is already attached to this request', {}, request.id));

    if (!isCloudinaryConfigured()) return reply.code(503).send(errorResponse('STORAGE_NOT_CONFIGURED', 'File storage not configured', {}, request.id));

    const data = await request.file();
    if (!data) return reply.code(422).send(errorResponse('INVALID_FILE_TYPE', 'No file uploaded', {}, request.id));

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(data.mimetype)) return reply.code(422).send(errorResponse('INVALID_FILE_TYPE', 'File must be PDF, JPG, PNG, DOC or DOCX', {}, request.id));

    const chunks = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    if (buffer.length > 5 * 1024 * 1024) return reply.code(422).send(errorResponse('FILE_TOO_LARGE', 'File exceeds 5 MB limit', {}, request.id));

    let uploaded;
    try {
      uploaded = await uploadToCloudinary(buffer, { folder: `ems/regularization/${id}`, resourceType: 'auto' });
    } catch (uploadErr) {
      request.log.error({ uploadErr }, 'Cloudinary upload failed');
      return reply.code(502).send(errorResponse('UPLOAD_FAILED', 'File upload failed. Please try again.', {}, request.id));
    }
    await prisma.attendanceRegularizationRequest.update({ where: { id }, data: { documentUrl: uploaded.url } });

    return reply.code(201).send(successResponse({ documentUrl: uploaded.url }));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function getTeamWeekly(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const { weekStart, departmentId } = request.query;
    const managerEmployeeId = request.user.memberType === 'MANAGER' ? request.user.employeeId : null;
    const result = await attendanceService.getTeamWeeklyGrid(tenantId, weekStart || null, departmentId || null, managerEmployeeId);
    return reply.send(successResponse(result));
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}
