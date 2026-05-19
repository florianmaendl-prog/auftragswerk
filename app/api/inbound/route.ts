import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cleanMail } from '@/lib/mail-cleaner';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Postmark Inbound Format parsen
    const vonEmail = payload.FromFull?.Email || payload.From || 'unbekannt@example.com';
    const vonName = payload.FromFull?.Name || '';
    const betreff = payload.Subject || '(kein Betreff)';
    const bodyText = payload.TextBody || '';
    const bodyHtml = payload.HtmlBody || '';
    const toEmail = payload.ToFull?.[0]?.Email || payload.To || '';

    // Betrieb anhand der inbound_email finden
    const { data: betrieb } = await supabaseAdmin
      .from('betriebe')
      .select('id')
      .eq('inbound_email', toEmail)
      .single();

    if (!betrieb) {
      console.warn('Kein Betrieb für inbound_email gefunden:', toEmail);
      return NextResponse.json(
        { error: 'Kein Betrieb für diese Adresse konfiguriert' },
        { status: 404 }
      );
    }

    // 🆕 Mail säubern
    const cleaned = cleanMail(bodyText, bodyHtml);
    console.log(
      `Mail gesäubert: ${cleaned.original_length} → ${cleaned.cleaned_length} Zeichen ` +
      `(-${cleaned.reduction_percent}%), Sprache: ${cleaned.detected_language}`
    );

    // Anfrage in DB speichern (jetzt mit cleaned_text in raw_payload)
    const { data, error } = await supabaseAdmin
      .from('anfragen')
      .insert({
        betrieb_id: betrieb.id,
        kanal: 'mail',
        von_email: vonEmail,
        von_name: vonName,
        betreff: betreff,
        body_text: cleaned.cleaned_text, // 🆕 gesäuberter Text
        body_html: bodyHtml,
        raw_payload: {
          ...payload,
          _cleaner_meta: {
            original_length: cleaned.original_length,
            cleaned_length: cleaned.cleaned_length,
            reduction_percent: cleaned.reduction_percent,
            has_quoted_content: cleaned.has_quoted_content,
            has_signature: cleaned.has_signature,
            detected_language: cleaned.detected_language,
          },
        },
        status: 'neu',
      })
      .select()
      .single();

    if (error) {
      console.error('DB Fehler:', error);
      
      // 🆕 Fehler protokollieren
      await supabaseAdmin.from('processing_errors').insert({
        betrieb_id: betrieb.id,
        schritt: 'mail_parse',
        fehler_text: error.message,
        fehler_details: { payload_sample: { from: vonEmail, subject: betreff } },
      });
      
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Anfrage gespeichert:', data.id);

    // TODO Phase A Schritt 3: Hier kommt der Claude-Call (Klassifikation)
    // TODO Phase B: Antwortentwurf generieren

    return NextResponse.json({ 
      success: true, 
      anfrage_id: data.id,
      cleaner_stats: {
        reduction_percent: cleaned.reduction_percent,
        language: cleaned.detected_language,
      },
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
