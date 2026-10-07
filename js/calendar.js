// Kalender-Erinnerungen als .ics (iCalendar). Funktioniert ohne Server:
// iOS übernimmt den Termin samt Alarm in die Kalender-App und erinnert zuverlässig,
// auch wenn die Web-App geschlossen ist.

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const stamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const escIcs = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

// { uid, title, date: Date, description, alarmsDaysBefore: [14, 1] }
export function buildIcs({ uid, title, date, description = '', alarmsDaysBefore = [14, 1] }) {
  const next = new Date(date); next.setDate(next.getDate() + 1);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NebenkostenCheck//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@nebenkostencheck`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART;VALUE=DATE:${ymd(date)}`,
    `DTEND;VALUE=DATE:${ymd(next)}`,
    `SUMMARY:${escIcs(title)}`,
    `DESCRIPTION:${escIcs(description)}`,
    'TRANSP:TRANSPARENT',
    ...alarmsDaysBefore.flatMap((d) => [
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escIcs(title)}`,
      // Ganztägiger Termin beginnt um 0 Uhr → Erinnerung um 9 Uhr, d Tage vorher
      `TRIGGER:${d === 0 ? 'PT9H' : `-P${d - 1}DT15H`}`, 'END:VALARM',
    ]),
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}
