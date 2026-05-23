import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/termine
 * Body: { anfrage_id, slots: [{ datum: ISO, ort?, notiz?, dauer_min? }] }
 *
 * Speichert 1..n Termine im Status 'vorgeschlagen', verknüpft mit der Anfrage.
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
    const slots: Array<{ datum: string; ort?: string; notiz?: string; dauer_min?: number }> =
      Array.isArray(body.slots) ? body.slots : [];

    if (!anfrageId || slots.length === 0) {
      return NextResponse.json(
        { error: 'anfrage_id und slots[] sind pflicht' },
        { status: 400 }
      );
    }

    // Anfrage holen + Zugriff prüfen via RLS-Client
    const { data: anfrage } = await supabase
      .from('anfragen')
      .select('id, betrieb_id')
      .eq('id', anfrageId)
      .single();

    if (!anfrage) {
      return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 });
    }

    const rows = slots
      .filter((s) => s.datum && s.datum.trim().length > 0)
      .map((s) => ({
        anfrage_id: anfrageId,
        betrieb_id: anfrage.betrieb_id,
        datum: new Date(s.datum).toISOString(),
        dauer_min: s.dauer_min ?? 60,
        ort: s.ort?.trim() || null,
        notiz: s.notiz?.trim() || null,
        status: 'vorgeschlagen' as const,
      }));

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Kein gültiger Slot übergeben' }, { status: 400 });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('termine')
      .insert(rows)
      .select('id, datum, dauer_min, ort, notiz, status');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, termine: inserted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unbekannt' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/termine
 * Body: { termin_id, action: 'bestaetigen' | 'absagen' | 'absolviert' }
 *
 * 'bestaetigen': diesen Termin → 'bestaetigt', alle anderen 'vorgeschlagen'-Termine
 * derselben Anfrage → 'abgesagt'.
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    const body = await req.json();
    const terminId: string | undefined = body.termin_id;
    const action: string = body.action;

    if (!terminId || !['bestaetigen', 'absagen', 'absolviert'].includes(action)) {
      return NextResponse.json(
        { error: 'termin_id und gültige action sind pflicht' },
        { status: 400 }
      );
    }

    // Termin holen (RLS-Client prüft Zugriff)
    const { data: termin } = await supabase
      .from('termine')
      .select('id, anfrage_id, betrieb_id')
      .eq('id', terminId)
      .single();

    if (!termin) {
      return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 404 });
    }

    const neuerStatus =
      action === 'bestaetigen'
        ? 'bestaetigt'
        : action === 'absagen'
        ? 'abgesagt'
        : 'absolviert';

    await supabaseAdmin.from('termine').update({ status: neuerStatus }).eq('id', terminId);

    // Beim Bestätigen: alle anderen vorgeschlagenen Termine zur selben Anfrage absagen
    if (action === 'bestaetigen') {
      await supabaseAdmin
        .from('termine')
        .update({ status: 'abgesagt' })
        .eq('anfrage_id', termin.anfrage_id)
        .eq('status', 'vorgeschlagen')
        .neq('id', terminId);
    }

    return NextResponse.json({ success: true, status: neuerStatus });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unbekannt' },
      { status: 500 }
    );
  }
}
