import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendMail } from '@/lib/postmark';
import { sendeViaGmail } from '@/lib/gmail';
import { speichereAnhang, type AnhangInput } from '@/lib/anhaenge';

export const maxDuration = 30;

/**
 * POST /api/versand
 * Body: { entwurf_id: string }
 *
 * Versendet einen Entwurf via Postmark.
 *
 * From-Adresse:
 *   - Wenn betrieb.sender_email + betrieb.sender_verified → von dieser Adresse
 *   - Sonst → Fallback auf POSTMARK_FROM_EMAIL
 *
 * Reply-To:
 *   - betrieb.inbound_email (Postmark-Inbound), damit Kunden-Antworten zurückkommen
 *   - Fallback: POSTMARK_REPLY_TO
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Auth-Check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    // 2. Body parsen
    const body = await req.json();
    const entwurfId: string | undefined = body.entwurf_id;
    const anhaenge: AnhangInput[] = Array.isArray(body.anhaenge) ? body.anhaenge : [];

    if (!entwurfId) {
      return NextResponse.json({ error: 'entwurf_id fehlt' }, { status: 400 });
    }

    // 3. Entwurf holen (RLS prüft Zugriff)
    const { data: entwurf, error: entwurfError } = await supabase
      .from('entwuerfe')
      .select('id, anfrage_id, betrieb_id, betreff_vorschlag, body_text, status')
      .eq('id', entwurfId)
      .single();

    if (entwurfError || !entwurf) {
      return NextResponse.json(
        { error: 'Entwurf nicht gefunden', details: entwurfError?.message },
        { status: 404 }
      );
    }

    if (entwurf.status === 'versendet') {
      return NextResponse.json(
        { error: 'Entwurf wurde bereits versendet' },
        { status: 400 }
      );
    }

    if (entwurf.status === 'in_versand') {
      return NextResponse.json(
        { error: 'Entwurf wird gerade versendet' },
        { status: 409 }
      );
    }

    // 3b. Atomaren Lock setzen: Status auf 'in_versand' nur wenn er das nicht
    //     schon ist. Zweiter Klick / paralleler Request kriegt 0 rows → 409.
    //     Schützt davor dass Postmark zweimal feuert wenn die DB-Updates später
    //     stocken.
    const vorigerStatus = entwurf.status;
    const { data: lockedRows, error: lockError } = await supabaseAdmin
      .from('entwuerfe')
      .update({
        status: 'in_versand',
        updated_at: new Date().toISOString(),
      })
      .eq('id', entwurf.id)
      .neq('status', 'versendet')
      .neq('status', 'in_versand')
      .select('id');

    if (lockError) {
      console.error('Versand-Lock fehlgeschlagen:', lockError);
      return NextResponse.json(
        { error: 'Lock-Fehler', details: lockError.message },
        { status: 500 }
      );
    }

    if (!lockedRows || lockedRows.length === 0) {
      return NextResponse.json(
        { error: 'Entwurf wird gerade versendet oder ist schon raus' },
        { status: 409 }
      );
    }

    // Helper: bei jedem späteren Fehler den Lock wieder lösen
    const entwurfIdForUnlock = entwurf.id;
    async function unlock() {
      await supabaseAdmin
        .from('entwuerfe')
        .update({ status: vorigerStatus, updated_at: new Date().toISOString() })
        .eq('id', entwurfIdForUnlock)
        .eq('status', 'in_versand');
    }

    // 4. Anfrage holen
    const { data: anfrage } = await supabase
      .from('anfragen')
      .select('id, von_email, von_name')
      .eq('id', entwurf.anfrage_id)
      .single();

    if (!anfrage) {
      await unlock();
      return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 });
    }

    // 5. Betrieb + Gmail-Connection parallel holen
    const [{ data: betrieb }, { data: gmailConn }] = await Promise.all([
      supabaseAdmin
        .from('betriebe')
        .select('inbound_email, name, sender_email, sender_name, sender_verified')
        .eq('id', entwurf.betrieb_id)
        .single(),
      supabaseAdmin
        .from('gmail_connections')
        .select('id, google_email, status')
        .eq('betrieb_id', entwurf.betrieb_id)
        .eq('status', 'aktiv')
        .maybeSingle(),
    ]);

    // 6. From-Adresse bestimmen (3-stufige Hierarchie):
    //    1. Gmail-OAuth aktiv → senden aus echtem Gmail-Account
    //    2. Custom Sender verified (Postmark) → bisheriger Weg
    //    3. Postmark-Fallback → info@auftragswerk.app
    const useGmail = Boolean(gmailConn?.google_email);
    const useCustomSender = !useGmail && Boolean(
      betrieb?.sender_verified && betrieb?.sender_email
    );
    const fromEmail = useGmail
      ? gmailConn!.google_email
      : useCustomSender
      ? betrieb!.sender_email!
      : process.env.POSTMARK_FROM_EMAIL || 'info@auftragswerk.app';
    const fromName = useGmail
      ? betrieb?.name || 'Auftragswerk'
      : useCustomSender
      ? betrieb!.sender_name || betrieb!.name || 'Auftragswerk'
      : process.env.POSTMARK_FROM_NAME || 'Auftragswerk';

    // 7. Letzte eingehende Nachricht für Threading (In-Reply-To)
    const { data: letzteEingangsnachricht } = await supabase
      .from('nachrichten')
      .select('message_id')
      .eq('anfrage_id', anfrage.id)
      .eq('typ', 'eingang')
      .order('erstellt_am', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 8. Komplette Thread-References
    const { data: alleNachrichten } = await supabase
      .from('nachrichten')
      .select('message_id')
      .eq('anfrage_id', anfrage.id)
      .not('message_id', 'is', null)
      .order('erstellt_am', { ascending: true });

    const references = (alleNachrichten || [])
      .map((n) => n.message_id)
      .filter((id): id is string => Boolean(id));

    // 9. Reply-To-Hierarchie (Iron Rule 26: NIE die Postmark-Hex für Endkunden):
    //    1. betrieb.inbound_email = Subdomain `slug@kunden.auftragswerk.app`
    //       (seit Welle E.2). MX routet direkt zu Postmark → kein Forward-
    //       Filter mehr nötig. Funktioniert unabhängig vom From-Pfad
    //       (Gmail-OAuth, Custom Sender oder Postmark-Fallback).
    //    2. Wenn aus irgendeinem Grund keine inbound_email vorhanden:
    //       sender_verified → sender_email (saubere Geschäftsadresse).
    //    3. Letzter Fallback POSTMARK_REPLY_TO – nur Owner-Tests akzeptabel.
    const replyToAddress = betrieb?.inbound_email
      || (useCustomSender ? betrieb!.sender_email! : undefined)
      || process.env.POSTMARK_REPLY_TO
      || undefined;
    const replyToName = betrieb?.name || fromName;

    // 10. Mail versenden – Gmail wenn aktiv, sonst Postmark.
    //     Bei dauerhaftem Gmail-Fehler (4xx, status auf 'fehler' gesetzt) →
    //     Fallback auf Postmark, damit Versand nicht hängen bleibt.
    let sendResult: Awaited<ReturnType<typeof sendMail>>;
    if (useGmail) {
      const gmailResult = await sendeViaGmail(entwurf.betrieb_id, {
        to: anfrage.von_email,
        toName: anfrage.von_name || undefined,
        fromEmail,
        fromName,
        subject: entwurf.betreff_vorschlag,
        bodyText: entwurf.body_text,
        replyTo: replyToAddress,
        replyToName: replyToName,
        inReplyTo: letzteEingangsnachricht?.message_id || undefined,
        references: references.length > 0 ? references : undefined,
        attachments: anhaenge.length > 0 ? anhaenge : undefined,
      });

      if (gmailResult.success) {
        sendResult = {
          success: true,
          messageId: gmailResult.messageId,
          postmarkMessageId: gmailResult.gmailMessageId, // wir nutzen denselben Slot für die externe ID
        };
      } else if (gmailResult.shouldFallback) {
        console.warn(
          `Gmail-Send failed (${gmailResult.error}) – Fallback auf Postmark für betrieb=${entwurf.betrieb_id}`
        );
        // Fallback-From auf Postmark-Defaults wechseln (Gmail-Adresse passt da nicht)
        const fallbackFrom = useCustomSender
          ? betrieb!.sender_email!
          : process.env.POSTMARK_FROM_EMAIL || 'info@auftragswerk.app';
        const fallbackName = useCustomSender
          ? betrieb!.sender_name || betrieb!.name || 'Auftragswerk'
          : process.env.POSTMARK_FROM_NAME || 'Auftragswerk';
        sendResult = await sendMail({
          to: anfrage.von_email,
          toName: anfrage.von_name || undefined,
          fromEmail: fallbackFrom,
          fromName: fallbackName,
          subject: entwurf.betreff_vorschlag,
          bodyText: entwurf.body_text,
          replyTo: replyToAddress,
          replyToName: replyToName,
          inReplyTo: letzteEingangsnachricht?.message_id || undefined,
          references: references.length > 0 ? references : undefined,
          tag: 'antwortentwurf-fallback',
          metadata: {
            anfrage_id: anfrage.id,
            entwurf_id: entwurf.id,
            betrieb_id: entwurf.betrieb_id,
            gmail_fallback: 'true',
          },
          attachments: anhaenge.length > 0 ? anhaenge : undefined,
        });
      } else {
        // Transienter Fehler → kein Fallback, Aufrufer sieht Error
        sendResult = {
          success: false,
          error: gmailResult.error,
        };
      }
    } else {
      sendResult = await sendMail({
        to: anfrage.von_email,
        toName: anfrage.von_name || undefined,
        fromEmail: fromEmail,
        fromName: fromName,
        subject: entwurf.betreff_vorschlag,
        bodyText: entwurf.body_text,
        replyTo: replyToAddress,
        replyToName: replyToName,
        inReplyTo: letzteEingangsnachricht?.message_id || undefined,
        references: references.length > 0 ? references : undefined,
        tag: 'antwortentwurf',
        metadata: {
          anfrage_id: anfrage.id,
          entwurf_id: entwurf.id,
          betrieb_id: entwurf.betrieb_id,
        },
        attachments: anhaenge.length > 0 ? anhaenge : undefined,
      });
    }

    if (!sendResult.success) {
      await unlock();
      await supabaseAdmin.from('processing_errors').insert({
        betrieb_id: entwurf.betrieb_id,
        schritt: 'versand',
        fehler_text: sendResult.error || 'unbekannter Postmark-Fehler',
        fehler_details: { entwurf_id: entwurf.id, error_code: sendResult.errorCode },
      });

      return NextResponse.json(
        { error: sendResult.error, errorCode: sendResult.errorCode },
        { status: 500 }
      );
    }

    // 11. Versendete Nachricht speichern (für Threading + Verlauf)
    const versendetAm = new Date().toISOString();

    const { data: ausgangNachricht, error: nachrichtError } = await supabaseAdmin
      .from('nachrichten')
      .insert({
        anfrage_id: anfrage.id,
        betrieb_id: entwurf.betrieb_id,
        typ: 'ausgang',
        von_email: fromEmail,
        von_name: fromName,
        an_email: anfrage.von_email,
        an_name: anfrage.von_name,
        betreff: entwurf.betreff_vorschlag,
        body_text: entwurf.body_text,
        message_id: sendResult.messageId,
        in_reply_to: letzteEingangsnachricht?.message_id || null,
        entwurf_id: entwurf.id,
        postmark_message_id: sendResult.postmarkMessageId,
        status: 'versendet',
        versendet_am: versendetAm,
      })
      .select('id')
      .single();

    if (nachrichtError) {
      console.error('Nachricht-Insert-Fehler (Mail wurde aber versendet):', nachrichtError);
    }

    // Outbound-Anhänge in Storage + anhaenge speichern (verlinkt an die Ausgang-Nachricht)
    if (ausgangNachricht && anhaenge.length > 0) {
      for (const att of anhaenge) {
        const res = await speichereAnhang(att, {
          nachrichtId: ausgangNachricht.id,
          anfrageId: anfrage.id,
          betriebId: entwurf.betrieb_id,
        });
        if (!res.success) {
          console.error(`Outbound-Anhang "${att.name}" fehlgeschlagen:`, res.error);
          await supabaseAdmin.from('processing_errors').insert({
            betrieb_id: entwurf.betrieb_id,
            anfrage_id: anfrage.id,
            schritt: 'attachment_upload_outbound',
            fehler_text: res.error || 'unbekannt',
            fehler_details: { dateiname: att.name, content_type: att.contentType },
          });
        }
      }
    }

    // 12. Entwurf-Status updaten → 'versendet' (löst den 'in_versand'-Lock).
    //     Mail ist schon raus, also bei Fehler nur loggen, NICHT 500 zurückgeben –
    //     sonst klickt Max nochmal und Kunde kriegt 2 Mails.
    const { error: entwurfUpdateError } = await supabaseAdmin
      .from('entwuerfe')
      .update({
        status: 'versendet',
        postmark_message_id: sendResult.postmarkMessageId,
        versendet_am: versendetAm,
        updated_at: versendetAm,
      })
      .eq('id', entwurf.id);

    if (entwurfUpdateError) {
      console.error('KRITISCH: Mail raus aber entwuerfe-Update failed:', entwurfUpdateError);
      await supabaseAdmin.from('processing_errors').insert({
        betrieb_id: entwurf.betrieb_id,
        anfrage_id: anfrage.id,
        schritt: 'versand_status_update',
        fehler_text: `Mail an ${anfrage.von_email} versendet (Postmark ${sendResult.postmarkMessageId}), aber entwuerfe-Update fehlgeschlagen: ${entwurfUpdateError.message}`,
        fehler_details: { entwurf_id: entwurf.id, postmark_id: sendResult.postmarkMessageId },
      });
    }

    // 13. Anfrage-Status updaten → 'versendet'
    const { error: anfrageUpdateError } = await supabaseAdmin
      .from('anfragen')
      .update({ status: 'versendet' })
      .eq('id', anfrage.id);

    if (anfrageUpdateError) {
      console.error('Anfrage-Status-Update failed:', anfrageUpdateError);
      await supabaseAdmin.from('processing_errors').insert({
        betrieb_id: entwurf.betrieb_id,
        anfrage_id: anfrage.id,
        schritt: 'versand_anfrage_status',
        fehler_text: anfrageUpdateError.message,
      });
    }

    console.log(
      `✓ Mail versendet: ${sendResult.postmarkMessageId} an ${anfrage.von_email} ` +
      `(From: ${fromEmail}, ReplyTo: ${replyToAddress}, CustomSender: ${useCustomSender})`
    );

    return NextResponse.json({
      success: true,
      message_id: sendResult.messageId,
      postmark_message_id: sendResult.postmarkMessageId,
      empfaenger: anfrage.von_email,
      from: fromEmail,
      reply_to: replyToAddress,
      custom_sender: useCustomSender,
    });
  } catch (err) {
    console.error('Versand-Fehler:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}