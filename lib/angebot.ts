/**
 * Angebots-Generator (Säule 2).
 *
 * Aus einer Kundenanfrage + Betriebs-Bausteine + Material-Preisliste baut
 * Claude einen Vorschlag für die Positionen. Owner setzt JEDEN Preis
 * selbst frei – KI darf keine verbindlichen Preise nennen (Iron Rule aus
 * Säule 1 gilt hier verschärft: ein automatisch verschicktes Angebot
 * wäre rechtlich ein Vertragsangebot, daher MUSS der Mensch jede
 * Position vor Versand bestätigen).
 *
 * KI liefert:
 *  - Titel-Vorschlag
 *  - Einleitungs-Text
 *  - Positions-Liste (Bezeichnung, Menge, Einheit, KI-Schätzpreis als
 *    Vorschlag, Beschreibung)
 *  - Schluss-Text (Gültigkeit, freundlicher Outro)
 *
 * Owner-UI zeigt KI-Schätzpreise als "Vorschlag" deutlich getrennt vom
 * "Mein Preis"-Feld, damit klar ist: KI rät, du entscheidest.
 */

import { callClaude } from './claude';
import { jsonrepair } from 'jsonrepair';

export type AngebotPosition = {
  pos: number;
  bezeichnung: string;
  beschreibung?: string;
  menge: number;
  einheit: string;
  einzelpreis_netto: number;
  gesamtpreis_netto: number;
  ki_schaetzpreis?: number; // nur Info, vom Owner zu überschreiben
  baustein_id?: string | null;
  /**
   * Eventualposition: fällt nur bei Bedarf an ("falls erforderlich",
   * "nach Befund"). Zählt NICHT in summe_netto/brutto, wird im Editor
   * + PDF separat als "nur bei Bedarf"-Summe ausgewiesen.
   * Fehlender/undefinierter Wert = false (Rückwärtskompat mit
   * Bestandsangeboten vor Sprint 1.1).
   */
  eventualposition?: boolean;
};

export type AngebotVorschlag = {
  titel: string;
  einleitung: string;
  positionen: AngebotPosition[];
  schlusstext: string;
};

type BausteinFuerKI = {
  id: string;
  bezeichnung: string;
  beschreibung: string | null;
  einheit: string;
  material_kosten: number;
  arbeitszeit_min: number;
  kalkulations_faktor: number;
};

type MaterialFuerKI = {
  bezeichnung: string;
  einheit: string;
  einkaufspreis: number;
};

type AnfrageFuerKI = {
  id: string;
  betreff: string | null;
  body_text: string | null;
  von_name: string | null;
};

type BetriebFuerKI = {
  id: string;
  name: string | null;
  branche: string | null;
  stundensatz: number | null;
};

const BERLIN_HEUTE = () => {
  return new Date().toISOString().slice(0, 10);
};

export async function generiereAngebotsVorschlag(opts: {
  anfrage: AnfrageFuerKI;
  betrieb: BetriebFuerKI;
  bausteine: BausteinFuerKI[];
  materialien: MaterialFuerKI[];
}): Promise<
  | { success: true; vorschlag: AngebotVorschlag }
  | { success: false; error: string }
> {
  const { anfrage, betrieb, bausteine, materialien } = opts;

  const bausteinListe =
    bausteine.length === 0
      ? '(noch keine Bausteine gepflegt – nutze realistische Schätzwerte)'
      : bausteine
          .slice(0, 80)
          .map(
            (b) =>
              `- ${b.bezeichnung} | pro ${b.einheit} | Material ca. ${Number(b.material_kosten).toFixed(2)}€ | ${b.arbeitszeit_min} min Arbeit | Faktor ${Number(b.kalkulations_faktor).toFixed(2)}${b.beschreibung ? ` | ${b.beschreibung}` : ''}`
          )
          .join('\n');

  const materialListe =
    materialien.length === 0
      ? '(keine Material-Preise gepflegt)'
      : materialien
          .slice(0, 80)
          .map(
            (m) =>
              `- ${m.bezeichnung} | ${Number(m.einkaufspreis).toFixed(2)}€ pro ${m.einheit}`
          )
          .join('\n');

  const stundensatz = betrieb.stundensatz
    ? `${Number(betrieb.stundensatz).toFixed(2)} € / Stunde`
    : '(nicht gepflegt – mit 75 € rechnen)';

  const systemPrompt = `Du bist Kalkulations-Assistent für einen ${betrieb.branche || 'Handwerks'}-Betrieb.

Aufgabe: aus der Kundenanfrage einen Angebots-VORSCHLAG bauen. Der Owner setzt jeden Preis selbst frei – du machst nur konkrete Vorschläge.

WICHTIG (Iron Rules):
- Schätze realistische Mengen + Einheiten aus der Anfrage
- Nutze die unten gepflegten Bausteine + Material-Preise wenn vorhanden
- Pro Position: bezeichnung, menge, einheit, einzelpreis_netto (dein Schätzwert)
- Stundensatz für Arbeitszeit-Anteile: ${stundensatz}
- KEINE Preise wie "auf Anfrage" oder "nach Aufwand" – immer eine konkrete Zahl als Vorschlag
- Wenn die Anfrage zu vage ist (z.B. nur "ich brauche ein Geländer"): nutze typische Maße/Mengen und kennzeichne in beschreibung "Annahme: 8m Länge, …"
- KEIN automatischer Versand – Owner bestätigt jede Position

VERFÜGBARE BAUSTEINE:
${bausteinListe}

MATERIAL-PREISLISTE:
${materialListe}

ANREDE-REGELN (streng einhalten):
- Sie-Form ist Default. Verwende IMMER Sie/Ihnen/Ihre in Einleitung und Schlusstext.
- Vorname NUR wenn erkennbar informeller Kontext (der Kunde hat sich in der Anfrage selbst per Vorname vorgestellt UND per Du geschrieben).
- Wenn Vorname passt, dann konsequent Du. NIEMALS Vorname mit Sie mischen ("Vielen Dank, Max!" gefolgt von "Ihre Anfrage" ist verboten).
- Wenn unsicher → Sie-Form.

TITEL-REGEL:
- Titel beschreibt AUSSCHLIESSLICH die Leistung ("Scharnier-Instandsetzung Sturmglastür", "Edelstahl-Geländer Terrasse").
- Titel enthält NIEMALS einen Kundennamen. Kein "– [Name]"-Anhang. Kein "für [Name]".

EINLEITUNG-REGEL:
- Beginne mit der Sache, nicht mit direkter Namens-Anrede ("Vielen Dank für Ihre Anfrage. Sie beschreiben ...").
- Die Anrede ("Sehr geehrte(r) ...") macht die Versand-Mail, nicht die Angebots-Einleitung selbst.

EVENTUALPOSITIONEN (wichtig für ehrliche Summen):
- Positionen die nur unter bestimmten Bedingungen anfallen ("falls erforderlich", "nach Befund", "sofern beschädigt", "bei Bedarf") markierst du mit "eventualposition": true.
- Sie werden NICHT in die Angebots-Endsumme gerechnet – dem Kunden gegenüber wird die Endsumme sonst unrealistisch hoch, weil "Kann-Positionen" mitgezählt werden.
- Bezeichnung sollte klar kennzeichnen ("Zusätzliche Verschraubung (bei Bedarf)", "Ersatz Z-Bar (falls Original nicht passt)").
- Alle Positionen die auf jeden Fall anfallen: "eventualposition": false ODER Feld weglassen.

OUTPUT-FORMAT: NUR valides JSON, keine Erklärungen, keine Markdown-Blöcke:

{
  "titel": "Kurzer Angebots-Titel, nur die Leistung (z.B. 'Edelstahl-Geländer Terrasse'), KEIN Kundenname",
  "einleitung": "1-3 freundliche Sätze in Sie-Form die das Angebot einleiten, Bezug zur Anfrage, KEINE Vornamens-Anrede",
  "positionen": [
    {
      "pos": 1,
      "bezeichnung": "Knappe Positions-Bezeichnung",
      "beschreibung": "Optional: Details, Maße, Annahmen",
      "menge": 1.0,
      "einheit": "Stk" | "m" | "m²" | "h" | "pauschal",
      "einzelpreis_netto": 250.00,
      "baustein_id": null,
      "eventualposition": false
    },
    {
      "pos": 2,
      "bezeichnung": "Zusätzliche Verschraubung (falls erforderlich)",
      "beschreibung": "Nur bei beschädigten Original-Bohrungen",
      "menge": 4,
      "einheit": "Stk",
      "einzelpreis_netto": 15.00,
      "baustein_id": null,
      "eventualposition": true
    }
  ],
  "schlusstext": "Hinweis Gültigkeit (z.B. 30 Tage), Aufmaß-Vorbehalt falls relevant, freundlicher Outro"
}

WICHTIG für Strings:
- in allen Text-Werten typografische Anführungszeichen „…" oder Apostrophe nutzen, NIE ASCII-Quotes – die brechen den JSON-String
- Beträge als Zahl, NICHT als String mit "€"`;

  const userMessage = `Anfrage vom ${BERLIN_HEUTE()}, Kunde: ${anfrage.von_name ?? '(Name unbekannt)'}

Betreff: ${anfrage.betreff ?? '(kein Betreff)'}

Nachricht:
${anfrage.body_text ?? '(keine Nachricht)'}

Erstelle den Angebots-Vorschlag.`;

  const result = await callClaude({
    model: 'claude-sonnet-4-6',
    systemPrompt,
    userMessage,
    maxTokens: 2000,
    temperature: 0.2,
    cacheSystemPrompt: false,
    zweck: 'angebotsentwurf',
    betriebId: betrieb.id,
    anfrageId: anfrage.id,
  });

  if (!result.success) {
    return { success: false, error: result.error || 'KI-Call fehlgeschlagen' };
  }

  const cleanText = result.text
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  let parsed: AngebotVorschlag;
  try {
    parsed = JSON.parse(cleanText);
  } catch {
    try {
      parsed = JSON.parse(jsonrepair(cleanText));
      console.warn(`Angebot-JSON via jsonrepair gerettet (anfrage=${anfrage.id})`);
    } catch (err) {
      return {
        success: false,
        error: `JSON-Parse-Fehler (auch nach Repair): ${err instanceof Error ? err.message : 'unbekannt'}`,
      };
    }
  }

  // Positionen normieren + KI-Schätzpreise + Gesamtpreise rechnen
  const positionen: AngebotPosition[] = (parsed.positionen ?? []).map(
    (p, i): AngebotPosition => {
      const menge = clampNum(p.menge, 1);
      const einzel = clampNum(p.einzelpreis_netto, 0);
      return {
        pos: i + 1,
        bezeichnung: String(p.bezeichnung ?? '').slice(0, 200),
        beschreibung: p.beschreibung ? String(p.beschreibung).slice(0, 1000) : undefined,
        menge,
        einheit: String(p.einheit ?? 'Stk').slice(0, 20),
        einzelpreis_netto: einzel,
        gesamtpreis_netto: round2(menge * einzel),
        ki_schaetzpreis: einzel,
        baustein_id: p.baustein_id ?? null,
        eventualposition: p.eventualposition === true,
      };
    }
  );

  return {
    success: true,
    vorschlag: {
      titel: String(parsed.titel ?? 'Angebot').slice(0, 200),
      einleitung: String(parsed.einleitung ?? '').slice(0, 2000),
      positionen,
      schlusstext: String(parsed.schlusstext ?? '').slice(0, 2000),
    },
  };
}

function clampNum(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Berechnet Netto- und Brutto-Summe aus einer Positions-Liste + MwSt-Satz.
 * Eventualpositionen fließen NICHT in summe_netto/brutto, sondern
 * werden separat als summe_eventual_netto zurückgegeben (für UI/PDF).
 */
export function berechneSummen(opts: {
  positionen: AngebotPosition[];
  mwst_satz: number;
}): {
  summe_netto: number;
  summe_brutto: number;
  summe_eventual_netto: number;
} {
  let netto = 0;
  let eventual = 0;
  for (const p of opts.positionen) {
    const posBetrag = p.gesamtpreis_netto ?? p.menge * p.einzelpreis_netto;
    if (p.eventualposition) {
      eventual += posBetrag;
    } else {
      netto += posBetrag;
    }
  }
  const brutto = netto * (1 + opts.mwst_satz / 100);
  return {
    summe_netto: round2(netto),
    summe_brutto: round2(brutto),
    summe_eventual_netto: round2(eventual),
  };
}
