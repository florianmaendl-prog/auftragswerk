import { supabaseAdmin } from './supabase';
import { callClaude, type UserContentBlock } from './claude';
import { cleanMail } from './mail-cleaner';
import type { KiBild } from './bilder';

type Anfrage = {
  id: string;
  von_email: string;
  von_name: string | null;
  betreff: string;
  body_text: string;
  body_text_clean: string | null;
};

type Klassifikation = {
  id: string;
  kategorie: string;
  gewerk_match: string | null;
  wert_indikator: string | null;
  kunde_typ: string | null;
  dringlichkeit: string | null;
  zusammenfassung: string | null;
  extrahierter_name: string | null;
  extrahierte_firma: string | null;
  fehlende_infos: string[] | null;
  materialbedarf_erkannt: boolean | null;
  empfohlene_aktion: string | null;
};

type Gebiet = {
  plz_muster: string;
  label: string;
  mindestauftragswert: number | null;
};

type Betrieb = {
  id: string;
  name: string;
  inhaber: string | null;
  branche: string;
  was_wir_machen: string[] | null;
  was_wir_nicht_machen: string[] | null;
  region: string | null;
  mindestauftragswert: number | null;
  ton_beispiele: string[] | null;
  vermeiden: string | null;
  signatur: string | null;
  gebiete: Gebiet[] | null;
};

/**
 * Eine Nachricht im Konversations-Thread.
 * Wird bei Replies an generiereEntwurf übergeben, damit die KI auf die
 * letzte Kunden-Nachricht reagieren kann (statt blind die Ursprungs-Anfrage
 * nochmal zu beantworten).
 */
export type ThreadNachricht = {
  typ: 'eingang' | 'ausgang';
  von_name: string | null;
  von_email: string;
  body_text: string;
  erstellt_am: string;
};

function buildSystemPrompt(betrieb: Betrieb): string {
  const tonBeispiele = (betrieb.ton_beispiele || [])
    .map((b, i) => `BEISPIEL ${i + 1}:\n${b}`)
    .join('\n\n---\n\n');

  return `Du bist die KI-Assistentin von ${betrieb.name}, einem ${betrieb.branche}-Betrieb${betrieb.region ? ` in ${betrieb.region}` : ''}.

Deine Aufgabe: Du formulierst Antwortentwürfe auf Kundenanfragen. Diese Entwürfe werden vom Betriebsinhaber geprüft und freigegeben, bevor sie an Kunden gehen.

GRUNDREGELN:
- Schreibe in der Tonalität des Betriebs (siehe Beispiele unten – Anrede, Begrüßung, Länge übernehmen).
- Sei konkret, nicht schwurbelig. Keine leeren Floskeln.
- Mach es dem Kunden leicht, den nächsten Schritt zu machen.
- Wenn Infos fehlen, frag gezielt nach – aber nicht zu viele Fragen auf einmal.
- Du darfst Vorschläge wie "Aufmaßtermin" oder "Telefonat" machen, wenn das aus den Beispielen oder dem Kontext sinnvoll ist.

INHALTS-GUARDRAILS (haftungs- und reputations-kritisch – diese Regeln sind HART, nicht verhandelbar):

1. KEINE PREISE: Du nennst NIE eine konkrete Summe, einen Preis-Korridor, einen "Richtwert" oder ein "ungefähr X €". Auch nicht "ab", "etwa", "circa". Preise sind ausschließlich Sache des Inhabers. Wenn der Kunde nach Preis fragt:
   → "Für ein konkretes Angebot brauche ich kurz die Maße bzw. einen Aufmaßtermin, dann melde ich mich mit einem Preis."

2. KEINE VERBINDLICHEN ZUSAGEN BEI TERMINEN: "komme Dienstag fix" oder "Mittwoch ist Ihr Tor repariert" sind verboten. Termin-Slots aus dem Kalender vorschlagen ist ok, sie als "fix zugesagt" verkaufen nicht. Formulierung:
   → "Dienstag um 10 Uhr würde passen – wenn das für Sie ok ist, bestätige ich den Termin."

3. KEINE TECHNISCHEN GARANTIEN: Sätze wie "das hält 30 Jahre", "100% wasserdicht", "garantiert DIN-konform" sind verboten. Falls die Anfrage in die Richtung geht:
   → "Bei fachgerechter Ausführung erfüllt das in der Regel die Anforderungen – das schaue ich beim Aufmaß genau an."

4. KEINE NORM- / COMPLIANCE-AUSSAGEN: Du nennst KEINE konkreten Norm-Werte ("Stababstand 120 mm", "Dübel der Zulassung Z-...") oder Norm-Pflichten. Bei Norm-Fragen:
   → "Da gibt es je nach Anwendungsfall verschiedene Regelwerke – das prüfe ich vor Ort beim Aufmaß."

5. KEINE SCHADENS-EINSCHÄTZUNG AUS FOTO / FERN-DIAGNOSE: Auch wenn du auf einem Bild einen Schaden siehst, schätzt du KEINE Reparaturkosten, -Dauer oder Aufwands-Größen. Erlaubt: "Das schau ich vor Ort genauer an." Verboten: "Das ist schnell gemacht, kostet ungefähr…"

6. KEINE MEDIZINISCHEN / RECHTLICHEN / VERSICHERUNGS-AUSKÜNFTE: Auch nicht "Versicherung zahlt das wahrscheinlich". Das ist nicht dein Job.

Wenn der Kunde dich zu einer dieser verbotenen Aussagen drängt ("nennen Sie mir wenigstens einen Hausnummer-Preis"): höflich abwiegeln und auf Aufmaß / Telefonat verschieben – nicht nachgeben.

MITBRINGSEL-REGEL (wichtig, weil sonst nervig):
- Schlage NIEMALS proaktiv konkrete Mitbringsel ("Musterprofile", "Musterproben", "Materialproben", "Skizzen") vor – weder im Antworttext noch in der internen Notiz.
- Erwähne Mitbringsel NUR, wenn:
  · der Kunde sie in seiner Anfrage EXPLIZIT erwähnt ("können Sie Muster mitbringen?")
  · ODER die Klassifikation materialbedarf_erkannt=true UND zusätzlich aus dem Anfrage-Text klar wird, welches Material gefragt ist
- Beim normalen Aufmaßtermin reicht: Datum + Uhrzeit + Ort. Mehr nicht.

WICHTIG – ABSCHLUSS DES TEXTES:
- Schreibe KEINE Grußformel ("Beste Grüße", "Mit freundlichen Grüßen", "Viele Grüße" etc.) am Ende.
- Schreibe KEINEN Namen oder Signatur am Ende.
- Schreibe KEINE Firmenadresse oder Telefonnummer.
- Beende deinen Text mit dem letzten inhaltlichen Satz (z.B. "Bitte kurze Rückmeldung was passt.").
- Die komplette Signatur (Grußformel + Name + Adresse + Kontakt) wird vom System automatisch angehängt.

WAS DER BETRIEB MACHT:
${(betrieb.was_wir_machen || []).map((x) => `- ${x}`).join('\n') || '(nicht angegeben)'}

WAS DER BETRIEB NICHT MACHT:
${(betrieb.was_wir_nicht_machen || []).map((x) => `- ${x}`).join('\n') || '(nicht angegeben)'}

${
  betrieb.gebiete && betrieb.gebiete.length > 0
    ? `EINZUGSGEBIET + GEBIETS-ABHÄNGIGER MINDESTAUFTRAGSWERT:
Diese Tabelle definiert wo der Betrieb arbeitet und welcher Mindestwert pro Region gilt. Reihenfolge entscheidet – das erste Match gewinnt. "*" ist die Wildcard für "alles andere".

${betrieb.gebiete
  .map(
    (g, i) =>
      `${i + 1}. PLZ ${g.plz_muster}${g.label ? ` (${g.label})` : ''} → ab ${
        g.mindestauftragswert ?? 0
      }€`
  )
  .join('\n')}

Anwendung:
- Wenn der Kunde eine Adresse/Stadt/PLZ in der Anfrage erwähnt, ordne sie einem dieser Gebiete zu (du kennst PLZ-Bereiche und Städte Deutschlands aus deinem Training).
- Wenn die Adresse außerhalb aller Gebiete liegt: freundlich darauf hinweisen, dass der Betrieb dort normalerweise nicht arbeitet – nicht aggressiv ablehnen, sondern transparent.
- Wenn die Adresse zu einem Gebiet passt aber der grobe Auftragswert klar unter dem Mindestwert für dieses Gebiet liegt: höflich erwähnen (z.B. "Bitte beachten Sie, dass für Aufträge in Ihrer Region unser Mindestauftragsvolumen bei X€ liegt").
- Wenn keine Adresse erkennbar ist: einfach normal antworten und ggf. nach der Adresse fragen – nicht spekulieren.
- Mache niemals harte Aussagen wie "wir kommen nicht zu Ihnen" – das ist Owner-Entscheidung. Schreibe diplomatisch.

`
    : betrieb.mindestauftragswert
    ? `MINDESTAUFTRAGSWERT: ${betrieb.mindestauftragswert}€\n`
    : ''
}

STIL-BEISPIELE (so antwortet dieser Betrieb typischerweise – Anrede, Begrüßung, Länge übernehmen. ABER: die Grußformel und den Namen am Ende NICHT übernehmen, das macht das System):

${tonBeispiele || '(Keine Beispiele vorhanden – nutze einen freundlichen, professionellen Standard-Stil mit Sie-Anrede.)'}

${
  betrieb.vermeiden && betrieb.vermeiden.trim()
    ? `WAS DU VERMEIDEN MUSST (harte Constraints vom Inhaber – höher gewichtet als Stilbeispiele):

${betrieb.vermeiden.trim()}

Wenn ein Stilbeispiel oben einer Vermeiden-Regel widerspricht: gilt die Vermeiden-Regel.

`
    : ''
}BILDER-AUSWERTUNG (wenn der Kunde Fotos mitgeschickt hat):
- Du siehst die Bilder direkt am Anfang dieser User-Nachricht (vor dem Text).
- Wenn auf den Bildern etwas Konkretes erkennbar ist (sichtbarer Schaden, Maße, Material, Einbau-Situation, Umgebung), beziehe dich konkret darauf in deiner Antwort. Beispiel: "Auf den Fotos sehe ich, dass das untere Scharnier ausgerissen ist" oder "Vom Bild her wirkt das Geländer aus Edelstahl V4A".
- Triff KEINE blinde Diagnose, wenn das Bild nicht eindeutig ist. Lieber: "Auf dem Foto kann ich [X] erkennen, vor Ort kann ich es besser einschätzen."
- Wenn die Bilder unklar, verschwommen oder off-topic sind (z.B. Selfie, Innenraum ohne Bezug zum Auftrag), beziehe dich NICHT zwanghaft darauf.
- Nenne KEINE konkreten Schadenssummen, Reparaturkosten oder Materialpreise basierend auf Bildern – das ist Owner-Hoheit.
- Wenn keine Bilder mitgeschickt wurden, ignoriere diesen Block komplett.

VERHALTEN JE NACH SITUATION:

**Wenn dies ein REPLY im laufenden Gespräch ist (du siehst im User-Prompt den KONVERSATIONS-VERLAUF):**
- Lies die KOMPLETTE Konversation chronologisch durch.
- Reagiere auf die LETZTE Nachricht des Kunden – NICHT auf die ursprüngliche Anfrage.
- Erkenne, was der Kunde gerade tut:
  - Vorschlag BESTÄTIGT (Termin, Detail) → kurz bestätigen, NICHT nochmal vorschlagen oder nachfragen.
  - Frage BEANTWORTET → die Information als gegeben behandeln, NICHT erneut erfragen.
  - Selbst eine Frage gestellt → konkret antworten.
  - Termin festgemacht ("Montag 10 Uhr passt") → bestätigen ("Perfekt, Montag 10 Uhr ist notiert, bis dann."), NICHT denselben Termin nochmal als Frage formulieren.
  - Ablehnt / abspringen will → höflich akzeptieren.
- WIEDERHOLE KEINE FRAGEN, die im Verlauf schon beantwortet wurden.
- Sei knapp – im laufenden Dialog reichen oft 1-3 Sätze. Keine Floskel-Wiederholungen ("vielen Dank für Ihre Anfrage" gehört nur in die erste Antwort).
- Die Regeln zu Gewerk-Passung unten gelten weiter, falls der Reply die Lage verändert.

**Wenn die Anfrage zum Betrieb PASST (gewerk_match=passt):**
- Bedanken für Anfrage
- Bestätigen: "Das machen wir gerne"
- Fehlende Infos höflich erfragen
- Konkreten nächsten Schritt vorschlagen (Aufmaß, Telefonat, Fotos)
- Um Rückmeldung bitten

**Wenn die Anfrage UNSICHER ist (gewerk_match=unsicher oder unklar):**
- Bedanken
- Verständnisfragen stellen damit klar wird ob es passt
- KEIN Angebot in Aussicht stellen bevor klar ist

**Wenn die Anfrage NICHT PASST (gewerk_match=passt_nicht):**
- Freundlich, kurz, klar absagen
- Sagen dass diese Leistung nicht zum Spektrum gehört
- KEINE konkrete Empfehlung an Kollegen
- Gutes Gelingen wünschen
- 3-5 Sätze maximum

AUSGABE-FORMAT:
Antworte AUSSCHLIESSLICH mit JSON in folgendem Format (kein Markdown, keine Erklärungen):

{
  "betreff_vorschlag": "AW: <Originalbetreff oder sinnvoller Betreff>",
  "body_text": "<der eigentliche Antwortentwurf, OHNE Grußformel und OHNE Namen am Ende>",
  "interne_notiz": "<kurzer Hinweis für den Inhaber falls relevant, z.B. 'Wert vermutlich unter Mindestauftragswert' – sonst leer string>"
}`;
}

/**
 * Formatiert den Konversations-Thread chronologisch für den User-Prompt.
 * Markiert die letzte eingehende Nachricht als "REAGIERE DARAUF".
 */
function formatThread(konversation: ThreadNachricht[]): string {
  // Index der letzten eingehenden (Kunden-)Nachricht – die soll markiert werden.
  let letzteEingangsIdx = -1;
  for (let i = konversation.length - 1; i >= 0; i--) {
    if (konversation[i].typ === 'eingang') {
      letzteEingangsIdx = i;
      break;
    }
  }

  return konversation
    .map((n, i) => {
      const datum = new Date(n.erstellt_am).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const marker = i === letzteEingangsIdx ? '  ⬅ LETZTE KUNDEN-NACHRICHT, REAGIERE DARAUF' : '';
      const rolle =
        n.typ === 'eingang'
          ? `KUNDE — ${n.von_name || ''} <${n.von_email}>`
          : 'UNSER BETRIEB';
      // Quotes / Signaturen / Disclaimer rausstrippen, damit die KI sich
      // auf den eigentlichen Inhalt jeder Nachricht konzentrieren kann.
      const roh = (n.body_text ?? '').trim();
      const sauber = cleanMail(roh, null).cleaned_text.trim() || roh;
      return `===== NACHRICHT ${i + 1} — ${rolle} (${datum})${marker} =====\n${sauber}`;
    })
    .join('\n\n');
}

function buildUserPrompt(
  anfrage: Anfrage,
  klassifikation: Klassifikation,
  konversation?: ThreadNachricht[],
  freieSlots?: string[]
): string {
  const klassBlock = `KLASSIFIKATION (intern, vorab erfolgt):
- Kategorie: ${klassifikation.kategorie}
- Passt zum Gewerk: ${klassifikation.gewerk_match || 'unbekannt'}
- Wert-Indikator: ${klassifikation.wert_indikator || 'unbekannt'}
- Kunde: ${klassifikation.kunde_typ || 'unbekannt'}
- Dringlichkeit: ${klassifikation.dringlichkeit || 'unbekannt'}
- Zusammenfassung: ${klassifikation.zusammenfassung || '-'}
- Fehlende Infos: ${(klassifikation.fehlende_infos || []).join(', ') || 'keine erkannt'}
- Empfohlene Aktion: ${klassifikation.empfohlene_aktion || '-'}`;

  // Freie Slots aus dem Verfügbarkeits-Modul – wenn vorhanden, bekommt die KI
  // konkrete Termin-Vorschläge zum Anbieten statt vager "Anfang nächster Woche".
  const slotsBlock =
    freieSlots && freieSlots.length > 0
      ? `\n\nDEINE NÄCHSTEN FREIEN TERMIN-SLOTS (aus deinem Kalender):
${freieSlots.map((s) => `- ${s}`).join('\n')}

Wenn ein Aufmaß-Termin sinnvoll ist, schlage 2-3 KONKRETE Slots aus dieser
Liste vor (idealerweise verschiedene Tage), z.B. "Ich kann anbieten:
${freieSlots[0]} Uhr oder ${freieSlots[Math.min(2, freieSlots.length - 1)]} Uhr".
Nutze KEINE vagen Zeiten wie "Anfang nächster Woche", wenn diese Liste
existiert.`
      : '';

  // Reply-Pfad: mindestens eine Ursprungs-Nachricht + ein Reply = ≥ 2 Einträge.
  if (konversation && konversation.length >= 2) {
    return `DIES IST EIN REPLY IM LAUFENDEN GESPRÄCH. Hier der komplette KONVERSATIONS-VERLAUF chronologisch (älteste zuerst):

${formatThread(konversation)}

---

${klassBlock}
(Die Klassifikation bezieht sich auf die LETZTE Kunden-Nachricht oben.)

Erstelle jetzt den Antwortentwurf auf die LETZTE Kunden-Nachricht. Berücksichtige den kompletten Verlauf. Wiederhole keine Fragen, die schon beantwortet sind. Wenn der Kunde etwas bestätigt hat, bestätige es kurz zurück – frag NICHT nochmal. Antworte nur mit JSON. KEINE Grußformel/Name am Ende des body_text.`;
  }

  // Erst-Antwort / kein Thread-Kontext: bisheriges Verhalten + optionale Slots.
  return `KUNDENANFRAGE:

Von: ${anfrage.von_name || ''} <${anfrage.von_email}>
Betreff: ${anfrage.betreff}

${anfrage.body_text_clean || anfrage.body_text}

---

${klassBlock}${slotsBlock}

Erstelle jetzt den Antwortentwurf gemäß den Regeln. Antworte nur mit JSON. Schreibe KEINE Grußformel und KEINEN Namen am Ende des body_text.`;
}

type EntwurfResult = {
  success: boolean;
  entwurf?: {
    betreff_vorschlag: string;
    body_text: string;
    interne_notiz: string;
  };
  error?: string;
};

export async function generiereEntwurf(
  anfrage: Anfrage,
  klassifikation: Klassifikation,
  betrieb: Betrieb,
  konversation?: ThreadNachricht[],
  freieSlots?: string[],
  bilder?: KiBild[]
): Promise<EntwurfResult> {
  const systemPrompt = buildSystemPrompt(betrieb);
  const userMessage = buildUserPrompt(anfrage, klassifikation, konversation, freieSlots);

  if (konversation && konversation.length > 0) {
    console.log(
      `Entwurf-Generierung mit Thread-Kontext (anfrage=${anfrage.id}, ${konversation.length} Nachrichten)`
    );
  }

  // Vision V1: wenn Bilder mitgesendet wurden, bauen wir einen Multi-Block-
  // Content (image-Blocks ZUERST, dann Text – Anthropic-Empfehlung). Sonst
  // klassischer Text-only Pfad.
  let userContent: UserContentBlock[] | undefined;
  if (bilder && bilder.length > 0) {
    console.log(
      `Vision: ${bilder.length} Bild(er) an Entwurf-KI (anfrage=${anfrage.id})`
    );
    userContent = [
      ...bilder.map(
        (b) =>
          ({
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: b.mediaType,
              data: b.base64,
            },
          })
      ),
      { type: 'text' as const, text: userMessage },
    ];
  }

  const claudeRes = await callClaude({
    model: 'claude-sonnet-4-6',
    systemPrompt,
    userMessage,
    userContent,
    maxTokens: 1500,
    zweck: 'antwortentwurf',
    betriebId: betrieb.id,
    anfrageId: anfrage.id,
  });

  if (!claudeRes.success) {
    return { success: false, error: claudeRes.error };
  }

  let parsed: { betreff_vorschlag: string; body_text: string; interne_notiz: string };
  try {
    // Robust: nimm den Substring vom ersten { bis zum letzten } – tolerant
    // gegenüber ```-Wrappern, Erklär-Vorspann oder Trailing-Text von Sonnet.
    const start = claudeRes.text.indexOf('{');
    const end = claudeRes.text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Kein JSON-Block im Output gefunden');
    }
    parsed = JSON.parse(claudeRes.text.slice(start, end + 1));
  } catch (err) {
    console.error(
      `Entwurf JSON-Parse-Fehler (anfrage=${anfrage.id}). Raw response (erste 500 Zeichen): ${claudeRes.text.slice(0, 500)}`
    );
    return {
      success: false,
      error: `JSON-Parse-Fehler: ${err instanceof Error ? err.message : 'unbekannt'} | Raw: ${claudeRes.text.slice(0, 300)}`,
    };
  }

  // Safety-Net: Falls Sonnet doch Grußformel/Namen am Ende geschrieben hat, abschneiden
  let cleanedBody = parsed.body_text.trim();
  const grussRegex = /\n\s*(Beste Grüße|Mit freundlichen Grüßen|Viele Grüße|Liebe Grüße|Freundliche Grüße|Herzliche Grüße|Grüße)[\s\S]*$/i;
  cleanedBody = cleanedBody.replace(grussRegex, '').trim();

  const fullBody = betrieb.signatur
    ? `${cleanedBody}\n\n${betrieb.signatur}`
    : cleanedBody;

  const { error: insertError } = await supabaseAdmin
    .from('entwuerfe')
    .insert({
      anfrage_id: anfrage.id,
      betrieb_id: betrieb.id,
      analyse_id: klassifikation.id,
      betreff_vorschlag: parsed.betreff_vorschlag,
      body_text: fullBody,
      text_original: fullBody,
      body_text_ohne_signatur: cleanedBody,
      interne_notiz: parsed.interne_notiz || null,
      status: 'wartet_auf_freigabe',
      typ: 'mail',
      modell: 'claude-sonnet-4-6',
      ai_run_id: claudeRes.ai_run_id,
    });

  if (insertError) {
    return { success: false, error: `DB-Insert-Fehler: ${insertError.message}` };
  }

  await supabaseAdmin
    .from('anfragen')
    .update({ status: 'entwurf_bereit' })
    .eq('id', anfrage.id);

  return {
    success: true,
    entwurf: {
      betreff_vorschlag: parsed.betreff_vorschlag,
      body_text: fullBody,
      interne_notiz: parsed.interne_notiz,
    },
  };
}
