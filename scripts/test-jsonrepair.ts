/**
 * Smoke-Test: jsonrepair-Library gegen die echten Haiku-Pannen.
 */
import { jsonrepair } from 'jsonrepair';

const haikuPanne = `\`\`\`json
{
  "kategorie": "werbung",
  "subkategorie": null,
  "gewerk_match": null,
  "wert_indikator": null,
  "kunde_typ": null,
  "dringlichkeit": null,
  "confidence": 0.98,
  "zusammenfassung": "Bewerbungsaufruf für Dokumentationsreihe „Von Hand" von HERO Software – kostenlose Mini-Doku im Wert von 10.000€, Bewerbungsfrist bis 24.06.2026.",
  "extrahierter_name": "Lars",
  "extrahierte_firma": "HERO Software Community",
  "extrahierte_telefon": null,
  "extrahierte_adresse": null,
  "extrahierte_plz": null,
  "fehlende_infos": [],
  "materialbedarf_erkannt": false,
  "empfohlene_aktion": "Ignorieren oder optional bewerbungsformular ausfüllen, falls Betrieb sich präsentieren möchte.",
  "extrahierter_termin": null
}
\`\`\``;

const cleanText = haikuPanne.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

try {
  JSON.parse(cleanText);
  console.log('Standard-Parse: ok (unerwartet!)');
} catch (e) {
  console.log(`Standard-Parse: FAILED (${e instanceof Error ? e.message : 'unknown'})`);
  try {
    const repaired = jsonrepair(cleanText);
    const parsed = JSON.parse(repaired);
    console.log(`\njsonrepair: ✓ erfolgreich repariert`);
    console.log(`zusammenfassung: ${parsed.zusammenfassung}`);
  } catch (rerr) {
    console.log(`\njsonrepair: AUCH FAILED (${rerr instanceof Error ? rerr.message : 'unknown'})`);
  }
}
