import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendMail } from '@/lib/postmark';

export const maxDuration = 30;

/**
 * POST /api/versand
 * Body: { entwurf_id: string }
 *
 * Versendet einen Entwurf via Postmark.
 * Speichert die versendete Nachricht in nachrichten-Tabelle für Threading.
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

    // 4. Anfrage holen für Empfänger
    const { data: anfrage } = await supabase
      .from('anfragen')
      .select('id, von_email, von_name')
      .eq('id', entwurf.anfrage_id)
      .single();

    if (!anfrage) {
      return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 });
    }

    // 5. Letzte eingehende Nachricht holen für Threading (In-Reply-To)
    const { data: letzteEingangsnachricht } = await supabase
      .from('nachrichten')
      .select('message_id')
      .eq('anfrage_id', anfrage.id)
      .eq('typ', 'eingang')
      .order('erstellt_am', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 6. Komplette Thread-References holen
    const { data: alleNachrichten } = await supabase
      .from('nachrichten')
      .select('message_id')
      .eq('anfrage_id', anfrage.id)
      .not('message_id', 'is', null)
      .order('erstellt_am', { ascending: true });

    const references = (alleNachrichten || [])
      .map((n) => n.message_id)
      .filter((id): id is string => Boolean(id));

    // 7. Mail versenden via Postmark
    const sendResult = await sendMail({
      to: anfrage.von_email,
      toName: anfrage.von_name || undefined,
      subject: entwurf.betreff_vorschlag,
      bodyText: entwurf.body_text,
      inReplyTo: letzteEingangsnachricht?.message_id || undefined,
      references: references.length > 0 ? references : undefined,
      tag: 'antwortentwurf',
      metadata: {
        anfrage_id: anfrage.id,
        entwurf_id: entwurf.id,
        betrieb_id: entwurf.betrieb_id,
      },
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

    // 8. Versendete Nachricht in nachrichten-Tabelle speichern
    //    Service-Role um sicher zu inserten unabhängig von RLS
    const versendetAm = new Date().toISOString();
    const fromEmail = process.env.POSTMARK_FROM_EMAIL || 'info@auftragswerk.app';
    const fromName = process.env.POSTMARK_FROM_NAME || 'Auftragswerk';

    const { error: nachrichtError } = await supabaseAdmin.from('nachrichten').insert({
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
    });

    if (nachrichtError) {
      console.error('Nachricht-Insert-Fehler (Mail wurde aber versendet):', nachrichtError);
    }

    // 9. Entwurf-Status updaten
    await supabaseAdmin
      .from('entwuerfe')
      .update({
        status: 'versendet',
        postmark_message_id: sendResult.postmarkMessageId,
        versendet_am: versendetAm,
        updated_at: versendetAm,
      })
      .eq('id', entwurf.id);

    // 10. Anfrage-Status updaten → 'versendet' damit sie im Versendet-Tab erscheint
    await supabaseAdmin
      .from('anfragen')
      .update({ status: 'versendet' })
      .eq('id', anfrage.id);

    console.log(`✓ Mail versendet: ${sendResult.postmarkMessageId} an ${anfrage.von_email}`);

    return NextResponse.json({
      success: true,
      message_id: sendResult.messageId,
      postmark_message_id: sendResult.postmarkMessageId,
      empfaenger: anfrage.von_email,
    });
  } catch (err) {
    console.error('Versand-Fehler:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}