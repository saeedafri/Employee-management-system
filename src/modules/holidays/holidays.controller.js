import crypto from 'crypto';
import * as service from './holidays.service.js';
import * as validator from './holidays.validator.js';
import { successResponse, errorResponse } from '../../utils/response.js';
import { parseIcs } from '../../utils/icsParser.js';
import { createJob, getJob, markCommitted } from '../../utils/importJobStore.js';
import { prisma } from '../../plugins/prisma.js';

export async function getUpcomingHolidays(request, reply) {
  const tenantId = request.tenant.id;
  try {
    const limit = parseInt(request.query.limit, 10) || 3;
    const result = await service.getUpcomingHolidays(tenantId, limit);
    reply.code(200).send(result);
  } catch (error) {
    reply.code(500).send(errorResponse('INTERNAL_ERROR', error.message, request.requestId));
  }
}

export async function listHolidays(request, reply) {
  const tenantId = request.tenant.id;

  try {
    const query = await validator.listQuerySchema.parseAsync(request.query);
    const result = await service.listHolidays(tenantId, query);
    reply.code(result.error ? 400 : 200).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function createHoliday(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can create holidays', request.requestId));
  }

  try {
    const data = await validator.createHolidaySchema.parseAsync(request.body);
    const result = await service.createHoliday(tenantId, data, user.id);
    reply.code(result.error ? 400 : 201).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function updateHoliday(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can update holidays', request.requestId));
  }

  try {
    const { id } = await validator.idParamSchema.parseAsync(request.params);
    const data = await validator.updateHolidaySchema.parseAsync(request.body);
    const result = await service.updateHoliday(id, tenantId, data);
    reply.code(result.error ? 400 : 200).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}

export async function deleteHoliday(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only HR/Admin can delete holidays', request.requestId));
  }

  try {
    const { id } = await validator.idParamSchema.parseAsync(request.params);
    const result = await service.deleteHoliday(id, tenantId);
    reply.code(result.error ? 400 : 200).send(result);
  } catch (error) {
    reply.code(400).send(errorResponse('VALIDATION_ERROR', error.message, request.requestId));
  }
}
export async function importHolidays(request, reply) {
  const tenantId = request.tenant.id;
  const data = await request.file();
  if (!data) return reply.code(422).send(errorResponse('INVALID_FILE_TYPE', 'No file uploaded', {}, request.id));
  if (!['text/calendar', 'application/octet-stream'].includes(data.mimetype) && !data.filename?.endsWith('.ics'))
    return reply.code(422).send(errorResponse('INVALID_FILE_TYPE', 'File must be a .ics / text/calendar file', {}, request.id));
  const chunks = [];
  for await (const chunk of data.file) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  if (buffer.length > 1024 * 1024) return reply.code(422).send(errorResponse('FILE_TOO_LARGE', 'File exceeds 1 MB limit', {}, request.id));
  const text = buffer.toString('utf8');
  if (!text.includes('BEGIN:VCALENDAR')) return reply.code(400).send(errorResponse('PARSE_ERROR', 'Not a valid iCalendar file', {}, request.id));
  const events = parseIcs(text);
  if (!events.length) return reply.code(400).send(errorResponse('PARSE_ERROR', 'No events found in .ics file', {}, request.id));
  const existing = await prisma.holiday.findMany({ where: { tenantId }, select: { holidayDate: true } });
  const existingDates = new Set(existing.map(h => h.holidayDate.toISOString().split('T')[0]));
  const candidates = events.map(e => ({ ...e, willOverwrite: existingDates.has(e.date) }));
  const jobId = `imp_${crypto.randomBytes(4).toString('hex')}`;
  createJob(jobId, { tenantId, candidates });
  return reply.code(202).send(successResponse({ jobId, previewUrl: `/api/v1/holidays/import/${jobId}/preview` }));
}

export async function previewImport(request, reply) {
  const { jobId } = request.params;
  const job = getJob(jobId);
  if (!job || job.tenantId !== request.tenant.id) return reply.code(404).send(errorResponse('JOB_NOT_FOUND', 'Import job not found or expired', {}, request.id));
  const { candidates } = job;
  const summary = { new: candidates.filter(c => !c.willOverwrite).length, overwrites: candidates.filter(c => c.willOverwrite).length, skipped: 0 };
  return reply.send(successResponse({ candidates, summary }));
}

export async function commitImport(request, reply) {
  const { jobId } = request.params;
  const job = getJob(jobId);
  if (!job || job.tenantId !== request.tenant.id) return reply.code(404).send(errorResponse('JOB_NOT_FOUND', 'Import job not found or expired', {}, request.id));
  if (job.committed) return reply.code(409).send(errorResponse('ALREADY_COMMITTED', 'This import job was already committed', {}, request.id));
  markCommitted(jobId);
  const { overwriteExisting = false } = request.body || {};
  const { candidates } = job;
  let imported = 0, overwritten = 0, skipped = 0;
  for (const c of candidates) {
    const date = new Date(c.date);
    if (c.willOverwrite) {
      if (overwriteExisting) {
        await prisma.holiday.updateMany({ where: { tenantId: job.tenantId, holidayDate: date }, data: { name: c.name, isOptional: c.isOptional } });
        overwritten++;
      } else { skipped++; }
    } else {
      await prisma.holiday.create({ data: { tenantId: job.tenantId, name: c.name, holidayDate: date, isOptional: c.isOptional } });
      imported++;
    }
  }
  return reply.send(successResponse({ imported, overwritten, skipped }));
}
