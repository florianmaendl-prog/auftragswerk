import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/verfuegbarkeit/sperre
 * Body: { datum_von: ISO, datum_bis: ISO, grund? }
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
    const datum_von: string | undefined = body.datum_von;
    const datum_bis: string | undefined = body.datum_bis;
    const grund: string | undefined = body.grund;

    if (!datum_von || !datum_bis) {
      return NextResponse.json(
        { error: 'datum_von + datum_bis (ISO-Strings) sind pflicht' },
        { status: 400 }
      );
    }

    const vonMs = new Date(datum_von).getTime();
    const bisMs = new Date(datum_bis).getTime();
    if (!(vonMs < bisMs)) {
      return NextResponse.json(
        { error: 'datum_von muss vor datum_bis liegen' },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('betrieb_id')
      .eq('id', user.id)
      .single();
    const betriebId = profile?.betrieb_id as string | null | undefined;
    if (!betriebId) {
      return NextResponse.json({ error: 'Kein Betrieb verknüpft' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('verfuegbarkeit_sperre')
      .insert({
        betrieb_id: betriebId,
        datum_von: new Date(datum_von).toISOString(),
        datum_bis: new Date(datum_bis).toISOString(),
        grund: grund?.trim() || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, sperre: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unbekannt' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/verfuegbarkeit/sperre?id=<uuid>
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id-Query-Param fehlt' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('betrieb_id')
      .eq('id', user.id)
      .single();
    const betriebId = profile?.betrieb_id as string | null | undefined;
    if (!betriebId) {
      return NextResponse.json({ error: 'Kein Betrieb verknüpft' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('verfuegbarkeit_sperre')
      .delete()
      .eq('id', id)
      .eq('betrieb_id', betriebId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unbekannt' },
      { status: 500 }
    );
  }
}
