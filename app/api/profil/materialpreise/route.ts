import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET  /api/profil/materialpreise
 * POST /api/profil/materialpreise
 *
 * Material-Einkaufspreise pro Betrieb. Felder:
 *   bezeichnung (required), artikelnummer, einheit (Stk default),
 *   einkaufspreis, lieferant, preis_stand, notiz
 */

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
    .from('material_preise')
    .select(
      'id, bezeichnung, artikelnummer, einheit, einkaufspreis, lieferant, preis_stand, notiz, created_at'
    )
    .eq('betrieb_id', betriebId)
    .order('bezeichnung', { ascending: true });
  if (error) {
    return NextResponse.json(
      { error: `Query fehlgeschlagen: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ materialien: data ?? [] });
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

  const insert = {
    betrieb_id: betriebId,
    bezeichnung,
    artikelnummer:
      typeof body?.artikelnummer === 'string'
        ? body.artikelnummer.trim() || null
        : null,
    einheit:
      typeof body?.einheit === 'string' && body.einheit.length > 0
        ? body.einheit
        : 'Stk',
    einkaufspreis: clampNum(body?.einkaufspreis, 0),
    lieferant:
      typeof body?.lieferant === 'string' ? body.lieferant.trim() || null : null,
    preis_stand:
      typeof body?.preis_stand === 'string' && body.preis_stand.length > 0
        ? body.preis_stand
        : new Date().toISOString().slice(0, 10),
    notiz:
      typeof body?.notiz === 'string' ? body.notiz.trim() || null : null,
  };

  const { data, error } = await supabaseAdmin
    .from('material_preise')
    .insert(insert)
    .select(
      'id, bezeichnung, artikelnummer, einheit, einkaufspreis, lieferant, preis_stand, notiz, created_at'
    )
    .single();
  if (error) {
    return NextResponse.json(
      { error: `Insert fehlgeschlagen: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true, material: data });
}

function clampNum(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}
