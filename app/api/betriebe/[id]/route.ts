import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// Welche Felder dürfen via API geupdated werden
const ERLAUBTE_FELDER = [
  'name',
  'inhaber',
  'branche',
  'region',
  'mindestauftragswert',
  'was_wir_machen',
  'was_wir_nicht_machen',
  'wichtige_kunden',
  'signatur',
  'ton_beispiele',
  'vermeiden',
] as const;

type ErlaubtesFeld = (typeof ERLAUBTE_FELDER)[number];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('betriebe')
    .select(
      'id, name, inhaber, branche, inbound_email, region, mindestauftragswert, was_wir_machen, was_wir_nicht_machen, wichtige_kunden, signatur, ton_beispiele, vermeiden'
    )
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || 'Betrieb nicht gefunden' },
      { status: 404 }
    );
  }

  return NextResponse.json({ betrieb: data });
}

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
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
  }

  let body: Partial<Record<ErlaubtesFeld, unknown>>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalides JSON' }, { status: 400 });
  }

  // Nur erlaubte Felder durchlassen + Typ-Validierung
  const update: Record<string, unknown> = {};
  for (const feld of ERLAUBTE_FELDER) {
    if (!(feld in body)) continue;
    const wert = body[feld];

    // Array-Felder
    if (
      ['was_wir_machen', 'was_wir_nicht_machen', 'wichtige_kunden', 'ton_beispiele'].includes(
        feld
      )
    ) {
      if (!Array.isArray(wert)) {
        return NextResponse.json(
          { error: `Feld '${feld}' muss ein Array sein` },
          { status: 400 }
        );
      }
      // String-Array – alles in Strings konvertieren und leere Strings rauswerfen
      update[feld] = (wert as unknown[])
        .map((v) => (typeof v === 'string' ? v.trim() : String(v)))
        .filter((v) => v.length > 0);
      continue;
    }

    // Number-Feld
    if (feld === 'mindestauftragswert') {
      if (wert === null || wert === '') {
        update[feld] = null;
      } else {
        const num = Number(wert);
        if (Number.isNaN(num) || num < 0) {
          return NextResponse.json(
            { error: 'mindestauftragswert muss eine positive Zahl sein' },
            { status: 400 }
          );
        }
        update[feld] = num;
      }
      continue;
    }

    // Text-Felder
    if (typeof wert !== 'string' && wert !== null) {
      return NextResponse.json(
        { error: `Feld '${feld}' muss Text sein` },
        { status: 400 }
      );
    }
    update[feld] = wert === null ? null : (wert as string).trim();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: 'Keine gültigen Felder zum Updaten' },
      { status: 400 }
    );
  }

  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('betriebe')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, betrieb: data });
}