import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/verfuegbarkeit/regel
 * Body: { wochentag (1-7), start_uhrzeit "HH:MM", ende_uhrzeit "HH:MM", aktiv? }
 * Optional: id für Update.
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
    const id: string | undefined = body.id;
    const wochentag = Number(body.wochentag);
    const start_uhrzeit: string | undefined = body.start_uhrzeit;
    const ende_uhrzeit: string | undefined = body.ende_uhrzeit;
    const aktiv: boolean = body.aktiv ?? true;

    if (
      !Number.isInteger(wochentag) ||
      wochentag < 1 ||
      wochentag > 7 ||
      !start_uhrzeit ||
      !ende_uhrzeit
    ) {
      return NextResponse.json(
        { error: 'wochentag (1-7), start_uhrzeit, ende_uhrzeit sind pflicht' },
        { status: 400 }
      );
    }

    if (start_uhrzeit >= ende_uhrzeit) {
      return NextResponse.json(
        { error: 'start_uhrzeit muss vor ende_uhrzeit liegen' },
        { status: 400 }
      );
    }

    // betrieb_id über profiles holen
    const { data: profile } = await supabase
      .from('profiles')
      .select('betrieb_id')
      .eq('id', user.id)
      .single();

    const betriebId = profile?.betrieb_id as string | null | undefined;
    if (!betriebId) {
      return NextResponse.json({ error: 'Kein Betrieb verknüpft' }, { status: 400 });
    }

    if (id) {
      const { data, error } = await supabaseAdmin
        .from('verfuegbarkeit_regel')
        .update({ wochentag, start_uhrzeit, ende_uhrzeit, aktiv })
        .eq('id', id)
        .eq('betrieb_id', betriebId)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, regel: data });
    }

    const { data, error } = await supabaseAdmin
      .from('verfuegbarkeit_regel')
      .insert({ betrieb_id: betriebId, wochentag, start_uhrzeit, ende_uhrzeit, aktiv })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, regel: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unbekannt' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/verfuegbarkeit/regel?id=<uuid>
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
      .from('verfuegbarkeit_regel')
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
