import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { buildIcsForTermin } from '@/lib/ical';

/**
 * GET /api/termine/[id]/ical
 *
 * Liefert .ics-Datei zum Download für einen Termin – Owner kann den
 * Termin damit in Apple-/Google-/Outlook-Kalender importieren.
 *
 * RLS via createClient (User-Session) sichert, dass nur eigene Termine
 * lesbar sind.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: terminId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { data: termin, error } = await supabase
    .from('termine')
    .select(
      `id, datum, dauer_min, ort, notiz,
       anfragen (von_name, von_email, betreff),
       betriebe (name)`
    )
    .eq('id', terminId)
    .single();
  if (error || !termin) {
    return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 404 });
  }

  type Row = typeof termin & {
    anfragen: { von_name: string | null; von_email: string; betreff: string | null } | null;
    betriebe: { name: string | null } | null;
  };
  const t = termin as Row;

  const datum = new Date(t.datum);
  const end = new Date(datum.getTime() + (t.dauer_min ?? 60) * 60 * 1000);
  const kunde = t.anfragen?.von_name || t.anfragen?.von_email || 'Kunde';
  const summary = `Termin mit ${kunde}`;
  const description = [
    t.anfragen?.betreff ? `Anfrage: ${t.anfragen.betreff}` : null,
    t.notiz ? `Notiz: ${t.notiz}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n');

  const ics = buildIcsForTermin({
    uid: `${t.id}@auftragswerk.app`,
    start: datum,
    end,
    summary,
    location: t.ort,
    description: description || undefined,
    organizerName: t.betriebe?.name ?? undefined,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="termin-${t.id}.ics"`,
    },
  });
}
