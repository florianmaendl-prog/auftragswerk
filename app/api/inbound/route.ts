import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cleanMail } from '@/lib/mail-cleaner';

// Schwelle: ab dieser Mail-Länge nutzen wir den Cleaner für Claude-Input
const CLEAN_THRESHOLD = 3000;

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

    // Cleaner-Logik: NUR bei riesigen Mails als Fallback für Claude-Input
    // Original-Mail bleibt IMMER in body_text erhalten (für Max im Dashboard)
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
      console.log(
        `Mail über Schwelle (${bodyText.length} Zeichen) - Cleaner aktiv: ` +
        `${cleaned.original_length} → ${cleaned.cleaned_length} (-${cleaned.reduction_percent}%)`
      );
    }

    // Anfrage in DB speichern – ORIGINAL bleibt in body_text
    const { data, error } = await supabaseAdmin
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
        raw_payload: cleanerMeta
          ? { ...payload, _cleaner_meta: cleanerMeta }
          : payload,
        status: 'neu',
      })
      .select()
      .single();

    if (error) {
      console.error('DB Fehler:', error);

      await supabaseAdmin.from('processing_errors').insert({
        betrieb_id: betrieb.id,
        schritt: 'mail_parse',
        fehler_text: error.message,
        fehler_details: { payload_sample: { from: vonEmail, subject: betreff } },
      });

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Anfrage gespeichert:', data.id);

    return NextResponse.json({
      success: true,
      anfrage_id: data.id,
      original_length: bodyText.length,
      cleaner_used: bodyTextClean !== null,
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