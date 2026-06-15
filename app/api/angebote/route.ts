import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  generiereAngebotsVorschlag,
  berechneSummen,
  type AngebotPosition,
} from '@/lib/angebot';

/**
 * GET  /api/angebote                → Liste aller Angebote des Betriebs
 * POST /api/angebote                → neues Angebot anlegen
 *     Body: { anfrage_id?: string, ki_generieren?: boolean }
 *
 * Wenn anfrage_id + ki_generieren=true: KI baut Vorschlag aus der
 * Kunden-Anfrage + den Bausteinen/Materialien des Betriebs. Owner
 * setzt danach im Editor jeden Preis frei und ändert was er braucht.
 *
 * Ohne ki_generieren: leeres Angebot anlegen, Owner baut Positionen
 * manuell.
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
    .from('angebote')
    .select(
      `id, titel, status, summe_netto, summe_brutto, angebotsnummer,
       versendet_am, gueltig_bis, created_at, updated_at,
       anfrage_id, anfragen (von_name, von_email, betreff)`
    )
    .eq('betrieb_id', betriebId)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: `Query fehlgeschlagen: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ angebote: data ?? [] });
}

export async function POST(req: NextRequest) {
  const betriebId = await getBetriebId();
  if (!betriebId) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const anfrageId: string | null = body?.anfrage_id ?? null;
  const kiGenerieren: boolean = body?.ki_generieren !== false;

  // Wenn KI-Generierung gewünscht UND eine Anfrage da: alles parallel laden
  let initial: {
    titel: string;
    einleitung: string;
    positionen: AngebotPosition[];
    schlusstext: string;
    summe_netto: number;
    summe_brutto: number;
  } = {
    titel: '',
    einleitung: '',
    positionen: [],
    schlusstext: '',
    summe_netto: 0,
    summe_brutto: 0,
  };

  if (anfrageId && kiGenerieren) {
    const [{ data: anfrage }, { data: betrieb }, { data: bausteine }, { data: materialien }] =
      await Promise.all([
        supabaseAdmin
          .from('anfragen')
          .select('id, betreff, body_text, von_name')
          .eq('id', anfrageId)
          .eq('betrieb_id', betriebId)
          .single(),
        supabaseAdmin
          .from('betriebe')
          .select('id, name, branche, stundensatz')
          .eq('id', betriebId)
          .single(),
        supabaseAdmin
          .from('angebot_bausteine')
          .select('id, bezeichnung, beschreibung, einheit, material_kosten, arbeitszeit_min, kalkulations_faktor')
          .eq('betrieb_id', betriebId)
          .eq('aktiv', true),
        supabaseAdmin
          .from('material_preise')
          .select('bezeichnung, einheit, einkaufspreis')
          .eq('betrieb_id', betriebId),
      ]);

    if (!anfrage) {
      return NextResponse.json(
        { error: 'Anfrage nicht gefunden' },
        { status: 404 }
      );
    }
    if (!betrieb) {
      return NextResponse.json(
        { error: 'Betrieb nicht gefunden' },
        { status: 404 }
      );
    }

    const res = await generiereAngebotsVorschlag({
      anfrage,
      betrieb,
      bausteine: bausteine ?? [],
      materialien: materialien ?? [],
    });
    if (!res.success) {
      return NextResponse.json(
        { error: `KI-Generierung fehlgeschlagen: ${res.error}` },
        { status: 500 }
      );
    }
    const summen = berechneSummen({
      positionen: res.vorschlag.positionen,
      mwst_satz: 19,
    });
    initial = {
      titel: res.vorschlag.titel,
      einleitung: res.vorschlag.einleitung,
      positionen: res.vorschlag.positionen,
      schlusstext: res.vorschlag.schlusstext,
      summe_netto: summen.summe_netto,
      summe_brutto: summen.summe_brutto,
    };
  }

  const { data, error } = await supabaseAdmin
    .from('angebote')
    .insert({
      betrieb_id: betriebId,
      anfrage_id: anfrageId,
      titel: initial.titel || 'Neues Angebot',
      einleitung: initial.einleitung,
      positionen: initial.positionen,
      schlusstext: initial.schlusstext,
      summe_netto: initial.summe_netto,
      summe_brutto: initial.summe_brutto,
      mwst_satz: 19,
      status: 'entwurf',
    })
    .select('id')
    .single();
  if (error) {
    return NextResponse.json(
      { error: `Insert fehlgeschlagen: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true, id: data.id });
}
