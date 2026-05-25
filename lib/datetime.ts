/**
 * Zentrale Zeit-Helper für Auftragswerk.
 *
 * Problem: datetime-local-Inputs liefern strings ohne Timezone. JS-Date-
 * Konstruktoren interpretieren das als "local time" der jeweiligen Runtime
 * (Browser: User-TZ, Server: meist UTC). Bei einem DACH-Tool das von einem
 * Dev aus Bali getestet wird, führt das zu +8h-Versatz.
 *
 * Lösung: alle Termine sind semantisch in `Europe/Berlin`. Eingabe + Anzeige
 * + Cell-Math werden explizit in dieser Zone gerechnet, unabhängig davon,
 * wo der User-Browser oder die Vercel-Function gerade läuft. Spätere
 * Multi-TZ-Unterstützung wäre ein Feld auf `betriebe`, nicht hier.
 */

import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { de } from 'date-fns/locale';

export const BETRIEB_TZ = 'Europe/Berlin';

/**
 * Wandelt einen datetime-local-String (z.B. "2026-05-25T14:00") in ein
 * UTC-ISO-Timestamp um, wobei der String als Zeit in BETRIEB_TZ interpretiert
 * wird. Heißt: egal in welcher Browser-TZ der User tippt – "14:00" wird
 * als 14:00 Berlin behandelt.
 */
export function berlinLocalToUtcIso(datetimeLocal: string): string {
  // fromZonedTime akzeptiert ISO-ohne-TZ und interpretiert in der gegebenen Zone
  return fromZonedTime(datetimeLocal, BETRIEB_TZ).toISOString();
}

/**
 * Wandelt eine UTC-ISO-Zeit in das datetime-local-Format ("YYYY-MM-DDTHH:MM"),
 * das den Berliner Zeitpunkt repräsentiert – zum Pre-Fill von datetime-local-
 * Inputs.
 */
export function utcIsoToBerlinLocal(utcIso: string): string {
  return formatInTimeZone(utcIso, BETRIEB_TZ, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Display-Formatierung für Termin-Datumsangaben in Berliner Zeit,
 * deutsche Locale (Wochentag-Kürzel etc.).
 * Default-Format: "Mo., 26.05.2026, 14:00 Uhr"
 */
export function formatBerlinDatetime(
  utcIso: string,
  pattern: string = "EEEEEE, dd.MM.yyyy, HH:mm 'Uhr'"
): string {
  return formatInTimeZone(utcIso, BETRIEB_TZ, pattern, { locale: de });
}

/**
 * Erzeugt ein UTC-Date, das einer konkreten Berliner Uhrzeit an einem Tag
 * entspricht. Vom WochenGrid für cellStart/cellEnd verwendet.
 *
 * monthOneBased: 1 = Januar (NICHT 0-basiert wie bei JS-Date-Konstruktor).
 */
export function berlinDateTimeToUtc(
  year: number,
  monthOneBased: number,
  day: number,
  hour: number,
  minute = 0
): Date {
  const isoLocal =
    `${year}-${String(monthOneBased).padStart(2, '0')}-${String(day).padStart(2, '0')}` +
    `T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  return fromZonedTime(isoLocal, BETRIEB_TZ);
}

/**
 * Erzeugt ein UTC-Date für "heute 00:00 Berliner Zeit". Für Tag-/Wochen-
 * Berechnungen wie der Mini-Stat-Bar.
 */
export function berlinStartOfToday(): Date {
  const todayBerlin = formatInTimeZone(new Date(), BETRIEB_TZ, 'yyyy-MM-dd');
  return fromZonedTime(`${todayBerlin}T00:00:00`, BETRIEB_TZ);
}

/**
 * Erzeugt ein UTC-Date für "Montag 00:00 Berliner Zeit der laufenden Woche".
 */
export function berlinStartOfWeek(): Date {
  const today = new Date();
  // Berlin-lokaler Wochentag (1=Mo .. 7=So per ISO)
  const isoDay = parseInt(formatInTimeZone(today, BETRIEB_TZ, 'i'), 10);
  const todayBerlin = formatInTimeZone(today, BETRIEB_TZ, 'yyyy-MM-dd');
  const [y, m, d] = todayBerlin.split('-').map(Number);
  // Subtrahiere (isoDay - 1) Tage, um auf Montag zu kommen
  const monday = new Date(Date.UTC(y, m - 1, d));
  monday.setUTCDate(monday.getUTCDate() - (isoDay - 1));
  const mondayDateStr = `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
  return fromZonedTime(`${mondayDateStr}T00:00:00`, BETRIEB_TZ);
}

/**
 * Parsed ein "YYYY-MM-DD" und liefert das UTC-Date für 00:00 Berlin Zeit
 * an diesem Tag. Für Tag-für-Tag-Iteration im Wochengrid.
 */
export function berlinDayStartFromIsoDate(yyyyMmDd: string): Date {
  return fromZonedTime(`${yyyyMmDd}T00:00:00`, BETRIEB_TZ);
}
