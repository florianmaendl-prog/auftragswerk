import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { klassifiziereAnfrage } from '@/lib/klassifikation';

export async function POST(req: NextRequest) {
  try {
    let anfrageId: string | undefined;
    try {
      const body = await req.json();
      anfrageId = body.anfrage_id;
    } catch {
      // kein Body, ok
    }

    const query = supabaseAdmin
      .from('anfragen')
      .select('id, betrieb_id, von_email, von_name, betreff, body_text, body_text_clean');

    const { data: anfrage, error: anfrageError } = anfrageId
      ? await query.eq('id', anfrageId).single()
      : await query.order('created_at', { ascending: false }).limit(1).single();

    if (anfrageError || !anfrage) {
      return NextResponse.json(
        { error: 'Anfrage nicht gefunden', details: anfrageError?.message },
        { status: 404 }
      );
    }

    const { data: betrieb, error: betriebError } = await supabaseAdmin
      .from('betriebe')
      .select('id, name, branche, was_wir_machen, was_wir_nicht_machen, region, mindestauftragswert')
      .eq('id', anfrage.betrieb_id)
      .single();

    if (betriebError || !betrieb) {
      return NextResponse.json(
        { error: 'Betrieb nicht gefunden', details: betriebError?.message },
        { status: 404 }
      );
    }

    const result = await klassifiziereAnfrage(anfrage, betrieb);

    return NextResponse.json({
      success: result.success,
      anfrage_id: anfrage.id,
      betreff: anfrage.betreff,
      klassifikation: result.klassifikation,
      error: result.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'klassifikation test endpoint ready',
    usage: 'POST mit Body { anfrage_id: "..." } oder ohne Body fuer neueste Anfrage',
  });
}
