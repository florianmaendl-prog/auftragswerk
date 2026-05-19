import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Postmark Inbound Format parsen
    const vonEmail = payload.FromFull?.Email || payload.From || 'unbekannt@example.com';
    const vonName = payload.FromFull?.Name || '';
    const betreff = payload.Subject || '(kein Betreff)';
    const bodyText = payload.TextBody || '';
    const bodyHtml = payload.HtmlBody || '';

    // Empfänger-Adresse aus dem Payload (z.B. max@inbound.auftragswerk.app)
    // Daraus erkennen wir später, zu welchem Betrieb die Mail gehört
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

    // Anfrage in DB speichern
    const { data, error } = await supabaseAdmin
      .from('anfragen')
      .insert({
        betrieb_id: betrieb.id,
        kanal: 'mail',
        von_email: vonEmail,
        von_name: vonName,
        betreff: betreff,
        body_text: bodyText,
        body_html: bodyHtml,
        raw_payload: payload,
        status: 'neu',
      })
      .select()
      .single();

    if (error) {
      console.error('DB Fehler:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Anfrage gespeichert:', data.id);

    // TODO: Hier kommt später der Claude-Call (Klassifikation + Entwurf)
    // Das machen wir an Tag 2

    return NextResponse.json({ success: true, anfrage_id: data.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    console.error('Webhook Fehler:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Für Health-Checks
export async function GET() {
  return NextResponse.json({ status: 'webhook ready' });
}
