/**
 * Zentrale Enum→Klartext-Maps für UI-Anzeige (Iron Rule 14:
 * 50-jähriger Praktiker, kein Tech-Jargon). Fallback: roher Wert,
 * damit unbekannte Werte nichts crashen.
 *
 * Werte-Quelle: lib/klassifikation.ts KlassifikationResult.
 */

export const KATEGORIE_LABEL: Record<string, string> = {
  kundenanfrage: 'Kundenanfrage',
  innung_behoerde: 'Kammer/Verband',
  werbung: 'Werbung',
  rechnung: 'Rechnung/Beleg',
  bestellung_versand: 'Bestellung/Versand',
  sonstiges: 'Sonstiges',
};

export const WERT_LABEL: Record<string, string> = {
  klein: 'Klein',
  mittel: 'Mittel',
  gross: 'Groß',
  unklar: 'Unklar',
};

export const DRINGLICHKEIT_LABEL: Record<string, string> = {
  hoch: 'Hoch',
  mittel: 'Mittel',
  niedrig: 'Niedrig',
};

export const GEWERK_MATCH_LABEL: Record<string, string> = {
  passt: 'Passt',
  passt_nicht: 'Passt nicht',
  unklar: 'Unklar',
};

export const KUNDE_TYP_LABEL: Record<string, string> = {
  privat: 'Privatkunde',
  architekt: 'Architekt',
  bautraeger: 'Bauträger',
  gewerbe: 'Gewerbe',
  lieferant: 'Lieferant',
  unklar: 'Unklar',
};

export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '';
  return map[value] ?? value;
}
