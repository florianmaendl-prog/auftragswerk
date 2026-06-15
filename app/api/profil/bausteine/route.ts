import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET  /api/profil/bausteine        → Liste aller aktiven Bausteine
 * POST /api/profil/bausteine        → neuen Baustein anlegen
 *
 * Felder:
 *   bezeichnung (required), beschreibung, einheit (default Stk),
 *   material_kosten (€/Einheit), arbeitszeit_min, kalkulations_faktor,
 *   kategorie (optional, für spätere Gruppierung)
 */

const ERLAUBTE_EINHEITEN = ['Stk', 'm', 'm²', 'm³', 'h', 'pauschal'];

async function getBetriebId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('betrieb_id')
    .eq('id', user.id)
    .single();
  return (profile?.betrieb_id as string | null) ?? null;
}

export async function GET() {
  const betriebId = await getBetriebId();
  if (!betriebId) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('angebot_bausteine')
    .select(
      'id, kategorie, bezeichnung, beschreibung, einheit, material_kosten, arbeitszeit_min, kalkulations_faktor, aktiv, created_at'
    )
    .eq('betrieb_id', betriebId)
    .eq('aktiv', true)
    .order('kategorie', { ascending: true, nullsFirst: false })
    .order('bezeichnung', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: `Query fehlgeschlagen: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ bausteine: data ?? [] });
}

export async function POST(req: NextRequest) {
  const betriebId = await getBetriebId();
  if (!betriebId) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const bezeichnung =
    typeof body?.bezeichnung === 'string' ? body.bezeichnung.trim() : '';
  if (!bezeichnung) {
    return NextResponse.json(
      { error: 'bezeichnung ist pflicht' },
      { status: 400 }
    );
  }

  const einheit =
    typeof body?.einheit === 'string' && ERLAUBTE_EINHEITEN.includes(body.einheit)
      ? body.einheit
      : 'Stk';

  const insert = {
    betrieb_id: betriebId,
    kategorie:
      typeof body?.kategorie === 'string' && body.kategorie.trim().length > 0
        ? body.kategorie.trim()
        : null,
    bezeichnung,
    beschreibung:
      typeof body?.beschreibung === 'string'
        ? body.beschreibung.trim() || null
        : null,
    einheit,
    material_kosten: clampNum(body?.material_kosten, 0),
    arbeitszeit_min: Math.max(0, Math.round(Number(body?.arbeitszeit_min ?? 0))),
    kalkulations_faktor: clampNum(body?.kalkulations_faktor, 1),
  };

  const { data, error } = await supabaseAdmin
    .from('angebot_bausteine')
    .insert(insert)
    .select(
      'id, kategorie, bezeichnung, beschreibung, einheit, material_kosten, arbeitszeit_min, kalkulations_faktor, aktiv, created_at'
    )
    .single();
  if (error) {
    return NextResponse.json(
      { error: `Insert fehlgeschlagen: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true, baustein: data });
}

function clampNum(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}
