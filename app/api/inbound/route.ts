import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cleanMail } from '@/lib/mail-cleaner';
import { klassifiziereAnfrage } from '@/lib/klassifikation';
import { generiereEntwurf, type ThreadNachricht } from '@/lib/entwurf';
import { ladeBilderFuerKI } from '@/lib/bilder';
import { speichereAnhang, verlinkeAnhang, type AnhangInput } from '@/lib/anhaenge';
import { getFreieSlots } from '@/lib/verfuegbarkeit';

const CLEAN_THRESHOLD = 3000;

export const maxDuration = 60;

/**
 * Basic-Auth-Check für den Postmark Inbound-Webhook.
 * Postmark trägt die Credentials in der Webhook-URL ein
 * (https://user:pass@auftragswerk.app/api/inbound).
 * Fail-closed: ohne konfigurierte Credentials wird JEDER Request abgelehnt.
 */
function istAutorisiert(req: NextRequest): boolean {
  const user = process.env.INBOUND_WEBHOOK_USER;
  const pass = process.env.INBOUND_WEBHOOK_PASS;

  if (!user || !pass) {
    console.error(
      'INBOUND_WEBHOOK_USER/PASS nicht gesetzt – Webhook lehnt alle Requests ab'
    );
    return false;
  }

  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Basic ')) return false;

  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const trenn = decoded.indexOf(':');
  if (trenn === -1) return false;

  return decoded.slice(0, trenn) === user && decoded.slice(trenn + 1) === pass;
}

/**
 * Shape, in der Postmark Anhänge im Webhook-Payload liefert.
 * Bei uns kommt die Payload mittlerweile durch den Supabase-Edge-Proxy
 * (supabase/functions/inbound-proxy): der lädt große Anhänge schon in
 * Storage hoch, ersetzt Content (base64) durch _storage_path und macht
 * die Payload klein genug fürs Vercel-4.5MB-Limit.
 *
 * Content ist also OPTIONAL – wenn nicht da, ist _storage_path da.
 */
type PostmarkAttachment = {
  Name: string;
  Content?: string;          // base64; fehlt wenn Proxy schon hochgeladen hat
  ContentType: string;
  ContentLength: number;
  _storage_path?: string;    // vom Edge-Proxy gesetzt bei Erfolg
  _upload_failed?: boolean;  // vom Edge-Proxy gesetzt wenn Storage-Upload failte
  _upload_error?: string;
};

export async function POST(req: NextRequest) {
  if (!istAutorisiert(req)) {
    console.warn('⛔ Inbound-Webhook: nicht autorisierter Request abgelehnt');
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  console.log('DEBUG: Webhook v9 (Threading + Entwurf immer bei Kundenanfragen)');
  try {
    const payload = await req.json();

    const vonEmail = payload.FromFull?.Email || payload.From || 'unbekannt@example.com';
    const vonName = payload.FromFull?.Name || '';
    const betreff = payload.Subject || '(kein Betreff)';
    const bodyText = payload.TextBody || '';
    const bodyHtml = payload.HtmlBody || '';

    // CRITICAL: bei Forward-Mails (Owner forwarded info@firma.de →
    // <slug>@kunden.auftragswerk.app) setzt Postmark `To` auf den
    // ORIGINAL-Empfänger der Mail (info@firma.de), nicht auf die
    // Forward-Adresse. Wir brauchen aber die Forward-Adresse damit der
    // Betriebs-Lookup matcht. Postmark stellt das in `OriginalRecipient`
    // bereit. Reihenfolge: OriginalRecipient > ToFull > To.
    const toEmail =
      payload.OriginalRecipient ||
      payload.ToFull?.[0]?.Email ||
      payload.To ||
      '';

    // Mail-Header für Threading extrahieren
    const headers = Array.isArray(payload.Headers) ? payload.Headers : [];
    const getHeader = (name: string): string | null => {
      const h = headers.find(
        (h: { Name?: string }) => h.Name?.toLowerCase() === name.toLowerCase()
      );
      return h?.Value || null;
    };

    const messageId = payload.MessageID
      ? `<${payload.MessageID}@inbound.postmarkapp.com>`
      : getHeader('Message-ID');
    const inReplyTo = getHeader('In-Reply-To');
    const referencesHeader = getHeader('References');

    // Idempotenz: Postmark retried Webhooks bei Timeout (langer Claude-Call).
    // Wenn wir die message_id schon kennen, war der Webhook schon erfolgreich –
    // 200 zurückgeben, damit Postmark sich beruhigt, ohne erneut zu klassifizieren.
    if (messageId) {
      const { data: dupNachricht } = await supabaseAdmin
        .from('nachrichten')
        .select('id, anfrage_id')
        .eq('message_id', messageId)
        .maybeSingle();

      if (dupNachricht) {
        console.log(
          `↺ Duplikat erkannt (messageId=${messageId}, anfrage=${dupNachricht.anfrage_id}) – Skip`
        );
        return NextResponse.json({
          success: true,
          duplicate: true,
          anfrage_id: dupNachricht.anfrage_id,
        });
      }
    }

    // Sammle ALLE möglichen Threading-IDs (References + In-Reply-To).
    // Postmark transformiert beim Versand die Message-ID auf @mtasv.net,
    // aber die Original-ID landet meist auch in References.
    const threadingIds = new Set<string>();
    if (inReplyTo) threadingIds.add(inReplyTo);
    if (referencesHeader) {
      const matches = referencesHeader.match(/<[^>]+>/g);
      if (matches) matches.forEach((id) => threadingIds.add(id));
    }

    // Betrieb finden
    const { data: betrieb } = await supabaseAdmin
      .from('betriebe')
      .select(
        'id, name, inhaber, branche, was_wir_machen, was_wir_nicht_machen, region, mindestauftragswert, ton_beispiele, vermeiden, signatur, inbound_email, gebiete'
      )
      .eq('inbound_email', toEmail)
      .single();

    if (!betrieb) {
      console.warn('Kein Betrieb für inbound_email gefunden:', toEmail);
      return NextResponse.json(
        { error: 'Kein Betrieb für diese Adresse konfiguriert' },
        { status: 404 }
      );
    }

    // Reply-Erkennung über alle gesammelten Threading-IDs.
    // Match auf message_id ODER in_reply_to (tiefe Konversations-Threads).
    let existierendeAnfrageId: string | null = null;
    if (threadingIds.size > 0) {
      const idsArray = Array.from(threadingIds);
      const quotedIds = idsArray.map((id) => `"${id}"`).join(',');

      const { data: vorgaengerNachricht } = await supabaseAdmin
        .from('nachrichten')
        .select('anfrage_id, message_id, in_reply_to')
        .eq('betrieb_id', betrieb.id)
        .or(`message_id.in.(${quotedIds}),in_reply_to.in.(${quotedIds})`)
        .order('erstellt_am', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (vorgaengerNachricht) {
        existierendeAnfrageId = vorgaengerNachricht.anfrage_id;
        console.log(
          `↩ Reply erkannt für Anfrage ${existierendeAnfrageId} (matched via ${idsArray.length} threading-IDs)`
        );
      } else {
        console.log(
          `⚠ Keine Vorgänger-Anfrage gefunden für threading-IDs: ${idsArray.join(', ')}`
        );
      }
    }

    // Cleaner nur bei riesigen Mails
    let bodyTextClean: string | null = null;
    let cleanerMeta: Record<string, unknown> | null = null;

    if (bodyText.length > CLEAN_THRESHOLD) {
      const cleaned = cleanMail(bodyText, bodyHtml);
      bodyTextClean = cleaned.cleaned_text;
      cleanerMeta = {
        original_length: cleaned.original_length,
        cleaned_length: cleaned.cleaned_length,
        reduction_percent: cleaned.reduction_percent,
        has_quoted_content: cleaned.has_quoted_content,
        has_signature: cleaned.has_signature,
        detected_language: cleaned.detected_language,
        reason: 'mail_too_large_for_claude',
      };
    }

    let anfrageId: string;
    let istReply = false;

    // Pre-Check: ist der Sender gesperrt? Wenn ja → direkt als
    // aussortiert anlegen, kein KI-Call (spart Anthropic-Kosten). Lookup
    // case-insensitive damit MAX@FIRMA.COM und max@firma.com identisch sind.
    const { data: gesperrt } = await supabaseAdmin
      .from('gesperrte_sender')
      .select('id')
      .eq('betrieb_id', betrieb.id)
      .ilike('email', vonEmail)
      .maybeSingle();
    const senderGesperrt = !!gesperrt;
    if (senderGesperrt) {
      console.log(`🚫 Sender gesperrt: ${vonEmail} – aussortieren ohne KI-Call`);
    }

    if (existierendeAnfrageId) {
      anfrageId = existierendeAnfrageId;
      istReply = true;

      // Bei Reply von gesperrtem Sender bleibt die Anfrage aussortiert –
      // der Owner hat die explizit weggemacht, das soll auch beim Re-Reply
      // greifen.
      await supabaseAdmin
        .from('anfragen')
        .update({
          status: senderGesperrt ? 'aussortiert' : 'reply_eingegangen',
        })
        .eq('id', anfrageId);

      console.log(`↩ Reply wird an Anfrage ${anfrageId} angehängt`);
    } else {
      const { data: anfrage, error: insertError } = await supabaseAdmin
        .from('anfragen')
        .insert({
          betrieb_id: betrieb.id,
          kanal: 'mail',
          von_email: vonEmail,
          von_name: vonName,
          betreff: betreff,
          body_text: bodyText,
          body_text_clean: bodyTextClean,
          body_html: bodyHtml,
          raw_payload: cleanerMeta ? { ...payload, _cleaner_meta: cleanerMeta } : payload,
          status: senderGesperrt ? 'aussortiert' : 'neu',
        })
        .select()
        .single();

      if (insertError || !anfrage) {
        console.error('DB Fehler:', insertError);
        await supabaseAdmin.from('processing_errors').insert({
          betrieb_id: betrieb.id,
          schritt: 'mail_parse',
          fehler_text: insertError?.message || 'unbekannt',
          fehler_details: { payload_sample: { from: vonEmail, subject: betreff } },
        });
        return NextResponse.json(
          { error: insertError?.message || 'Insert fehlgeschlagen' },
          { status: 500 }
        );
      }

      anfrageId = anfrage.id;
      console.log('Neue Anfrage gespeichert:', anfrageId);
    }

    // Nachricht in nachrichten-Tabelle speichern – id zurückholen für Anhänge
    const { data: neueNachricht, error: nachrichtInsertError } = await supabaseAdmin
      .from('nachrichten')
      .insert({
        anfrage_id: anfrageId,
        betrieb_id: betrieb.id,
        typ: 'eingang',
        von_email: vonEmail,
        von_name: vonName,
        an_email: toEmail,
        betreff: betreff,
        body_text: bodyText,
        body_html: bodyHtml,
        message_id: messageId,
        in_reply_to: inReplyTo,
        status: 'gespeichert',
        raw_payload: payload,
      })
      .select('id')
      .single();

    if (nachrichtInsertError || !neueNachricht) {
      // Race-Detection: zweiter Postmark-Webhook hat Pre-Check und UNIQUE
      // gleichzeitig passiert. Erster ist durch, wir sind der zweite und
      // dürfen NICHT weiterklassifizieren – sonst doppelter Entwurf trotz Schutz.
      const isUniqueViolation =
        nachrichtInsertError?.code === '23505' &&
        (nachrichtInsertError.message?.includes('nachrichten_message_id_uniq') ||
          nachrichtInsertError.message?.includes('message_id'));

      if (isUniqueViolation) {
        console.log(
          `↺ Race erkannt: nachricht_insert UNIQUE-Violation für ${messageId} – Skip`
        );
        return NextResponse.json({
          success: true,
          duplicate: true,
          anfrage_id: anfrageId,
        });
      }

      console.error('Nachricht-Insert fehlgeschlagen:', nachrichtInsertError);
      await supabaseAdmin.from('processing_errors').insert({
        betrieb_id: betrieb.id,
        anfrage_id: anfrageId,
        schritt: 'nachricht_insert',
        fehler_text: nachrichtInsertError?.message || 'unbekannt',
      });
    }

    // Anhänge aus dem Postmark-Payload extrahieren + hochladen
    const attachments = Array.isArray(payload.Attachments)
      ? (payload.Attachments as PostmarkAttachment[])
      : [];
    if (neueNachricht && attachments.length > 0) {
      console.log(`📎 ${attachments.length} Anhang/Anhänge erkannt – verarbeite…`);
      for (const att of attachments) {
        // Hat der Edge-Proxy schon hochgeladen? Dann nur verlinken.
        // Sonst aus base64 hochladen (Legacy-Pfad / kleine Anhänge).
        const storagePath = att._storage_path;
        const content = att.Content;

        let res: { success: boolean; error?: string };
        if (att._upload_failed) {
          // Edge-Proxy hat den Upload schon versucht und gemeldet.
          // Wir loggen das, machen aber keinen erneuten Versuch.
          res = {
            success: false,
            error: `Edge-Proxy-Upload fehlgeschlagen: ${att._upload_error || 'unbekannt'}`,
          };
        } else if (storagePath) {
          res = await verlinkeAnhang(
            {
              name: att.Name,
              contentType: att.ContentType,
              storagePath,
              contentLengthHint: att.ContentLength,
            },
            { nachrichtId: neueNachricht.id, betriebId: betrieb.id }
          );
        } else if (content) {
          const input: AnhangInput = {
            name: att.Name,
            contentBase64: content,
            contentType: att.ContentType,
            contentLengthHint: att.ContentLength,
          };
          res = await speichereAnhang(input, {
            nachrichtId: neueNachricht.id,
            anfrageId,
            betriebId: betrieb.id,
          });
        } else {
          res = { success: false, error: 'Weder Content noch _storage_path im Anhang' };
        }

        if (!res.success) {
          console.error(`Anhang "${att.Name}" fehlgeschlagen:`, res.error);
          await supabaseAdmin.from('processing_errors').insert({
            betrieb_id: betrieb.id,
            anfrage_id: anfrageId,
            schritt: 'attachment_upload',
            fehler_text: res.error || 'unbekannt',
            fehler_details: { dateiname: att.Name, content_type: att.ContentType },
          });
        }
      }
    }

    // SCHRITT 2a: KI-Kosten-Soft-Cap (50 Analysen pro Betrieb pro Stunde).
    // Schützt vor Loop-Bugs, kompromittierten Inboxen, Spam-Wellen die die
    // Anthropic-Rechnung explodieren lassen würden. Pragmatisch: einfache
    // DB-Query, kein Redis nötig für Pilot-Phase.
    const eineStundeZurueck = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: analysenLetzteStunde } = await supabaseAdmin
      .from('analysen')
      .select('id', { count: 'exact', head: true })
      .eq('betrieb_id', betrieb.id)
      .gte('analysiert_am', eineStundeZurueck);

    if ((analysenLetzteStunde ?? 0) >= 50) {
      console.warn(
        `KI-Cap überschritten für Betrieb ${betrieb.id}: ${analysenLetzteStunde} Analysen in 60 Min → skip`
      );
      await supabaseAdmin.from('processing_errors').insert({
        betrieb_id: betrieb.id,
        anfrage_id: anfrageId,
        schritt: 'ki_kosten_cap',
        fehler_text: `KI-Cap überschritten: ${analysenLetzteStunde} Analysen/h. Mail liegt in 'manuell_pruefen' ohne Klassifikation/Entwurf.`,
        fehler_details: { cap: 50, ist_reply: istReply, von_email: vonEmail },
      });
      await supabaseAdmin
        .from('anfragen')
        .update({ status: istReply ? 'reply_eingegangen' : 'manuell_pruefen' })
        .eq('id', anfrageId);

      return NextResponse.json({
        success: true,
        anfrage_id: anfrageId,
        ist_reply: istReply,
        ki_cap: true,
      });
    }

    // SCHRITT 2: Klassifikation
    const { data: anfrageFuerKlass } = await supabaseAdmin
      .from('anfragen')
      .select('id, von_email, von_name, betreff, body_text, body_text_clean')
      .eq('id', anfrageId)
      .single();

    if (!anfrageFuerKlass) {
      return NextResponse.json({ error: 'Anfrage nicht gefunden nach Insert' }, { status: 500 });
    }

    const klassInput = istReply
      ? {
          id: anfrageFuerKlass.id,
          von_email: vonEmail,
          von_name: vonName,
          betreff: betreff,
          body_text: bodyText,
          body_text_clean: bodyTextClean,
        }
      : {
          id: anfrageFuerKlass.id,
          von_email: anfrageFuerKlass.von_email,
          von_name: anfrageFuerKlass.von_name,
          betreff: anfrageFuerKlass.betreff,
          body_text: anfrageFuerKlass.body_text,
          body_text_clean: anfrageFuerKlass.body_text_clean,
        };

    // Gesperrter Sender: keine Klassifikation, kein Entwurf – Anfrage ist
    // schon als 'aussortiert' angelegt, wir sind fertig.
    if (senderGesperrt) {
      console.log(`🚫 Skip KI für gesperrten Sender ${vonEmail}`);
      return NextResponse.json({
        success: true,
        anfrage_id: anfrageId,
        ist_reply: istReply,
        gesperrt: true,
      });
    }

    const klassRes = await klassifiziereAnfrage(klassInput, betrieb);

    if (!klassRes.success) {
      console.error(`✗ Klassifikation fehlgeschlagen: ${klassRes.error}`);
      // KI down / kaputt – Anfrage darf nicht im Nirvana hängen.
      // Status auf 'manuell_pruefen' + Eintrag in Diagnose, damit Max es sieht.
      await supabaseAdmin.from('processing_errors').insert({
        betrieb_id: betrieb.id,
        anfrage_id: anfrageId,
        schritt: 'klassifikation',
        fehler_text: klassRes.error || 'Klassifikation ohne Fehlertext fehlgeschlagen',
        fehler_details: { ist_reply: istReply, von_email: vonEmail, betreff },
      });
      await supabaseAdmin
        .from('anfragen')
        .update({ status: istReply ? 'reply_eingegangen' : 'manuell_pruefen' })
        .eq('id', anfrageId);

      return NextResponse.json({
        success: true,
        anfrage_id: anfrageId,
        ist_reply: istReply,
        klassifikation: 'fehlgeschlagen',
      });
    }

    console.log(
      `✓ Klassifikation: ${klassRes.klassifikation?.kategorie} (Reply: ${istReply})`
    );

    // SCHRITT 3: Premium-Routing
    //
    // Neue Logik (Premium-Vision: Max kriegt IMMER einen Vorschlag):
    //
    //   KUNDENANFRAGEN bekommen IMMER einen Entwurf:
    //     - gewerk_match='passt' + confidence >= 0.6 → Entwurf + Tab 'Freigabe'
    //     - gewerk_match='unklar' → Rückfrage-Entwurf + Tab 'Manuell prüfen'
    //     - gewerk_match='passt_nicht' → Höflicher Absage-Entwurf + Tab 'Manuell prüfen'
    //     - low confidence (<0.6) → Vorschlags-Entwurf + Tab 'Manuell prüfen'
    //
    //   ANDERE KATEGORIEN: kein Entwurf nötig
    //     - rechnung/bestellung/innung → Tab 'Info'
    //     - sonstiges → Tab 'Manuell prüfen' (Max entscheidet selbst)
    //     - werbung → Tab 'Aussortiert'
    //
    //   Max kann den Entwurf jederzeit ändern oder ignorieren und manuell schreiben.

    const klass = klassRes.klassifikation;
    const INFO_KATEGORIEN = ['rechnung', 'bestellung_versand', 'innung_behoerde'];
    const MANUELL_KATEGORIEN = ['sonstiges'];
    const AUSSORTIERT_KATEGORIEN = ['werbung'];

    let neuerStatus = 'neu';
    let entwurfStatus:
      | 'erstellt'
      | 'fehlgeschlagen'
      | 'nicht_relevant'
      | 'manuell_pruefen'
      | 'info'
      | 'aussortiert' = 'nicht_relevant';

    if (klass?.kategorie === 'kundenanfrage') {
      // Eskalations-Check VOR Entwurfsgenerierung – Iron Rule 3 ("Entwurf für
      // ALLE") wird hier bewusst durchbrochen. Bei Anwalt/Mängelrüge/Drohung
      // schreibt die KI keinen lockeren Entwurf, sondern flaggt für manuelle
      // Antwort. STRATEGIE.md TEIL A1 Punkt 6.
      if (klass.eskalation_erkannt) {
        console.warn(
          `🚨 Eskalation erkannt (${klass.eskalation_grund || 'kein Grund angegeben'}) – kein Auto-Entwurf, manuell_pruefen`
        );
        await supabaseAdmin.from('processing_errors').insert({
          betrieb_id: betrieb.id,
          anfrage_id: anfrageId,
          schritt: 'eskalation',
          fehler_text: `Eskalation flag: ${klass.eskalation_grund || 'kein Grund'}`,
          fehler_details: {
            kategorie: klass.kategorie,
            eskalation_grund: klass.eskalation_grund,
          },
        });
        entwurfStatus = 'manuell_pruefen';
        neuerStatus = 'manuell_pruefen';
        await supabaseAdmin
          .from('anfragen')
          .update({ status: 'manuell_pruefen' })
          .eq('id', anfrageId);

        return NextResponse.json({
          success: true,
          anfrage_id: anfrageId,
          ist_reply: istReply,
          eskalation: true,
          eskalation_grund: klass.eskalation_grund,
        });
      }

      // IMMER Entwurf bauen für Kundenanfragen – egal ob passt, unklar, passt_nicht
      const { data: klassifikation, error: klassifikationError } = await supabaseAdmin
        .from('analysen')
        .select('*')
        .eq('anfrage_id', anfrageId)
        .order('analysiert_am', { ascending: false })
        .limit(1)
        .single();

      if (!klassifikation) {
        // Race-Condition: Analyse wurde gerade in klassifiziereAnfrage
        // geschrieben, aber Re-Read findet sie nicht. Statt still zu fallen –
        // loggen und Status auf manuell_pruefen setzen.
        console.error('Analyse nach Klassifikation nicht lesbar:', klassifikationError);
        await supabaseAdmin.from('processing_errors').insert({
          betrieb_id: betrieb.id,
          anfrage_id: anfrageId,
          schritt: 'analyse_re_read',
          fehler_text: klassifikationError?.message || 'Analyse-Re-Read returned null',
          fehler_details: { kategorie: klass.kategorie },
        });
        entwurfStatus = 'fehlgeschlagen';
        neuerStatus = 'manuell_pruefen';
      } else {
        // Bei Replies den kompletten Thread laden, damit die KI auf die LETZTE
        // Kunden-Nachricht reagieren kann statt blind die Ursprungs-Anfrage
        // nochmal zu beantworten.
        let konversation: ThreadNachricht[] | undefined;
        if (istReply) {
          const { data: thread } = await supabaseAdmin
            .from('nachrichten')
            .select('typ, von_name, von_email, body_text, erstellt_am')
            .eq('anfrage_id', anfrageId)
            .order('erstellt_am', { ascending: true });
          konversation = (thread as ThreadNachricht[] | null) || undefined;
        }

        // Bei Erst-Anfragen: nächste freie Slots aus Kalender holen, damit
        // die KI konkrete Termin-Vorschläge machen kann. Bei Replies lassen
        // wir das aus – der Termin-Faden läuft schon im Thread-Kontext.
        let freieSlots: string[] | undefined;
        if (!istReply) {
          try {
            const slots = await getFreieSlots(betrieb.id, new Date(), 14, 60, 12);
            if (slots.length > 0) {
              freieSlots = slots.map((s) => s.label);
              console.log(
                `📅 ${slots.length} freie Slots an Entwurf-KI übergeben`
              );
            }
          } catch (err) {
            console.error('Fehler beim Slot-Loading (nicht-blockend):', err);
          }
        }

        // Vision V1: Foto-Anhänge der aktuellen Nachricht für die KI laden.
        // Bei Erst-Anfragen die gerade eingegangene Mail, bei Replies die
        // letzte eingehende. Wir nehmen schlicht neueNachricht.id – das ist
        // bei beiden Fällen die Nachricht, die wir gerade eingespeichert
        // haben. Wenn keine Bilder dabei sind, returnt der Helper leeres
        // Array und der Vision-Pfad in generiereEntwurf wird übersprungen.
        const bilder = neueNachricht
          ? await ladeBilderFuerKI(neueNachricht.id).catch((err) => {
              console.error(
                'Vision: Bilder-Loading fehlgeschlagen (nicht-blockend):',
                err instanceof Error ? err.message : err
              );
              return [];
            })
          : [];

        const entwurfRes = await generiereEntwurf(
          anfrageFuerKlass,
          klassifikation,
          betrieb,
          konversation,
          freieSlots,
          bilder
        );

        if (entwurfRes.success) {
          console.log(
            `✓ Entwurf fertig (gewerk_match=${klass.gewerk_match}, confidence=${klass.confidence})`
          );
          entwurfStatus = 'erstellt';

          // Routing-Status: passt + confidence ok → Freigabe; sonst Manuell prüfen
          const passungOk = klass.gewerk_match === 'passt';
          const confidenceOk = (klass.confidence ?? 0) >= 0.6;

          if (passungOk && confidenceOk) {
            neuerStatus = 'entwurf_bereit';
          } else {
            // Entwurf ist da, aber Max soll nochmal drüber schauen
            neuerStatus = 'manuell_pruefen';
            // generiereEntwurf hat status='entwurf_bereit' gesetzt – korrigieren
            await supabaseAdmin
              .from('anfragen')
              .update({ status: 'manuell_pruefen' })
              .eq('id', anfrageId);
            console.log(
              `⚠ Entwurf liegt vor, aber unsicher (passung=${klass.gewerk_match}, confidence=${klass.confidence}) → manuell_pruefen`
            );
          }
        } else {
          console.error(`✗ Entwurf fehlgeschlagen: ${entwurfRes.error}`);
          // Entwurf konnte nicht gebaut werden – Max muss manuell antworten.
          // Diagnose-Eintrag, damit es nicht still im Hintergrund verschwindet.
          await supabaseAdmin.from('processing_errors').insert({
            betrieb_id: betrieb.id,
            anfrage_id: anfrageId,
            schritt: 'entwurf_generierung',
            fehler_text: entwurfRes.error || 'Entwurf-Generierung ohne Fehlertext',
            fehler_details: { kategorie: klass.kategorie, gewerk_match: klass.gewerk_match },
          });
          entwurfStatus = 'fehlgeschlagen';
          neuerStatus = 'manuell_pruefen';
        }
      }
    } else if (klass && INFO_KATEGORIEN.includes(klass.kategorie)) {
      neuerStatus = 'info';
      entwurfStatus = 'info';
      console.log(`📌 Kategorie ${klass.kategorie} → info`);
    } else if (klass && MANUELL_KATEGORIEN.includes(klass.kategorie)) {
      neuerStatus = 'manuell_pruefen';
      entwurfStatus = 'manuell_pruefen';
      console.log(`⚠ Kategorie ${klass.kategorie} → manuell_pruefen`);
    } else if (klass && AUSSORTIERT_KATEGORIEN.includes(klass.kategorie)) {
      neuerStatus = 'aussortiert';
      entwurfStatus = 'aussortiert';
      console.log(`🗑 Kategorie ${klass.kategorie} → aussortiert`);
    }

    // Status setzen – außer Reply (steht schon reply_eingegangen)
    // und außer entwurf_bereit (generiereEntwurf hat das schon gesetzt)
    if (!istReply && neuerStatus !== 'neu' && neuerStatus !== 'entwurf_bereit') {
      await supabaseAdmin
        .from('anfragen')
        .update({ status: neuerStatus })
        .eq('id', anfrageId);
    }

    // BUGFIX: Bei Replies MUSS der Status 'reply_eingegangen' bleiben.
    // Der Entwurf wird trotzdem gebaut (für Tab "Kunde geantwortet"), aber
    // generiereEntwurf setzt intern status='entwurf_bereit' – diese
    // Überschreibung wird hier wieder zurückkorrigiert.
    if (istReply) {
      neuerStatus = 'reply_eingegangen';
      await supabaseAdmin
        .from('anfragen')
        .update({ status: 'reply_eingegangen' })
        .eq('id', anfrageId);
    }

    return NextResponse.json({
      success: true,
      anfrage_id: anfrageId,
      ist_reply: istReply,
      kategorie: klass?.kategorie,
      gewerk_match: klass?.gewerk_match,
      status: neuerStatus,
      entwurf: entwurfStatus,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    console.error('Webhook Fehler:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'webhook ready' });
}