import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Akzeptiert nur parsebare Datums-Strings im sinnvollen Range (Jahr 2020
 * bis +5 Jahre ab heute). Schützt vor 'not-a-date'-Crashes und Tippfehlern
 * wie 2099/1900. Rückgabe: ISO-String oder null bei invalid.
 */
function parseTerminDatum(input: unknown): string | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  const jahr = d.getUTCFullYear();
  const maxJahr = new Date().getUTCFullYear() + 5;
  if (jahr < 2020 || jahr > maxJahr) return null;
  return d.toISOString();
}

/**
 * POST /api/termine
 * Body: {
 *   anfrage_id?,                     // OPTIONAL – wenn null: Standalone-Termin
 *   slots: [{ datum: ISO, ort?, notiz?, dauer_min? }],
 *   direkt_bestaetigen?: boolean   // default false; wenn true → status 'bestaetigt'
 *                                  //   + alle anderen vorgeschlagenen Slots → 'abgesagt'
 * }
 *
 * Speichert 1..n Termine. Default-Status 'vorgeschlagen', mit
 * direkt_bestaetigen=true direkt 'bestaetigt' (Ein-Klick-Fluss aus
 * der TerminCard wenn der Kunde im Reply den Termin bestätigt hat).
 *
 * Standalone (ohne anfrage_id): betrieb_id wird über das profiles-Mapping
 * des eingeloggten Users ermittelt.
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
    const anfrageId: string | undefined = body.anfrage_id || undefined;
    const slots: Array<{ datum: string; ort?: string; notiz?: string; dauer_min?: number }> =
      Array.isArray(body.slots) ? body.slots : [];
    const direktBestaetigen: boolean = body.direkt_bestaetigen === true;

    if (slots.length === 0) {
      return NextResponse.json(
        { error: 'slots[] sind pflicht' },
        { status: 400 }
      );
    }

    // Betrieb bestimmen: über Anfrage wenn vorhanden, sonst über profiles
    let betriebId: string | null = null;
    if (anfrageId) {
      const { data: anfrage } = await supabase
        .from('anfragen')
        .select('id, betrieb_id')
        .eq('id', anfrageId)
        .single();
      if (!anfrage) {
        return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 });
      }
      betriebId = anfrage.betrieb_id as string;
    } else {
      // Standalone: betrieb_id aus profiles holen
      const { data: profile } = await supabase
        .from('profiles')
        .select('betrieb_id')
        .eq('id', user.id)
        .single();
      if (!profile?.betrieb_id) {
        return NextResponse.json(
          { error: 'Kein Betrieb für diesen User verknüpft' },
          { status: 404 }
        );
      }
      betriebId = profile.betrieb_id as string;
    }

    const status = direktBestaetigen ? 'bestaetigt' : 'vorgeschlagen';

    // Validierung pro Slot: Datum parsebar + im sinnvollen Range
    const rows: Array<{
      anfrage_id: string | null;
      betrieb_id: string;
      datum: string;
      dauer_min: number;
      ort: string | null;
      notiz: string | null;
      status: string;
    }> = [];
    const invalidGruende: string[] = [];

    for (const s of slots) {
      const datumIso = parseTerminDatum(s.datum);
      if (!datumIso) {
        invalidGruende.push(`"${s.datum}" ist kein gültiges Datum (Jahr 2020 bis +5 Jahre)`);
        continue;
      }
      rows.push({
        anfrage_id: anfrageId ?? null,
        betrieb_id: betriebId,
        datum: datumIso,
        dauer_min: s.dauer_min ?? 60,
        ort: s.ort?.trim() || null,
        notiz: s.notiz?.trim() || null,
        status,
      });
    }

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: invalidGruende.length > 0
            ? `Kein gültiger Slot: ${invalidGruende.join('; ')}`
            : 'Kein gültiger Slot übergeben',
        },
        { status: 400 }
      );
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('termine')
      .insert(rows)
      .select('id, datum, dauer_min, ort, notiz, status');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Beim direkten Festmachen: alle anderen vorgeschlagenen Termine der
    // Anfrage als abgesagt markieren (Bestätigter Termin gewinnt).
    // Nur sinnvoll wenn Termin an eine Anfrage hängt.
    if (direktBestaetigen && anfrageId && inserted && inserted.length > 0) {
      const neueIds = inserted.map((t) => t.id);
      await supabaseAdmin
        .from('termine')
        .update({ status: 'abgesagt' })
        .eq('anfrage_id', anfrageId)
        .eq('status', 'vorgeschlagen')
        .not('id', 'in', `(${neueIds.map((id) => `"${id}"`).join(',')})`);
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
 * Body: { termin_id, action: 'bestaetigen' | 'absagen' | 'absolviert' | 'bearbeiten', datum?, ort?, notiz? }
 *
 * 'bestaetigen': diesen Termin → 'bestaetigt', alle anderen 'vorgeschlagen'-Termine
 * derselben Anfrage → 'abgesagt'.
 * 'bearbeiten': erlaubt Update von datum, ort, notiz (für Click-to-Edit im Kalender).
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

    if (
      !terminId ||
      !['bestaetigen', 'absagen', 'absolviert', 'bearbeiten'].includes(action)
    ) {
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

    if (action === 'bearbeiten') {
      const update: Record<string, string | null> = {};
      if (typeof body.datum === 'string' && body.datum) {
        const datumIso = parseTerminDatum(body.datum);
        if (!datumIso) {
          return NextResponse.json(
            { error: `"${body.datum}" ist kein gültiges Datum (Jahr 2020 bis +5 Jahre)` },
            { status: 400 }
          );
        }
        update.datum = datumIso;
      }
      if (typeof body.ort !== 'undefined') {
        update.ort = (body.ort ? String(body.ort).trim() : '') || null;
      }
      if (typeof body.notiz !== 'undefined') {
        update.notiz = (body.notiz ? String(body.notiz).trim() : '') || null;
      }
      if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'Nichts zu ändern' }, { status: 400 });
      }
      await supabaseAdmin.from('termine').update(update).eq('id', terminId);
      return NextResponse.json({ success: true, updated: Object.keys(update) });
    }

    const neuerStatus =
      action === 'bestaetigen'
        ? 'bestaetigt'
        : action === 'absagen'
        ? 'abgesagt'
        : 'absolviert';

    await supabaseAdmin.from('termine').update({ status: neuerStatus }).eq('id', terminId);

    // Beim Bestätigen: alle anderen vorgeschlagenen Termine zur selben Anfrage absagen
    if (action === 'bestaetigen' && termin.anfrage_id) {
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
