import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cleanMail } from '@/lib/mail-cleaner';
import { klassifiziereAnfrage } from '@/lib/klassifikation';
import { generiereEntwurf } from '@/lib/entwurf';

const CLEAN_THRESHOLD = 3000;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  console.log('DEBUG: Webhook v8 (Threading via References + In-Reply-To)');
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

    // Sammle ALLE möglichen Threading-IDs:
    // - In-Reply-To: direkte Antwort-ID
    // - References: chronologische Liste aller Vorgänger-IDs
    // Postmark transformiert beim Versand die Message-ID auf @mtasv.net,
    // ABER die Original-ID (z.B. @pm-bounces.auftragswerk.app) landet
    // meist auch in References. Daher beide Header durchsuchen.
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

    // Reply-Erkennung
    // Suche nach Vorgänger-Nachrichten anhand aller bekannten Threading-IDs.
    // Match auf message_id ODER in_reply_to, damit auch tiefere
    // Konversations-Threads (Reply auf Reply auf Reply) richtig zugeordnet werden.
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

    // Nachricht in nachrichten-Tabelle speichern
    await supabaseAdmin.from('nachrichten').insert({
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
    });

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

    // SCHRITT 3: Premium-Routing nach Klassifikation
    //   - kundenanfrage + gewerk_match='passt' + confidence>=0.6 → Entwurf bauen → entwurf_bereit
    //   - kundenanfrage 'unklar' / 'passt_nicht' / low confidence → manuell_pruefen
    //   - rechnung / bestellung_versand / innung_behoerde → info
    //   - sonstiges → manuell_pruefen
    //   - werbung → aussortiert
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
      // Premium-Logik: NUR 'passt' (nicht 'unklar', nicht 'passt_nicht') geht zu Freigabe
      const passungOk = klass.gewerk_match === 'passt';
      const confidenceOk = (klass.confidence ?? 0) >= 0.6;

      if (!passungOk || !confidenceOk) {
        neuerStatus = 'manuell_pruefen';
        entwurfStatus = 'manuell_pruefen';
        console.log(
          `⚠ Kundenanfrage zu unsicher (passung=${klass.gewerk_match}, confidence=${klass.confidence}) → manuell_pruefen`
        );
      } else {
        const { data: klassifikation } = await supabaseAdmin
          .from('analysen')
          .select('*')
          .eq('anfrage_id', anfrageId)
          .order('analysiert_am', { ascending: false })
          .limit(1)
          .single();

        if (klassifikation) {
          const entwurfRes = await generiereEntwurf(anfrageFuerKlass, klassifikation, betrieb);

          if (entwurfRes.success) {
            console.log(`✓ Entwurf fertig`);
            entwurfStatus = 'erstellt';
            neuerStatus = 'entwurf_bereit';
          } else {
            console.error(`✗ Entwurf fehlgeschlagen: ${entwurfRes.error}`);
            entwurfStatus = 'fehlgeschlagen';
            neuerStatus = 'manuell_pruefen';
          }
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
    // und außer entwurf_bereit (generiereEntwurf hat das schon erledigt)
    if (!istReply && neuerStatus !== 'neu' && neuerStatus !== 'entwurf_bereit') {
      await supabaseAdmin
        .from('anfragen')
        .update({ status: neuerStatus })
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