const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dateFromYmd(ymd) {
  if (typeof ymd !== 'string' || !YMD_RE.test(ymd)) return null;
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function ymdInTimezone(now = new Date(), timezone = 'UTC') {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  } catch {
    return ymdInTimezone(now, 'UTC');
  }
}

export function tenantAttendanceDate(now = new Date(), timezone = 'UTC') {
  return dateFromYmd(ymdInTimezone(now, timezone || 'UTC'));
}

export function attendanceDayRange(attendanceDate) {
  const start = new Date(Date.UTC(
    attendanceDate.getUTCFullYear(),
    attendanceDate.getUTCMonth(),
    attendanceDate.getUTCDate(),
  ));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
