import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generiereEntwurf } from '@/lib/entwurf';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const anfrageId: string | undefined = body.anfrage_id;

    // Anfrage holen
    let anfrageQuery;
    if (anfrageId) {
      anfrageQuery = supabaseAdmin
        .from('anfragen')
        .select('id, betrieb_id, von_email, von_name, betreff, body_text, body_text_clean')
        .eq('id', anfrageId)
        .limit(1);
    } else {
      anfrageQuery = supabaseAdmin
        .from('anfragen')
        .select('id, betrieb_id, von_email, von_name, betreff, body_text, body_text_clean')
        .order('created_at', { ascending: false })
        .limit(1);
    }

    const { data: anfragen, error: anfrageError } = await anfrageQuery;

    if (anfrageError || !anfragen || anfragen.length === 0) {
      return NextResponse.json(
        { error: 'Keine Anfrage gefunden', details: anfrageError?.message },
        { status: 404 }
      );
    }

    const anfrage = anfragen[0];

    // Klassifikation holen (Zeit-Spalte heißt analysiert_am)
    const { data: klassifikation, error: klassError } = await supabaseAdmin
      .from('analysen')
      .select('*')
      .eq('anfrage_id', anfrage.id)
      .order('analysiert_am', { ascending: false })
      .limit(1)
      .single();

    if (klassError || !klassifikation) {
      return NextResponse.json(
        { error: 'Keine Klassifikation für diese Anfrage gefunden – erst klassifizieren', details: klassError?.message },
        { status: 404 }
      );
    }

    // Betrieb holen
    const { data: betrieb, error: betriebError } = await supabaseAdmin
      .from('betriebe')
      .select(
        'id, name, inhaber, branche, was_wir_machen, was_wir_nicht_machen, region, mindestauftragswert, ton_beispiele, signatur'
      )
      .eq('id', anfrage.betrieb_id)
      .single();

    if (betriebError || !betrieb) {
      return NextResponse.json(
        { error: 'Betrieb nicht gefunden', details: betriebError?.message },
        { status: 404 }
      );
    }

    // Entwurf generieren
    const result = await generiereEntwurf(anfrage, klassifikation, betrieb);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      anfrage_id: anfrage.id,
      betreff_anfrage: anfrage.betreff,
      klassifikation: {
        kategorie: klassifikation.kategorie,
        gewerk_match: klassifikation.gewerk_match,
      },
      entwurf: result.entwurf,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'test-entwurf endpoint ready' });
}