import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { RegelEditor, type Regel } from './regel-editor';
import { SperreEditor, type Sperre } from './sperre-editor';

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const STUNDEN = Array.from({ length: 13 }, (_, i) => 7 + i); // 7..19

function getMondayOfWeek(offset: number): Date {
  const now = new Date();
  const dayIso = (now.getDay() + 6) % 7; // 0=Mo, 6=So
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayIso + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatDateShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

function formatWeekLabel(monday: Date, sunday: Date): string {
  return `${formatDateShort(monday)} – ${formatDateShort(sunday)} ${sunday.getFullYear()}`;
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

  const monday = getMondayOfWeek(offset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

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
      .lte('datum', sunday.toISOString()),
  ]);

  const regeln = (regelnRes.data as Regel[]) || [];
  const sperren = (sperrenRes.data as Sperre[]) || [];
  const termineRaw = (termineRes.data as TerminRow[]) || [];

  type CellInfo = {
    istFrei: boolean;
    sperreGrund?: string;
    termine: Array<{
      id: string;
      anfrage_id: string;
      betreff: string | null;
      von_name: string | null;
    }>;
  };

  function cellInfo(dayIdx: number, hour: number): CellInfo {
    const date = days[dayIdx];
    const cellStart = new Date(date);
    cellStart.setHours(hour, 0, 0, 0);
    const cellEnd = new Date(date);
    cellEnd.setHours(hour + 1, 0, 0, 0);

    const wochentag = dayIdx + 1;

    const istFrei = regeln.some((r) => {
      if (!r.aktiv) return false;
      if (r.wochentag !== wochentag) return false;
      const [sh, sm] = r.start_uhrzeit.split(':').map(Number);
      const [eh, em] = r.ende_uhrzeit.split(':').map(Number);
      const ruleStart = new Date(date);
      ruleStart.setHours(sh, sm, 0, 0);
      const ruleEnd = new Date(date);
      ruleEnd.setHours(eh, em, 0, 0);
      return cellStart >= ruleStart && cellEnd <= ruleEnd;
    });

    const sperre = sperren.find((s) => {
      const von = new Date(s.datum_von).getTime();
      const bis = new Date(s.datum_bis).getTime();
      return cellStart.getTime() < bis && cellEnd.getTime() > von;
    });

    const cellTermine = termineRaw
      .filter((t) => {
        const tStart = new Date(t.datum).getTime();
        const tEnd = tStart + (t.dauer_min || 60) * 60 * 1000;
        return tStart < cellEnd.getTime() && tEnd > cellStart.getTime();
      })
      .map((t) => ({
        id: t.id,
        anfrage_id: t.anfrage_id,
        betreff: t.anfragen?.[0]?.betreff ?? null,
        von_name: t.anfragen?.[0]?.von_name ?? null,
      }));

    return {
      istFrei: istFrei && !sperre && cellTermine.length === 0,
      sperreGrund: sperre ? sperre.grund || 'Gesperrt' : undefined,
      termine: cellTermine,
    };
  }

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
          {formatWeekLabel(monday, sunday)}
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
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left px-2 py-2 text-muted-foreground font-medium w-14 bg-muted/30">
                  Zeit
                </th>
                {days.map((d, i) => {
                  const istHeute =
                    d.getTime() === new Date().setHours(0, 0, 0, 0);
                  return (
                    <th
                      key={i}
                      className={cn(
                        'text-left px-2 py-2 font-medium border-l',
                        istHeute && 'bg-primary/10'
                      )}
                    >
                      <div>{WOCHENTAGE[i]}</div>
                      <div className="text-muted-foreground font-normal">
                        {formatDateShort(d)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {STUNDEN.map((h) => (
                <tr key={h} className="border-b">
                  <td className="px-2 py-1 text-muted-foreground align-top bg-muted/20">
                    {String(h).padStart(2, '0')}:00
                  </td>
                  {days.map((_, dayIdx) => {
                    const info = cellInfo(dayIdx, h);
                    return (
                      <td
                        key={dayIdx}
                        className={cn(
                          'px-1 py-1 border-l align-top h-12',
                          info.istFrei && 'bg-green-50',
                          info.sperreGrund && 'bg-red-50',
                          info.termine.length > 0 && 'bg-blue-50'
                        )}
                      >
                        {info.termine.length > 0 ? (
                          info.termine.map((t) => (
                            <Link
                              key={t.id}
                              href={`/dashboard/anfragen/${t.anfrage_id}`}
                              className="block text-blue-900 hover:underline truncate"
                              title={`${t.betreff || '(Termin)'} – ${t.von_name || ''}`}
                            >
                              {t.betreff || '(Termin)'}
                            </Link>
                          ))
                        ) : info.sperreGrund ? (
                          <span
                            className="text-red-700 line-through block truncate"
                            title={info.sperreGrund}
                          >
                            {info.sperreGrund}
                          </span>
                        ) : info.istFrei ? (
                          <span className="text-green-700">●</span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
