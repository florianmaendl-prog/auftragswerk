import { supabaseAdmin } from './supabase';
import { callClaude } from './claude';

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
  signatur: string | null;
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
- Schreibe NIE etwas was du nicht weißt (keine Preise, keine festen Termine, keine technischen Details die nicht aus der Anfrage hervorgehen).
- Du darfst Vorschläge wie "Aufmaßtermin", "Telefonat" oder "Fotos schicken" machen, wenn das aus den Beispielen oder dem Kontext sinnvoll ist.

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

${betrieb.mindestauftragswert ? `MINDESTAUFTRAGSWERT: ${betrieb.mindestauftragswert}€\n` : ''}

STIL-BEISPIELE (so antwortet dieser Betrieb typischerweise – Anrede, Begrüßung, Länge übernehmen. ABER: die Grußformel und den Namen am Ende NICHT übernehmen, das macht das System):

${tonBeispiele || '(Keine Beispiele vorhanden – nutze einen freundlichen, professionellen Standard-Stil mit Sie-Anrede.)'}

VERHALTEN JE NACH SITUATION:

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

function buildUserPrompt(anfrage: Anfrage, klassifikation: Klassifikation): string {
  return `KUNDENANFRAGE:

Von: ${anfrage.von_name || ''} <${anfrage.von_email}>
Betreff: ${anfrage.betreff}

${anfrage.body_text_clean || anfrage.body_text}

---

KLASSIFIKATION (intern, vorab erfolgt):
- Kategorie: ${klassifikation.kategorie}
- Passt zum Gewerk: ${klassifikation.gewerk_match || 'unbekannt'}
- Wert-Indikator: ${klassifikation.wert_indikator || 'unbekannt'}
- Kunde: ${klassifikation.kunde_typ || 'unbekannt'}
- Dringlichkeit: ${klassifikation.dringlichkeit || 'unbekannt'}
- Zusammenfassung: ${klassifikation.zusammenfassung || '-'}
- Fehlende Infos: ${(klassifikation.fehlende_infos || []).join(', ') || 'keine erkannt'}
- Empfohlene Aktion: ${klassifikation.empfohlene_aktion || '-'}

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
  betrieb: Betrieb
): Promise<EntwurfResult> {
  const systemPrompt = buildSystemPrompt(betrieb);
  const userMessage = buildUserPrompt(anfrage, klassifikation);

  const claudeRes = await callClaude({
    model: 'claude-sonnet-4-6',
    systemPrompt,
    userMessage,
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
    const cleaned = claudeRes.text.replace(/```json\s*|```\s*$/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
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