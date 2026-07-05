/**
 * Klassifikation eingehender Anfragen via Claude Haiku
 */

import { jsonrepair } from 'jsonrepair';
import { callClaude } from '@/lib/claude';
import { supabaseAdmin } from '@/lib/supabase';

export interface Betrieb {
  id: string;
  name: string;
  branche: string | null;
  was_wir_machen: string[] | null;
  was_wir_nicht_machen: string[] | null;
  region: string | null;
  mindestauftragswert: number | null;
}

export interface Anfrage {
  id: string;
  von_email: string;
  von_name: string | null;
  betreff: string;
  body_text: string;
  body_text_clean: string | null;
}

export interface ExtrahierterTermin {
  datum_iso: string | null;
  ort: string | null;
  notiz: string | null;
}

export interface KlassifikationResult {
  kategorie: 'werbung' | 'innung_behoerde' | 'bestellung_versand' | 'rechnung' | 'kundenanfrage' | 'sonstiges';
  subkategorie: string | null;
  gewerk_match: 'passt' | 'passt_nicht' | 'unklar' | null;
  wert_indikator: 'gross' | 'mittel' | 'klein' | 'unklar' | null;
  kunde_typ: 'privat' | 'architekt' | 'bautraeger' | 'gewerbe' | 'lieferant' | 'unklar' | null;
  dringlichkeit: 'hoch' | 'mittel' | 'niedrig' | null;
  confidence: number;
  zusammenfassung: string;
  extrahierter_name: string | null;
  extrahierte_firma: string | null;
  extrahierte_telefon: string | null;
  extrahierte_adresse: string | null;
  extrahierte_plz: string | null;
  extrahierte_position: string | null;
  fehlende_infos: string[];
  materialbedarf_erkannt: boolean;
  empfohlene_aktion: string;
  extrahierter_termin: ExtrahierterTermin | null;
  /**
   * Eskalations-Signale erkannt? (Beschwerde, Anwalt, Mängelrüge,
   * Klage-Andeutung, Drohung). Wenn true → Pipeline skipped Auto-Entwurf,
   * Status manuell_pruefen mit Hinweis. STRATEGIE.md TEIL A1 Punkt 6.
   */
  eskalation_erkannt: boolean;
  eskalation_grund: string | null;
}

/**
 * Baut den System-Prompt branchen-agnostisch
 */
function buildSystemPrompt(betrieb: Betrieb): string {
  const branche = betrieb.branche || 'Handwerk';
  const wasWirMachen = (betrieb.was_wir_machen || []).join('\n- ') || 'nicht angegeben';
  const wasWirNicht = (betrieb.was_wir_nicht_machen || []).join('\n- ') || 'nicht angegeben';
  const region = betrieb.region || 'nicht angegeben';
  const mindestwert = betrieb.mindestauftragswert
    ? `${betrieb.mindestauftragswert} €`
    : 'kein Mindestwert definiert';

  const heuteIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  return `Du bist die digitale Sekretärin eines ${branche}-Betriebs. Deine Aufgabe: eingehende Mails klassifizieren und Informationen extrahieren.

HEUTIGES DATUM: ${heuteIso} (für Auflösung von relativen Termin-Aussagen)

BETRIEBSPROFIL:
Branche: ${branche}
Region: ${region}
Mindestauftragswert: ${mindestwert}

WIR MACHEN:
- ${wasWirMachen}

WIR MACHEN NICHT:
- ${wasWirNicht}

KLASSIFIKATION:
Ordne die Mail in eine dieser Kategorien ein:
- "werbung": Werbe-Mails, Newsletter, Marketing
- "innung_behoerde": Innung, Handwerkskammer, Behörden, Steuerberater
- "bestellung_versand": Versandbestätigungen, Bestellbestätigungen, AGB-Updates von Lieferanten
- "rechnung": Eingangsrechnungen, Mahnungen, Zahlungsbestätigungen
- "kundenanfrage": Echte Anfragen von potenziellen oder bestehenden Kunden
- "sonstiges": Was nicht passt (sehr sparsam nutzen)

Wenn "kundenanfrage", dann zusätzlich beurteilen:
- gewerk_match: passt die Anfrage zu unserem Leistungsspektrum? ("passt" / "passt_nicht" / "unklar")
- wert_indikator: geschätzter Auftragswert? ("gross" = >10000€, "mittel" = 2000-10000€, "klein" = <2000€, "unklar")
- kunde_typ: ("privat" / "architekt" / "bautraeger" / "gewerbe" / "lieferant" / "unklar")
- dringlichkeit: ("hoch" / "mittel" / "niedrig")

WICHTIG zum gewerk_match (häufiger Fehler vermeiden):

Die Liste "WIR MACHEN" oben ist BEISPIELHAFT und beschreibt Schwerpunkte – sie ist NICHT als abschließende, exklusive Aufzählung gemeint. Owner pflegen 5-10 typische Items, machen aber oft 50+ verschiedene Arbeiten in ihrem Branchen-Spektrum.

Nutze dein Branchen-Wissen:
- "Metallbau" umfasst ALLE Arbeiten an/mit Metall: Geländer, Tore, Vordächer, Treppen, Türen, Scharniere, Beschläge, Schweißarbeiten, Reparaturen, Befestigungen, Stahlbau, Edelstahl, Aluminium etc. Eine Türscharnier-Reparatur ist Metallbau, auch wenn nur "Geländer" in der Liste steht.
- "Maler" = Innen- und Außenanstrich, Tapezieren, Bodenbeschichtung, Lackieren, Renovierung. Auch wenn nur "Wohnungsanstrich" gelistet ist, gehört z.B. Fassadenarbeit dazu.
- "Sanitär" = Heizung, Klima, Wasser, Bad-Sanierung, Rohre, Armaturen. Etc.
- Analog für andere Gewerke: nutze dein Berufsbild-Wissen, nicht nur die wörtliche Liste.

REGEL: setze gewerk_match
- "passt": die Anfrage liegt klar im Branchen-Spektrum (auch wenn nicht 1:1 in der WIR-MACHEN-Liste)
- "unklar": die Anfrage könnte zum Betrieb passen, ist aber unsicher (Owner soll selbst entscheiden) – DEFAULT bei Zweifel
- "passt_nicht": NUR wenn die Anfrage klar in ein anderes Gewerk fällt (z.B. Elektrik-Anfrage an Maler, Holzarbeit an Metallbau, Bodenbelag an Heizungsbauer)
- Beachte WIR MACHEN NICHT: dort genannte explizite Ausschlüsse haben Vorrang vor dem Branchen-Default.

LIEBER "unklar" als "passt_nicht" – Owner entscheidet im Zweifel selbst. Eine vorschnelle Absage ist schlimmer als eine kurze Owner-Prüfung.

EXTRAKTION:
- Name des Absenders (Vorname + Nachname wenn erkennbar)
- Firma (wenn vorhanden)
- Telefonnummer (wenn in Mail/Signatur)
- Adresse (Straße + Hausnr)
- PLZ
- Position/Rolle des Absenders (wenn in Signatur/Mail erkennbar, z.B. "Geschäftsführer", "Architekt", "Bauleiter", "Hausverwaltung", "Einkauf"). Bei Privatkunden ohne Funktion: null.
- Fehlende Infos für ein Angebot (Liste, z.B. ["Maße", "Material", "Termin", "Budget"])
- materialbedarf_erkannt: erwähnt die Mail konkreten Materialbedarf? (true/false)
- extrahierter_termin: Wenn die Mail einen konkreten Aufmaß-/Vor-Ort-Termin
  BESTÄTIGT, VORSCHLÄGT oder ENTHÄLT (Beispiele: "Mo 10 Uhr passt mir",
  "am 26.05. um 14:00", "morgen Vormittag", "26.05.2026, 10:00"), extrahiere:
    { datum_iso: "YYYY-MM-DDTHH:MM:SS" (lokale Zeit, ohne TZ-Suffix,
      relative Aussagen auf den NÄCHSTEN passenden Tag nach Heute auflösen),
      ort: "<Ort/Adresse falls im Termin-Kontext genannt>" | null,
      notiz: "<sehr kurzer Hinweis was der Termin ist>" | null }
  Wenn unklar/kein Termin/zu vage: null.

ESKALATIONS-ERKENNUNG (haftungs- + reputations-kritisch):
Setze eskalation_erkannt=true wenn IRGENDEINES dieser Signale auftaucht:
- Anwalt erwähnt ("mein Anwalt", "RA Müller", "Rechtsanwalt", "Kanzlei")
- Mängelrüge mit Fristsetzung ("setze Ihnen eine Frist bis", "ich rüge hiermit")
- Klage-Andeutung ("werde ich Klage einreichen", "vor Gericht")
- Stark aggressiver Ton ("Ihre Unverschämtheit", "Frechheit", "Skandal", "Betrug")
- Drohung mit öffentlicher Beschwerde ("Google-Bewertung", "Innung informieren", "Presse")
- Hartnäckige Reklamation nach mehreren Mahnungen / Wiederholungs-Forderung mit Druck
- Schadensersatz-Forderung mit konkretem Betrag

eskalation_grund: 1 kurzer Satz mit dem konkreten Signal (z.B. "Kunde droht
mit Anwalt", "Mängelrüge mit Fristsetzung 14 Tage", "Aggressive Beschwerde
über Termin-Verschiebung").

In Zweifel LIEBER ESKALATION ERKENNEN. Lieber einmal zu vorsichtig flaggen
als einmal einen lockeren Entwurf gegen wütenden Kunden rausschicken.

WICHTIG: Normaler Unmut/Frust ist KEINE Eskalation. Erst wenn Druck,
Anwalt, Fristen, Drohungen ins Spiel kommen.

OUTPUT-FORMAT:
Antworte AUSSCHLIESSLICH mit gültigem JSON, keine Erklärungen, keine Markdown-Blöcke. Format:

{
  "kategorie": "...",
  "subkategorie": "...",
  "gewerk_match": "passt" | "passt_nicht" | "unklar" | null,
  "wert_indikator": "gross" | "mittel" | "klein" | "unklar" | null,
  "kunde_typ": "privat" | "architekt" | "bautraeger" | "gewerbe" | "lieferant" | "unklar" | null,
  "dringlichkeit": "hoch" | "mittel" | "niedrig" | null,
  "confidence": 0.95,
  "zusammenfassung": "Ein-Satz-Zusammenfassung des Anliegens",
  "extrahierter_name": "Vorname Nachname" | null,
  "extrahierte_firma": "..." | null,
  "extrahierte_telefon": "..." | null,
  "extrahierte_adresse": "..." | null,
  "extrahierte_plz": "..." | null,
  "extrahierte_position": "..." | null,
  "fehlende_infos": ["..."],
  "materialbedarf_erkannt": false,
  "empfohlene_aktion": "Was du als nächstes tun solltest (kurzer Satz in Du-Form, direkt an den Inhaber gerichtet, z.B. 'Ruf den Kunden an, um die fehlenden Maße zu klären' oder 'Prüf kurz, ob sich das für dich lohnt – liegt unter deinem Mindestauftragswert')",
  "extrahierter_termin": { "datum_iso": "2026-05-26T10:00:00", "ort": "...", "notiz": "..." } | null,
  "eskalation_erkannt": false,
  "eskalation_grund": null
}

WICHTIG:
- gewerk_match, wert_indikator, kunde_typ, dringlichkeit NUR bei kategorie="kundenanfrage", sonst null
- confidence zwischen 0.0 und 1.0
- Keine Floskeln, sei präzise und nüchtern
- Bei Werbung: zusammenfassung kurz halten ("Newsletter zu X", "Werbung für Y")
- JSON-STRING-REGEL: in allen Text-Werten (zusammenfassung, empfohlene_aktion etc.) für Zitate AUSSCHLIESSLICH die typografischen deutschen Anführungszeichen „..." oder Apostrophe verwenden – NIEMALS gerade ASCII-Quotes ", die brechen den JSON-String. Falls du wirklich eine ASCII-Quote brauchst: als \" escapen.`;
}

/**
 * Klassifiziert eine Anfrage und speichert das Ergebnis in 'analysen'
 */
export async function klassifiziereAnfrage(
  anfrage: Anfrage,
  betrieb: Betrieb
): Promise<{ success: boolean; klassifikation?: KlassifikationResult; error?: string }> {
  const systemPrompt = buildSystemPrompt(betrieb);

  // Für Claude bevorzugen wir Original-Text; nur wenn Mail riesig war → clean nehmen
  const mailText = anfrage.body_text_clean || anfrage.body_text;

  const userMessage = `Mail-Betreff: ${anfrage.betreff}
Mail-Absender: ${anfrage.von_name || ''} <${anfrage.von_email}>

Mail-Inhalt:
${mailText}`;

  const result = await callClaude({
    model: 'claude-haiku-4-5',
    systemPrompt,
    userMessage,
    maxTokens: 1024,
    temperature: 0,
    cacheSystemPrompt: true,
    zweck: 'klassifikation',
    betriebId: betrieb.id,
    anfrageId: anfrage.id,
  });

  if (!result.success) {
    await supabaseAdmin.from('processing_errors').insert({
      betrieb_id: betrieb.id,
      anfrage_id: anfrage.id,
      schritt: 'klassifikation',
      fehler_text: result.error || 'Unbekannter Fehler',
    });
    return { success: false, error: result.error };
  }

  // JSON parsen mit Fallback auf jsonrepair.
  // Haiku patzt manchmal bei deutschen Anführungszeichen in String-Werten
  // (z.B. "...Reihe „Von Hand" von HERO..." – das schließende " bricht den
  // JSON-String). jsonrepair fixt das automatisch, ohne erneuten KI-Call.
  let klassifikation: KlassifikationResult;
  // Falls Claude doch mal mit ```json wrappt, säubern
  const cleanText = result.text
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    klassifikation = JSON.parse(cleanText);
  } catch (firstErr) {
    try {
      // jsonrepair behebt: unescaped quotes, trailing commas, missing braces,
      // single quotes, fehlende quote-Pairs – alles typische LLM-Output-Pannen
      klassifikation = JSON.parse(jsonrepair(cleanText));
      console.warn(
        `Klassifikations-JSON via jsonrepair gerettet (anfrage=${anfrage.id})`
      );
    } catch (err: unknown) {
      const errorMsg = `JSON Parse Fehler (auch nach Repair): ${err instanceof Error ? err.message : 'unknown'}, ursprünglich: ${firstErr instanceof Error ? firstErr.message : 'unknown'}`;
      console.error(errorMsg, 'Response war:', result.text);

      await supabaseAdmin.from('processing_errors').insert({
        betrieb_id: betrieb.id,
        anfrage_id: anfrage.id,
        schritt: 'klassifikation',
        fehler_text: errorMsg,
        fehler_details: { claude_response: result.text },
      });

      return { success: false, error: errorMsg };
    }
  }

  // In 'analysen' speichern
  const { error: dbError } = await supabaseAdmin.from('analysen').insert({
    anfrage_id: anfrage.id,
    betrieb_id: betrieb.id,
    ai_run_id: result.ai_run_id,
    kategorie: klassifikation.kategorie,
    subkategorie: klassifikation.subkategorie,
    gewerk_match: klassifikation.gewerk_match,
    wert_indikator: klassifikation.wert_indikator,
    kunde_typ: klassifikation.kunde_typ,
    dringlichkeit: klassifikation.dringlichkeit,
    confidence: klassifikation.confidence,
    zusammenfassung: klassifikation.zusammenfassung,
    extrahierter_name: klassifikation.extrahierter_name,
    extrahierte_firma: klassifikation.extrahierte_firma,
    extrahierte_telefon: klassifikation.extrahierte_telefon,
    extrahierte_adresse: klassifikation.extrahierte_adresse,
    extrahierte_plz: klassifikation.extrahierte_plz,
    extrahierte_position: klassifikation.extrahierte_position ?? null,
    fehlende_infos: klassifikation.fehlende_infos,
    materialbedarf_erkannt: klassifikation.materialbedarf_erkannt,
    empfohlene_aktion: klassifikation.empfohlene_aktion,
    extrahierter_termin: klassifikation.extrahierter_termin ?? null,
    // Defensiv: bei alten Klassifikationen kann Haiku die Felder noch nicht
    // ausgeben → Default auf false. Migration setzt DEFAULT false ohnehin.
    eskalation_erkannt: klassifikation.eskalation_erkannt ?? false,
    eskalation_grund: klassifikation.eskalation_grund ?? null,
  });

  if (dbError) {
    console.error('DB Fehler beim Speichern der Analyse:', dbError);
    return { success: false, error: dbError.message };
  }

  // Status der Anfrage updaten
  await supabaseAdmin
    .from('anfragen')
    .update({ status: 'klassifiziert' })
    .eq('id', anfrage.id);

  return { success: true, klassifikation };
}