import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { berechneSummen, type AngebotPosition } from '@/lib/angebot';

/**
 * PATCH /api/angebote/[id]   → Felder + Positionen updaten
 * DELETE /api/angebote/[id]  → Angebot löschen
 *
 * PATCH-Body akzeptiert:
 *   titel, einleitung, positionen, schlusstext, mwst_satz, status,
 *   angebotsnummer, gueltig_bis, notiz_intern
 *
 * Bei positionen-Update werden summe_netto + summe_brutto automatisch
 * neu gerechnet.
 */

const ERLAUBT = new Set([
  'titel',
  'einleitung',
  'positionen',
  'schlusstext',
  'mwst_satz',
  'status',
  'angebotsnummer',
  'gueltig_bis',
  'notiz_intern',
  'variante',
  'empfaenger_name',
  'empfaenger_firma',
  'empfaenger_email',
  'empfaenger_adresse',
  'empfaenger_plz',
]);

const GUELTIGE_STATUS = new Set(['entwurf', 'versendet', 'angenommen', 'abgelehnt']);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body fehlt' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ERLAUBT.has(k)) continue;
    if (k === 'status') {
      if (typeof v !== 'string' || !GUELTIGE_STATUS.has(v)) continue;
    }
    if (k === 'positionen' && Array.isArray(v)) {
      const normiert = (v as AngebotPosition[]).map((p, i) => {
        const menge = Math.max(0, Number(p.menge) || 0);
        const einzel = Math.max(0, Number(p.einzelpreis_netto) || 0);
        return {
          pos: i + 1,
          bezeichnung: String(p.bezeichnung ?? '').slice(0, 200),
          beschreibung: p.beschreibung ? String(p.beschreibung).slice(0, 1000) : undefined,
          menge,
          einheit: String(p.einheit ?? 'Stk').slice(0, 20),
          einzelpreis_netto: round2(einzel),
          gesamtpreis_netto: round2(menge * einzel),
          ki_schaetzpreis: p.ki_schaetzpreis,
          baustein_id: p.baustein_id ?? null,
        };
      });
      update.positionen = normiert;
      const mwst = Number(body.mwst_satz) || 19;
      const summen = berechneSummen({ positionen: normiert, mwst_satz: mwst });
      update.summe_netto = summen.summe_netto;
      update.summe_brutto = summen.summe_brutto;
      continue;
    }
    if (k === 'mwst_satz') {
      update[k] = Math.max(0, Number(v) || 0);
      continue;
    }
    update[k] = v;
  }

  // Wenn Status auf "versendet" gesetzt wird, versendet_am stempeln
  if (update.status === 'versendet') {
    update.versendet_am = new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from('angebote')
    .update(update)
    .eq('id', id)
    .eq('betrieb_id', betriebId);
  if (error) {
    return NextResponse.json(
      { error: `Update fehlgeschlagen: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { error } = await supabaseAdmin
    .from('angebote')
    .delete()
    .eq('id', id)
    .eq('betrieb_id', betriebId);
  if (error) {
    return NextResponse.json(
      { error: `Löschen fehlgeschlagen: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
