import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { Card } from '@/components/ui/card';
import { formatInTimeZone } from 'date-fns-tz';
import { RegelEditor, type Regel } from './regel-editor';
import { SperreEditor, type Sperre } from './sperre-editor';
import { WochenGrid } from './wochengrid';
import { berlinStartOfWeek, BETRIEB_TZ } from '@/lib/datetime';
import { EmptyState } from '@/components/brand/empty-state';
import { Calendar02Icon } from '@hugeicons/core-free-icons';

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
  anfrage_id: string | null;
  status: string;
  ort: string | null;
  notiz: string | null;
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

  const [regelnRes, sperrenRes, termineRes, gmailConnRes] = await Promise.all([
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
        `id, datum, dauer_min, anfrage_id, status, ort, notiz,
         anfragen (betreff, von_name)`
      )
      .neq('status', 'abgesagt')
      .gte('datum', monday.toISOString())
      .lt('datum', sundayExclusive.toISOString()),
    supabase
      .from('gmail_connections')
      .select('google_email, status, calendar_sync_aktiv, calendar_letzter_sync')
      .maybeSingle(),
  ]);

  const regeln = (regelnRes.data as Regel[]) || [];
  const sperren = (sperrenRes.data as Sperre[]) || [];
  const termineRaw = (termineRes.data as TerminRow[]) || [];
  const gmailConn = gmailConnRes.data as {
    google_email: string;
    status: string;
    calendar_sync_aktiv: boolean | null;
    calendar_letzter_sync: string | null;
  } | null;

  // Termine in flache Struktur für die Client-Grid-Komponente
  const termineFuerGrid = termineRaw.map((t) => ({
    id: t.id,
    datum: t.datum,
    dauer_min: t.dauer_min,
    anfrage_id: t.anfrage_id,
    betreff: t.anfragen?.[0]?.betreff ?? null,
    von_name: t.anfragen?.[0]?.von_name ?? null,
    ort: t.ort,
    notiz: t.notiz,
  }));


  const istGmailVerbunden = gmailConn?.status === 'aktiv';
  const istSyncAktiv = !!gmailConn?.calendar_sync_aktiv;

  return (
    <div className="container mx-auto py-6 sm:py-8 px-4 sm:px-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-wide mb-1">
          Kalender
        </h1>
        <p className="text-muted-foreground text-sm">
          Verfügbarkeit + Termine im Wochenüberblick. Was grün ist, schlägt die
          KI bei neuen Anfragen automatisch als Aufmaß-Termin vor.
        </p>
      </div>

      {istGmailVerbunden && !istSyncAktiv && (
        <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="font-medium text-amber-900 text-sm">
              Google-Kalender mit Auftragswerk verbinden
            </p>
            <p className="text-xs text-amber-900 mt-1">
              Wenn du im Google-Kalender schon einen Termin hast, blockt
              Auftragswerk die Zeit automatisch – die KI schlägt dem Kunden
              dann nichts vor, wo du eh nicht kannst. Nur Lese-Zugriff, wir
              tragen nie was in deinen Kalender ein.
            </p>
          </div>
          <a
            href="/api/auth/google/start"
            className="inline-flex items-center justify-center min-h-11 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 whitespace-nowrap"
          >
            Jetzt freigeben
          </a>
        </div>
      )}

      {istSyncAktiv && (
        <div className="mb-5 rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-900">
          <span className="font-medium">Google-Kalender-Sync aktiv</span>
          {gmailConn?.calendar_letzter_sync && (
            <>
              {' · '}
              <span className="text-green-800">
                zuletzt aktualisiert:{' '}
                {new Date(gmailConn.calendar_letzter_sync).toLocaleString(
                  'de-DE',
                  { timeZone: 'Europe/Berlin' }
                )}
              </span>
            </>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="order-2 sm:order-1 flex items-center justify-between sm:justify-start gap-4">
          <Link
            href={`/dashboard/kalender?offset=${offset - 1}`}
            className="inline-flex items-center min-h-11 sm:min-h-0 px-2 -mx-2 text-sm hover:underline"
          >
            ← Vorherige
          </Link>
          <Link
            href={`/dashboard/kalender?offset=${offset + 1}`}
            className="inline-flex items-center min-h-11 sm:min-h-0 px-2 -mx-2 text-sm hover:underline sm:hidden"
          >
            Nächste →
          </Link>
        </div>
        <div className="order-1 sm:order-2 text-sm font-medium text-center">
          {formatWeekLabel(monday, sundayInclusive)}
          {offset === 0 ? <span className="text-muted-foreground"> · aktuelle Woche</span> : null}
        </div>
        <Link
          href={`/dashboard/kalender?offset=${offset + 1}`}
          className="order-3 hidden sm:inline-flex items-center text-sm hover:underline"
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

      {regeln.length === 0 && (
        <div className="mb-6">
          <EmptyState
            icon={Calendar02Icon}
            title="Noch keine Verfügbarkeit hinterlegt"
            description={'Leg unten deine erste Regel an (z. B. Mo–Mi 8–12 Uhr). Die KI nutzt diese Slots, um Kunden bei neuen Anfragen konkrete Termin-Vorschläge zu machen statt nur „melde mich".'}
          />
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
          <span className="inline-block w-3 h-3 rounded bg-primary/10 border border-primary/30"></span>
          Termin
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-rose-50 border border-rose-200"></span>
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
