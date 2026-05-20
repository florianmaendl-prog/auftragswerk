import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cleanMail } from '@/lib/mail-cleaner';
import { klassifiziereAnfrage } from '@/lib/klassifikation';
import { generiereEntwurf } from '@/lib/entwurf';

const CLEAN_THRESHOLD = 3000;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  console.log('DEBUG: Webhook v4 (Klassifikation + Entwurf)');
  try {
    const payload = await req.json();

    const vonEmail = payload.FromFull?.Email || payload.From || 'unbekannt@example.com';
    const vonName = payload.FromFull?.Name || '';
    const betreff = payload.Subject || '(kein Betreff)';
    const bodyText = payload.TextBody || '';
    const bodyHtml = payload.HtmlBody || '';
    const toEmail = payload.ToFull?.[0]?.Email || payload.To || '';

    // Betrieb finden
    const { data: betrieb } = await supabaseAdmin
      .from('betriebe')
      .select(
        'id, name, inhaber, branche, was_wir_machen, was_wir_nicht_machen, region, mindestauftragswert, ton_beispiele, signatur'
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

    // Anfrage in DB speichern – ORIGINAL bleibt in body_text
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
        raw_payload: cleanerMeta
          ? { ...payload, _cleaner_meta: cleanerMeta }
          : payload,
        status: 'neu',
      })
      .select()
      .single();

    if (insertError) {
      console.error('DB Fehler:', insertError);

      await supabaseAdmin.from('processing_errors').insert({
        betrieb_id: betrieb.id,
        schritt: 'mail_parse',
        fehler_text: insertError.message,
        fehler_details: { payload_sample: { from: vonEmail, subject: betreff } },
      });

      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log('Anfrage gespeichert:', anfrage.id);

    // SCHRITT 1: Klassifikation (synchron – Vercel killt sonst nach return)
    const klassRes = await klassifiziereAnfrage(
      {
        id: anfrage.id,
        von_email: anfrage.von_email,
        von_name: anfrage.von_name,
        betreff: anfrage.betreff,
        body_text: anfrage.body_text,
        body_text_clean: anfrage.body_text_clean,
      },
      betrieb
    );

    if (!klassRes.success) {
      console.error(`✗ Klassifikation fehlgeschlagen für ${anfrage.id}: ${klassRes.error}`);
      return NextResponse.json({
        success: true,
        anfrage_id: anfrage.id,
        klassifikation: 'fehlgeschlagen',
        entwurf: 'übersprungen',
      });
    }

    console.log(`✓ Klassifikation fertig für ${anfrage.id}: ${klassRes.klassifikation?.kategorie}`);

    // SCHRITT 2: Entwurf NUR bei Kundenanfragen
    let entwurfStatus = 'nicht_relevant';

    if (klassRes.klassifikation?.kategorie === 'kundenanfrage') {
      // Klassifikation aus DB holen (mit ID für analyse_id Verknüpfung)
      const { data: klassifikation } = await supabaseAdmin
        .from('analysen')
        .select('*')
        .eq('anfrage_id', anfrage.id)
        .order('analysiert_am', { ascending: false })
        .limit(1)
        .single();

      if (klassifikation) {
        const entwurfRes = await generiereEntwurf(anfrage, klassifikation, betrieb);

        if (entwurfRes.success) {
          console.log(`✓ Entwurf fertig für ${anfrage.id}`);
          entwurfStatus = 'erstellt';
        } else {
          console.error(`✗ Entwurf fehlgeschlagen für ${anfrage.id}: ${entwurfRes.error}`);
          entwurfStatus = 'fehlgeschlagen';
        }
      }
    } else {
      console.log(`Kein Entwurf nötig (Kategorie: ${klassRes.klassifikation?.kategorie})`);
    }

    return NextResponse.json({
      success: true,
      anfrage_id: anfrage.id,
      kategorie: klassRes.klassifikation?.kategorie,
      gewerk_match: klassRes.klassifikation?.gewerk_match,
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