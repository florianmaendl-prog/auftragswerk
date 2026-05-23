import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendMail } from '@/lib/postmark';
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

    // 4. Anfrage holen
    const { data: anfrage } = await supabase
      .from('anfragen')
      .select('id, von_email, von_name')
      .eq('id', entwurf.anfrage_id)
      .single();

    if (!anfrage) {
      return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 });
    }

    // 5. Betrieb holen (mit Custom-Sender-Feldern)
    const { data: betrieb } = await supabaseAdmin
      .from('betriebe')
      .select('inbound_email, name, sender_email, sender_name, sender_verified')
      .eq('id', entwurf.betrieb_id)
      .single();

    // 6. From-Adresse bestimmen
    //    Priorität: betrieb.sender_email (wenn verified)
    //    Fallback: POSTMARK_FROM_EMAIL aus Env
    const useCustomSender = Boolean(
      betrieb?.sender_verified && betrieb?.sender_email
    );
    const fromEmail = useCustomSender
      ? betrieb!.sender_email!
      : process.env.POSTMARK_FROM_EMAIL || 'info@auftragswerk.app';
    const fromName = useCustomSender
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

    // 9. Reply-To bestimmen (Postmark-Inbound-Adresse für Threading-Returns)
    const replyToAddress =
      betrieb?.inbound_email || process.env.POSTMARK_REPLY_TO || undefined;
    const replyToName = betrieb?.name || fromName;

    // 10. Mail versenden via Postmark
    const sendResult = await sendMail({
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

    if (!sendResult.success) {
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

    // 12. Entwurf-Status updaten
    await supabaseAdmin
      .from('entwuerfe')
      .update({
        status: 'versendet',
        postmark_message_id: sendResult.postmarkMessageId,
        versendet_am: versendetAm,
        updated_at: versendetAm,
      })
      .eq('id', entwurf.id);

    // 13. Anfrage-Status updaten → 'versendet'
    await supabaseAdmin
      .from('anfragen')
      .update({ status: 'versendet' })
      .eq('id', anfrage.id);

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