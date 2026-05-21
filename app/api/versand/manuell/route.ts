import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendMail } from '@/lib/postmark';

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

    if (!anfrageId || !betreff || !bodyText) {
      return NextResponse.json(
        { error: 'anfrage_id, betreff und body_text sind pflicht' },
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

    // Betrieb holen (mit Custom-Sender-Feldern)
    const { data: betrieb } = await supabaseAdmin
      .from('betriebe')
      .select('inbound_email, name, sender_email, sender_name, sender_verified')
      .eq('id', anfrage.betrieb_id)
      .single();

    // From-Adresse bestimmen
    const useCustomSender = Boolean(
      betrieb?.sender_verified && betrieb?.sender_email
    );
    const fromEmail = useCustomSender
      ? betrieb!.sender_email!
      : process.env.POSTMARK_FROM_EMAIL || 'info@auftragswerk.app';
    const fromName = useCustomSender
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

    // Reply-To Adresse
    const replyToAddress =
      betrieb?.inbound_email || process.env.POSTMARK_REPLY_TO || undefined;
    const replyToName = betrieb?.name || fromName;

    // Mail versenden
    const sendResult = await sendMail({
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
    });

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

    await supabaseAdmin.from('nachrichten').insert({
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
    });

    // Anfrage-Status auf 'versendet' setzen (warten auf Kunde)
    await supabaseAdmin
      .from('anfragen')
      .update({ status: 'versendet' })
      .eq('id', anfrage.id);

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