import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cleanMail } from '@/lib/mail-cleaner';
import { klassifiziereAnfrage } from '@/lib/klassifikation';
import { generiereEntwurf, type ThreadNachricht } from '@/lib/entwurf';
import { speichereAnhang, type AnhangInput } from '@/lib/anhaenge';

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

/** Shape, in der Postmark Anhänge im Webhook-Payload liefert. */
type PostmarkAttachment = {
  Name: string;
  Content: string;       // base64-encoded
  ContentType: string;
  ContentLength: number;
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
    const toEmail = payload.ToFull?.[0]?.Email || payload.To || '';

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
        'id, name, inhaber, branche, was_wir_machen, was_wir_nicht_machen, region, mindestauftragswert, ton_beispiele, signatur, inbound_email'
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

    if (existierendeAnfrageId) {
      anfrageId = existierendeAnfrageId;
      istReply = true;

      await supabaseAdmin
        .from('anfragen')
        .update({ status: 'reply_eingegangen' })
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
          status: 'neu',
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
        const input: AnhangInput = {
          name: att.Name,
          contentBase64: att.Content,
          contentType: att.ContentType,
          contentLengthHint: att.ContentLength,
        };
        const res = await speichereAnhang(input, {
          nachrichtId: neueNachricht.id,
          anfrageId,
          betriebId: betrieb.id,
        });
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

    const klassRes = await klassifiziereAnfrage(klassInput, betrieb);

    if (!klassRes.success) {
      console.error(`✗ Klassifikation fehlgeschlagen: ${klassRes.error}`);
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
      // IMMER Entwurf bauen für Kundenanfragen – egal ob passt, unklar, passt_nicht
      const { data: klassifikation } = await supabaseAdmin
        .from('analysen')
        .select('*')
        .eq('anfrage_id', anfrageId)
        .order('analysiert_am', { ascending: false })
        .limit(1)
        .single();

      if (klassifikation) {
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

        const entwurfRes = await generiereEntwurf(
          anfrageFuerKlass,
          klassifikation,
          betrieb,
          konversation
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