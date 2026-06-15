import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendMail } from '@/lib/postmark';
import { sendeViaGmail } from '@/lib/gmail';
import { sendeViaMicrosoft } from '@/lib/microsoft';
import { speichereAnhang, type AnhangInput } from '@/lib/anhaenge';

export const maxDuration = 30;

/**
 * POST /api/versand/manuell
 * Body: { anfrage_id: string, betreff: string, body_text: string }
 *
 * Versendet eine MANUELL geschriebene Antwort (kein Entwurf nötig).
 * Hängt sich als neueste Nachricht in den Thread und setzt
 * Threading-Header korrekt, damit Kunden-Antworten zurückkommen.
 *
 * From-Adresse: Wenn betrieb.sender_verified → von betrieb.sender_email, sonst Env-Fallback.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    const body = await req.json();
    const anfrageId: string | undefined = body.anfrage_id;
    const betreff: string | undefined = body.betreff;
    const bodyText: string | undefined = body.body_text;
    const anhaenge: AnhangInput[] = Array.isArray(body.anhaenge) ? body.anhaenge : [];

    if (!anfrageId || !betreff || !bodyText) {
      return NextResponse.json(
        { error: 'anfrage_id, betreff und body_text sind pflicht' },
        { status: 400 }
      );
    }

    // Schutz gegen DB-Bloat + Postmark-Limits + KI-Token-Explosion
    if (betreff.length > 500) {
      return NextResponse.json(
        { error: 'Betreff zu lang (max 500 Zeichen)' },
        { status: 400 }
      );
    }
    if (bodyText.length > 50000) {
      return NextResponse.json(
        { error: 'Nachricht zu lang (max 50.000 Zeichen)' },
        { status: 400 }
      );
    }

    // Anfrage holen (RLS prüft Zugriff)
    const { data: anfrage, error: anfrageError } = await supabase
      .from('anfragen')
      .select('id, betrieb_id, von_email, von_name')
      .eq('id', anfrageId)
      .single();

    if (anfrageError || !anfrage) {
      return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 });
    }

    // Serverseitiger Doppelklick-Schutz: wurde in den letzten 5 Sekunden
    // schon eine Ausgangsnachricht für diese anfrage_id geschrieben?
    // (Manuell-Versand hat keinen Entwurf-Status für atomaren Lock, also
    // zeitbasiert.) Schützt vor Doppelklick + Browser-Reload + Multi-Tab.
    const fuenfSekundenZurueck = new Date(Date.now() - 5000).toISOString();
    const { data: recentSends } = await supabaseAdmin
      .from('nachrichten')
      .select('id, versendet_am')
      .eq('anfrage_id', anfrage.id)
      .eq('typ', 'ausgang')
      .gte('versendet_am', fuenfSekundenZurueck)
      .limit(1);

    if (recentSends && recentSends.length > 0) {
      console.log(
        `↺ Doppelklick-Schutz: vor <5s wurde schon eine Mail für anfrage=${anfrage.id} versendet`
      );
      return NextResponse.json(
        { error: 'Es wurde gerade schon eine Mail versendet – bitte kurz warten' },
        { status: 409 }
      );
    }

    // Betrieb + Provider-Connections parallel holen
    const [{ data: betrieb }, { data: gmailConn }, { data: microsoftConn }] =
      await Promise.all([
        supabaseAdmin
          .from('betriebe')
          .select('inbound_email, name, sender_email, sender_name, sender_verified')
          .eq('id', anfrage.betrieb_id)
          .single(),
        supabaseAdmin
          .from('gmail_connections')
          .select('id, google_email, status')
          .eq('betrieb_id', anfrage.betrieb_id)
          .eq('status', 'aktiv')
          .maybeSingle(),
        supabaseAdmin
          .from('microsoft_connections')
          .select('id, microsoft_email, status')
          .eq('betrieb_id', anfrage.betrieb_id)
          .eq('status', 'aktiv')
          .maybeSingle(),
      ]);

    // From-Adresse: Microsoft → Gmail → Custom Sender → Postmark-Fallback
    const useMicrosoft = Boolean(microsoftConn?.microsoft_email);
    const useGmail = !useMicrosoft && Boolean(gmailConn?.google_email);
    const useCustomSender =
      !useMicrosoft &&
      !useGmail &&
      Boolean(betrieb?.sender_verified && betrieb?.sender_email);
    const fromEmail = useMicrosoft
      ? microsoftConn!.microsoft_email
      : useGmail
      ? gmailConn!.google_email
      : useCustomSender
      ? betrieb!.sender_email!
      : process.env.POSTMARK_FROM_EMAIL || 'info@auftragswerk.app';
    const fromName = useMicrosoft
      ? betrieb?.name || 'Auftragswerk'
      : useGmail
      ? betrieb?.name || 'Auftragswerk'
      : useCustomSender
      ? betrieb!.sender_name || betrieb!.name || 'Auftragswerk'
      : process.env.POSTMARK_FROM_NAME || 'Auftragswerk';

    // Letzte eingehende Nachricht für In-Reply-To
    const { data: letzteEingangsnachricht } = await supabase
      .from('nachrichten')
      .select('message_id')
      .eq('anfrage_id', anfrage.id)
      .eq('typ', 'eingang')
      .order('erstellt_am', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Komplette Thread-References
    const { data: alleNachrichten } = await supabase
      .from('nachrichten')
      .select('message_id')
      .eq('anfrage_id', anfrage.id)
      .not('message_id', 'is', null)
      .order('erstellt_am', { ascending: true });

    const references = (alleNachrichten || [])
      .map((n) => n.message_id)
      .filter((id): id is string => Boolean(id));

    // Reply-To-Hierarchie (Iron Rule 26 + Welle E.2 Subdomain):
    //    1. inbound_email (Subdomain seit E.2 – `slug@kunden.auftragswerk.app`)
    //    2. sender_email wenn Custom Sender verified
    //    3. POSTMARK_REPLY_TO-Fallback (nur Owner-Tests)
    const replyToAddress = betrieb?.inbound_email
      || (useCustomSender ? betrieb!.sender_email! : undefined)
      || process.env.POSTMARK_REPLY_TO
      || undefined;
    const replyToName = betrieb?.name || fromName;

    // Mail versenden – Provider-Hierarchie wie /api/versand (Microsoft → Gmail → Postmark).
    let sendResult: Awaited<ReturnType<typeof sendMail>>;
    if (useMicrosoft) {
      const msResult = await sendeViaMicrosoft(anfrage.betrieb_id, {
        to: anfrage.von_email,
        toName: anfrage.von_name || undefined,
        fromEmail,
        fromName,
        subject: betreff,
        bodyText: bodyText,
        replyTo: replyToAddress,
        replyToName: replyToName,
        inReplyTo: letzteEingangsnachricht?.message_id || undefined,
        references: references.length > 0 ? references : undefined,
        attachments: anhaenge.length > 0 ? anhaenge : undefined,
      });

      if (msResult.success) {
        sendResult = {
          success: true,
          messageId: msResult.messageId,
        };
      } else if (msResult.shouldFallback) {
        console.warn(
          `Microsoft-Send failed (manuell, ${msResult.error}) – Fallback auf Postmark`
        );
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
          subject: betreff,
          bodyText: bodyText,
          replyTo: replyToAddress,
          replyToName: replyToName,
          inReplyTo: letzteEingangsnachricht?.message_id || undefined,
          references: references.length > 0 ? references : undefined,
          tag: 'manueller_reply-fallback',
          metadata: {
            anfrage_id: anfrage.id,
            betrieb_id: anfrage.betrieb_id,
            manuell: 'true',
            microsoft_fallback: 'true',
          },
          attachments: anhaenge.length > 0 ? anhaenge : undefined,
        });
      } else {
        sendResult = { success: false, error: msResult.error };
      }
    } else if (useGmail) {
      const gmailResult = await sendeViaGmail(anfrage.betrieb_id, {
        to: anfrage.von_email,
        toName: anfrage.von_name || undefined,
        fromEmail,
        fromName,
        subject: betreff,
        bodyText: bodyText,
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
          postmarkMessageId: gmailResult.gmailMessageId,
        };
      } else if (gmailResult.shouldFallback) {
        console.warn(
          `Gmail-Send failed (manuell, ${gmailResult.error}) – Fallback auf Postmark`
        );
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
          subject: betreff,
          bodyText: bodyText,
          replyTo: replyToAddress,
          replyToName: replyToName,
          inReplyTo: letzteEingangsnachricht?.message_id || undefined,
          references: references.length > 0 ? references : undefined,
          tag: 'manueller_reply-fallback',
          metadata: {
            anfrage_id: anfrage.id,
            betrieb_id: anfrage.betrieb_id,
            manuell: 'true',
            gmail_fallback: 'true',
          },
          attachments: anhaenge.length > 0 ? anhaenge : undefined,
        });
      } else {
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
        subject: betreff,
        bodyText: bodyText,
        replyTo: replyToAddress,
        replyToName: replyToName,
        inReplyTo: letzteEingangsnachricht?.message_id || undefined,
        references: references.length > 0 ? references : undefined,
        tag: 'manueller_reply',
        metadata: {
          anfrage_id: anfrage.id,
          betrieb_id: anfrage.betrieb_id,
          manuell: 'true',
        },
        attachments: anhaenge.length > 0 ? anhaenge : undefined,
      });
    }

    if (!sendResult.success) {
      await supabaseAdmin.from('processing_errors').insert({
        betrieb_id: anfrage.betrieb_id,
        schritt: 'versand_manuell',
        fehler_text: sendResult.error || 'unbekannter Postmark-Fehler',
        fehler_details: { anfrage_id: anfrage.id, error_code: sendResult.errorCode },
      });

      return NextResponse.json(
        { error: sendResult.error, errorCode: sendResult.errorCode },
        { status: 500 }
      );
    }

    // Nachricht in Thread speichern
    const versendetAm = new Date().toISOString();

    const { data: ausgangNachricht, error: ausgangError } = await supabaseAdmin
      .from('nachrichten')
      .insert({
        anfrage_id: anfrage.id,
        betrieb_id: anfrage.betrieb_id,
        typ: 'ausgang',
        von_email: fromEmail,
        von_name: fromName,
        an_email: anfrage.von_email,
        an_name: anfrage.von_name,
        betreff: betreff,
        body_text: bodyText,
        message_id: sendResult.messageId,
        in_reply_to: letzteEingangsnachricht?.message_id || null,
        postmark_message_id: sendResult.postmarkMessageId,
        status: 'versendet',
        versendet_am: versendetAm,
      })
      .select('id')
      .single();

    if (ausgangError) {
      console.error('KRITISCH: Mail raus aber nachrichten-Insert failed:', ausgangError);
      await supabaseAdmin.from('processing_errors').insert({
        betrieb_id: anfrage.betrieb_id,
        anfrage_id: anfrage.id,
        schritt: 'versand_manuell_threading',
        fehler_text: `Mail an ${anfrage.von_email} versendet (Postmark ${sendResult.postmarkMessageId}), aber nachrichten-Insert fehlgeschlagen: ${ausgangError.message}`,
        fehler_details: { postmark_id: sendResult.postmarkMessageId, message_id: sendResult.messageId },
      });
    }

    // Outbound-Anhänge in Storage + anhaenge speichern (verlinkt zur Ausgang-Nachricht)
    if (ausgangNachricht && anhaenge.length > 0) {
      for (const att of anhaenge) {
        const res = await speichereAnhang(att, {
          nachrichtId: ausgangNachricht.id,
          anfrageId: anfrage.id,
          betriebId: anfrage.betrieb_id,
        });
        if (!res.success) {
          console.error(`Outbound-Anhang "${att.name}" fehlgeschlagen:`, res.error);
          await supabaseAdmin.from('processing_errors').insert({
            betrieb_id: anfrage.betrieb_id,
            anfrage_id: anfrage.id,
            schritt: 'attachment_upload_outbound',
            fehler_text: res.error || 'unbekannt',
            fehler_details: { dateiname: att.name, content_type: att.contentType },
          });
        }
      }
    }

    // Anfrage-Status auf 'versendet' setzen (warten auf Kunde)
    const { error: anfrageStatusError } = await supabaseAdmin
      .from('anfragen')
      .update({ status: 'versendet' })
      .eq('id', anfrage.id);

    if (anfrageStatusError) {
      console.error('Anfrage-Status-Update failed:', anfrageStatusError);
      await supabaseAdmin.from('processing_errors').insert({
        betrieb_id: anfrage.betrieb_id,
        anfrage_id: anfrage.id,
        schritt: 'versand_manuell_status',
        fehler_text: anfrageStatusError.message,
      });
    }

    console.log(
      `✓ Manuelle Antwort versendet: ${sendResult.postmarkMessageId} an ${anfrage.von_email} ` +
      `(From: ${fromEmail}, CustomSender: ${useCustomSender})`
    );

    return NextResponse.json({
      success: true,
      message_id: sendResult.messageId,
      postmark_message_id: sendResult.postmarkMessageId,
      empfaenger: anfrage.von_email,
      from: fromEmail,
      custom_sender: useCustomSender,
    });
  } catch (err) {
    console.error('Manueller Versand-Fehler:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}