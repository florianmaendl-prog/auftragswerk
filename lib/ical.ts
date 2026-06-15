/**
 * iCal-Generator (RFC 5545) für Termin-Export.
 *
 * Owner kann jeden Termin als .ics-Datei downloaden und in seinen
 * eigenen Kalender (Apple/Google/Outlook) importieren. Bei Owner-
 * Bestätigung auch optional als Anhang an die Kunden-Mail (so importiert
 * der Kunde direkt – Premium-Workflow).
 *
 * Keep it simple: VEVENT mit DTSTART, DTEND, SUMMARY, LOCATION, DESCRIPTION.
 * Keine VALARMs (Owner-Kalender setzt eigene Reminder).
 */

type IcalTermin = {
  uid: string; // typisch <termin-id>@auftragswerk.app
  start: Date;
  /** Default-Dauer 1h wenn end nicht gesetzt */
  end?: Date;
  summary: string;
  location?: string | null;
  description?: string | null;
  organizerName?: string;
  organizerEmail?: string;
};

/**
 * Baut einen vollständigen VCALENDAR-String mit einem VEVENT. iCal
 * verlangt CRLF-Zeilenumbrüche (RFC 5545) – wir liefern die korrekt
 * zurück.
 */
export function buildIcsForTermin(t: IcalTermin): string {
  const end = t.end ?? new Date(t.start.getTime() + 60 * 60 * 1000);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Auftragswerk//Termin//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${t.uid}`,
    `DTSTAMP:${formatIcal(new Date())}`,
    `DTSTART:${formatIcal(t.start)}`,
    `DTEND:${formatIcal(end)}`,
    `SUMMARY:${escapeIcal(t.summary)}`,
  ];
  if (t.location) {
    lines.push(`LOCATION:${escapeIcal(t.location)}`);
  }
  if (t.description) {
    lines.push(`DESCRIPTION:${escapeIcal(t.description)}`);
  }
  if (t.organizerEmail) {
    const name = t.organizerName ? `;CN=${escapeIcal(t.organizerName)}` : '';
    lines.push(`ORGANIZER${name}:mailto:${t.organizerEmail}`);
  }
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** YYYYMMDDTHHMMSSZ in UTC – iCal-Standard für absolute Zeiten. */
function formatIcal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

/**
 * iCal-Text-Escape: Kommas, Semikolons, Backslashes und Zeilenumbrüche.
 * Long-Line-Folding (75 Zeichen) lassen wir weg – moderne Parser ignorieren
 * Überlängen, und unsere Strings sind eh kurz.
 */
function escapeIcal(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
