import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/profil/tag-regeln       → alle Regeln des Betriebs
 * POST /api/profil/tag-regeln      → neue Regel anlegen { sender_pattern, tag }
 */

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('betrieb_id')
    .eq('id', user.id)
    .single();
  const betriebId = profile?.betrieb_id;
  if (!betriebId) {
    return NextResponse.json({ regeln: [] });
  }

  const { data: regeln, error } = await supabaseAdmin
    .from('tag_regeln')
    .select('id, sender_pattern, tag, created_at')
    .eq('betrieb_id', betriebId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: `Query fehlgeschlagen: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ regeln: regeln ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('betrieb_id')
    .eq('id', user.id)
    .single();
  const betriebId = profile?.betrieb_id;
  if (!betriebId) {
    return NextResponse.json({ error: 'Kein Betrieb verknüpft' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const sender_pattern =
    typeof body?.sender_pattern === 'string'
      ? body.sender_pattern.trim().toLowerCase()
      : '';
  const tag = typeof body?.tag === 'string' ? body.tag.trim() : '';
  if (!sender_pattern || !tag) {
    return NextResponse.json(
      { error: 'sender_pattern und tag sind pflicht' },
      { status: 400 }
    );
  }
  if (sender_pattern.length > 200 || tag.length > 60) {
    return NextResponse.json(
      { error: 'sender_pattern (max 200) oder tag (max 60) zu lang' },
      { status: 400 }
    );
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('tag_regeln')
    .insert({
      betrieb_id: betriebId,
      sender_pattern,
      tag,
    })
    .select('id, sender_pattern, tag, created_at')
    .single();

  if (error) {
    // UNIQUE-Constraint-Verletzung sauber zurückgeben
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Regel existiert bereits' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: `Insert fehlgeschlagen: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, regel: inserted });
}
