import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { Card } from '@/components/ui/card';
import { formatInTimeZone } from 'date-fns-tz';
import { RegelEditor, type Regel } from './regel-editor';
import { SperreEditor, type Sperre } from './sperre-editor';
import { WochenGrid } from './wochengrid';
import { berlinStartOfWeek, BETRIEB_TZ } from '@/lib/datetime';

/**
 * Liefert das UTC-Date für Mo 00:00 Berliner Zeit der aktuellen Woche +/- offset.
 */
function getBerlinMonday(offset: number): Date {
  const monday = berlinStartOfWeek();
  if (offset !== 0) {
    monday.setUTCDate(monday.getUTCDate() + offset * 7);
  }
  return monday;
}

function formatBerlinDateShort(utcDate: Date): string {
  return formatInTimeZone(utcDate, BETRIEB_TZ, 'dd.MM.');
}

function formatWeekLabel(monday: Date, sundayInclusive: Date): string {
  return `${formatBerlinDateShort(monday)} – ${formatBerlinDateShort(sundayInclusive)} ${formatInTimeZone(sundayInclusive, BETRIEB_TZ, 'yyyy')}`;
}

type TerminRow = {
  id: string;
  datum: string;
  dauer_min: number;
  anfrage_id: string;
  status: string;
  anfragen: Array<{ betreff: string | null; von_name: string | null }> | null;
};

export default async function KalenderPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const params = await searchParams;
  const offset = parseInt(params.offset || '0', 10) || 0;

  // Wochenrahmen: Mo 00:00 Berlin (exklusiv So 24:00 = Mo 00:00 nächste Woche).
  const monday = getBerlinMonday(offset);
  const sundayExclusive = new Date(monday);
  sundayExclusive.setUTCDate(monday.getUTCDate() + 7);
  // Anzeige-„So" (inklusive) ist 6 Tage nach Montag.
  const sundayInclusive = new Date(monday);
  sundayInclusive.setUTCDate(monday.getUTCDate() + 6);

  // Day-Labels als "YYYY-MM-DD" Berlin-Datum für jeden der 7 Tage.
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return formatInTimeZone(d, BETRIEB_TZ, 'yyyy-MM-dd');
  });

  const todayLabel = formatInTimeZone(new Date(), BETRIEB_TZ, 'yyyy-MM-dd');

  const supabase = await createClient();

  const [regelnRes, sperrenRes, termineRes] = await Promise.all([
    supabase
      .from('verfuegbarkeit_regel')
      .select('id, wochentag, start_uhrzeit, ende_uhrzeit, aktiv')
      .order('wochentag', { ascending: true })
      .order('start_uhrzeit', { ascending: true }),
    supabase
      .from('verfuegbarkeit_sperre')
      .select('id, datum_von, datum_bis, grund')
      .order('datum_von', { ascending: true }),
    supabase
      .from('termine')
      .select(
        `id, datum, dauer_min, anfrage_id, status,
         anfragen (betreff, von_name)`
      )
      .neq('status', 'abgesagt')
      .gte('datum', monday.toISOString())
      .lt('datum', sundayExclusive.toISOString()),
  ]);

  const regeln = (regelnRes.data as Regel[]) || [];
  const sperren = (sperrenRes.data as Sperre[]) || [];
  const termineRaw = (termineRes.data as TerminRow[]) || [];

  // Termine in flache Struktur für die Client-Grid-Komponente
  const termineFuerGrid = termineRaw.map((t) => ({
    id: t.id,
    datum: t.datum,
    dauer_min: t.dauer_min,
    anfrage_id: t.anfrage_id,
    betreff: t.anfragen?.[0]?.betreff ?? null,
    von_name: t.anfragen?.[0]?.von_name ?? null,
  }));


  return (
    <div className="container mx-auto py-8 px-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Kalender</h1>
        <p className="text-muted-foreground text-sm">
          Verfügbarkeit + Termine im Wochenüberblick. Was grün ist, schlägt die
          KI bei neuen Anfragen automatisch als Aufmaß-Termin vor.
        </p>
      </div>

      <div className="flex items-center justify-between mb-3 gap-2">
        <Link
          href={`/dashboard/kalender?offset=${offset - 1}`}
          className="text-sm hover:underline"
        >
          ← Vorherige
        </Link>
        <div className="text-sm font-medium">
          {formatWeekLabel(monday, sundayInclusive)}
          {offset === 0 ? <span className="text-muted-foreground"> · aktuelle Woche</span> : null}
        </div>
        <Link
          href={`/dashboard/kalender?offset=${offset + 1}`}
          className="text-sm hover:underline"
        >
          Nächste →
        </Link>
      </div>
      {offset !== 0 && (
        <div className="text-center mb-3">
          <Link
            href="/dashboard/kalender"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            → Zurück zur aktuellen Woche
          </Link>
        </div>
      )}

      <Card className="mb-6 overflow-hidden p-0">
        <WochenGrid
          dayLabels={dayLabels}
          todayLabel={todayLabel}
          regeln={regeln}
          sperren={sperren}
          termine={termineFuerGrid}
        />
      </Card>

      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-green-50 border border-green-200"></span>
          frei (laut Regel)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-blue-50 border border-blue-200"></span>
          Termin
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200"></span>
          gesperrt
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RegelEditor regeln={regeln} />
        <SperreEditor sperren={sperren} />
      </div>
    </div>
  );
}
