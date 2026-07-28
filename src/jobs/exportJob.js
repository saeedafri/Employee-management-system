import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { uploadToCloudinary, isCloudinaryConfigured } from '../utils/cloudinary.js';
import * as exportRepository from '../modules/export/export.repository.js';

const EXPORTS_DIR = config.exportsDir || '/tmp/exports';
mkdirSync(EXPORTS_DIR, { recursive: true });

/** Prefix stored in ExportJob.fileUrl when the artifact lives on Cloudinary. */
export const CLOUDINARY_FILE_PREFIX = 'cloudinary://';

// Column styles for Excel
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
const HEADER_FONT = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const ALT_ROW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0FF' } };
const BORDER_STYLE = { style: 'thin', color: { argb: 'FFDDDDDD' } };
const BORDER = { top: BORDER_STYLE, left: BORDER_STYLE, bottom: BORDER_STYLE, right: BORDER_STYLE };

function downloadApiUrl(jobId) {
  const base = (config.apiUrl || '').replace(/\/$/, '');
  return `${base}/export/${jobId}/download`;
}

async function persistSuccess(jobId, tenantId, filename, format) {
  const filepath = join(EXPORTS_DIR, filename);
  let fileUrl = downloadApiUrl(jobId);

  if (isCloudinaryConfigured()) {
    try {
      const buffer = readFileSync(filepath);
      const uploaded = await uploadToCloudinary(buffer, {
        folder: `ems/${tenantId}/exports`,
        publicId: jobId,
        resourceType: 'raw',
        type: 'authenticated',
      });
      // Durable storage key; download route mints a signed URL / streams from disk fallback.
      fileUrl = `${CLOUDINARY_FILE_PREFIX}${uploaded.publicId}`;
      logger.info({
        type: 'export_uploaded_cloudinary',
        jobId,
        publicId: uploaded.publicId,
        bytes: uploaded.bytes,
        format,
      });
    } catch (err) {
      logger.warn({
        type: 'export_cloudinary_upload_failed',
        jobId,
        error: err.message,
        fallback: 'local_disk',
      });
      fileUrl = downloadApiUrl(jobId);
    }
  }

  await exportRepository.updateExportJobStatus(jobId, 'SUCCESS', fileUrl);
  return fileUrl;
}

export async function exportEmployees(jobId, tenantId, filters) {
  try {
    const employees = await exportRepository.getEmployeesForExport(tenantId, {
      departmentId: filters.department_id,
      status: filters.status,
      include_archived: filters.include_archived,
      ids: filters.ids,
    });

    const filename = await generateExportFile(employees, 'employees', filters.format, jobId);
    await persistSuccess(jobId, tenantId, filename, filters.format);

    logger.info({ type: 'export_completed', jobId, exportType: 'EMPLOYEES', recordCount: employees.length });
    return { success: true, filename, recordCount: employees.length };
  } catch (error) {
    logger.error({ type: 'export_failed', jobId, exportType: 'EMPLOYEES', error: error.message });
    await exportRepository.updateExportJobStatus(jobId, 'FAILED', null, error.message);
    throw error;
  }
}

export async function exportAttendance(jobId, tenantId, filters) {
  try {
    const records = await exportRepository.getAttendanceForExport(tenantId, {
      departmentId: filters.department_id,
      fromDate: filters.from_date,
      toDate: filters.to_date,
    });

    const filename = await generateExportFile(records, 'attendance', filters.format, jobId);
    await persistSuccess(jobId, tenantId, filename, filters.format);

    logger.info({ type: 'export_completed', jobId, exportType: 'ATTENDANCE', recordCount: records.length });
    return { success: true, filename, recordCount: records.length };
  } catch (error) {
    logger.error({ type: 'export_failed', jobId, exportType: 'ATTENDANCE', error: error.message });
    await exportRepository.updateExportJobStatus(jobId, 'FAILED', null, error.message);
    throw error;
  }
}

export async function exportLeave(jobId, tenantId, filters) {
  try {
    const leaves = await exportRepository.getLeaveForExport(tenantId, {
      fromDate: filters.from_date,
      toDate: filters.to_date,
      leaveType: filters.leave_type,
      status: filters.status,
    });

    const filename = await generateExportFile(leaves, 'leave', filters.format, jobId);
    await persistSuccess(jobId, tenantId, filename, filters.format);

    logger.info({ type: 'export_completed', jobId, exportType: 'LEAVE', recordCount: leaves.length });
    return { success: true, filename, recordCount: leaves.length };
  } catch (error) {
    logger.error({ type: 'export_failed', jobId, exportType: 'LEAVE', error: error.message });
    await exportRepository.updateExportJobStatus(jobId, 'FAILED', null, error.message);
    throw error;
  }
}

async function generateExportFile(data, type, format, jobId) {
  const ext = format === 'excel' ? 'xlsx' : format;
  const filename = `${jobId}.${ext}`;
  const filepath = join(EXPORTS_DIR, filename);

  if (format === 'csv') {
    await generateCSV(data, filepath);
  } else if (format === 'excel') {
    await generateExcel(data, type, filepath);
  } else if (format === 'json') {
    await generateJSON(data, filepath);
  } else if (format === 'pdf') {
    await generatePDF(data, type, filepath);
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }

  return filename;
}

async function generateCSV(data, filepath) {
  const flatData = data.map(flattenObject);

  if (flatData.length === 0) {
    writeFileSync(filepath, '');
    return;
  }

  const headers = Object.keys(flatData[0]);
  const rows = [
    headers.map(escapeCSV).join(','),
    ...flatData.map((row) => headers.map((h) => escapeCSV(String(row[h] ?? ''))).join(',')),
  ];
  writeFileSync(filepath, rows.join('\n'), 'utf8');
}

async function generateExcel(data, type, filepath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EMS';
  workbook.created = new Date();

  const sheetTitle = type.charAt(0).toUpperCase() + type.slice(1);
  const sheet = workbook.addWorksheet(sheetTitle, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const flatData = data.map(flattenObject);

  if (flatData.length === 0) {
    sheet.addRow(['No data available']);
    await workbook.xlsx.writeFile(filepath);
    return;
  }

  const headers = Object.keys(flatData[0]);

  sheet.columns = headers.map((key) => ({
    key,
    header: formatColumnHeader(key),
    width: Math.max(formatColumnHeader(key).length + 4, 14),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
  });
  headerRow.height = 28;

  flatData.forEach((rowData, idx) => {
    const row = sheet.addRow(headers.map((h) => {
      const val = rowData[h];
      if (val instanceof Date) return val;
      return val ?? '';
    }));

    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = ALT_ROW_FILL;
      });
    }

    row.eachCell((cell) => {
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle', wrapText: false };
    });

    row.height = 20;
  });

  sheet.columns.forEach((col) => {
    let maxLen = col.header ? col.header.length : 10;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 4, 40);
  });

  const summaryRow = sheet.addRow([]);
  summaryRow.getCell(1).value = `Total: ${flatData.length} records`;
  summaryRow.getCell(1).font = { bold: true, color: { argb: 'FF4F46E5' } };
  summaryRow.getCell(headers.length).value = `Exported: ${new Date().toLocaleString()}`;
  summaryRow.getCell(headers.length).alignment = { horizontal: 'right' };

  await workbook.xlsx.writeFile(filepath);
}

async function generateJSON(data, filepath) {
  writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

async function generatePDF(data, type, filepath) {
  const flatData = data.map(flattenObject);
  const title = `EMS ${type.charAt(0).toUpperCase() + type.slice(1)} Export`;

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => {
      try {
        writeFileSync(filepath, Buffer.concat(chunks));
        resolve();
      } catch (err) {
        reject(err);
      }
    });
    doc.on('error', reject);

    doc.fontSize(16).fillColor('#4F46E5').text(title, { underline: false });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#666666').text(`Generated: ${new Date().toLocaleString()}  |  Records: ${flatData.length}`);
    doc.moveDown(1);

    if (flatData.length === 0) {
      doc.fontSize(11).fillColor('#000000').text('No data available');
      doc.end();
      return;
    }

    const headers = Object.keys(flatData[0]);
    const maxCols = Math.min(headers.length, 8);
    const cols = headers.slice(0, maxCols);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / cols.length;
    const startX = doc.page.margins.left;

    const drawHeader = () => {
      let x = startX;
      const y = doc.y;
      doc.rect(startX, y, pageWidth, 18).fill('#4F46E5');
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
      cols.forEach((h) => {
        doc.text(formatColumnHeader(h).slice(0, 24), x + 2, y + 5, {
          width: colWidth - 4,
          ellipsis: true,
        });
        x += colWidth;
      });
      doc.y = y + 22;
      doc.fillColor('#000000').font('Helvetica');
    };

    drawHeader();

    flatData.forEach((row, idx) => {
      if (doc.y > doc.page.height - 50) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      if (idx % 2 === 1) {
        doc.rect(startX, y - 2, pageWidth, 14).fill('#F0F0FF');
      }
      let x = startX;
      doc.fillColor('#111111').fontSize(7);
      cols.forEach((h) => {
        const val = row[h];
        const text = val instanceof Date ? val.toISOString() : String(val ?? '');
        doc.text(text.slice(0, 40), x + 2, y, { width: colWidth - 4, ellipsis: true, lineBreak: false });
        x += colWidth;
      });
      doc.y = y + 14;
    });

    if (headers.length > maxCols) {
      doc.moveDown(1);
      doc.fontSize(8).fillColor('#666666').text(
        `Note: showing first ${maxCols} of ${headers.length} columns. Use Excel/CSV for full columns.`,
      );
    }

    doc.end();
  });
}

function formatColumnHeader(key) {
  return key
    .replace(/\./g, ' › ')
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function escapeCSV(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined) {
      result[newKey] = '';
    } else if (value instanceof Date) {
      result[newKey] = value;
    } else if (typeof value === 'object') {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}
