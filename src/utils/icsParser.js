// Minimal ICS (iCalendar) parser — extracts VEVENT blocks
export function parseIcs(text) {
  const events = [];
  const vevents = text.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

  for (const block of vevents) {
    const get = (key) => {
      const m = block.match(new RegExp(`^${key}[^:]*:(.+)$`, 'm'));
      return m ? m[1].trim() : null;
    };

    const summary = get('SUMMARY');
    const dtstart = get('DTSTART');
    const optional = block.includes('X-APPLE-OPTIONAL') || block.includes('TRANSP:TRANSPARENT');

    if (!summary || !dtstart) continue;

    // Parse date — handles DATE (YYYYMMDD) and DATETIME (YYYYMMDDTHHMMSSZ)
    const raw = dtstart.replace(/[TZ]/g, '').slice(0, 8);
    const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;

    events.push({ name: summary, date, isOptional: optional });
  }

  return events;
}
