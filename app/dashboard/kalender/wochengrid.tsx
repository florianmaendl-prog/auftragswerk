'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const STUNDEN = Array.from({ length: 13 }, (_, i) => 7 + i); // 7..19

type Regel = {
  id: string;
  wochentag: number;
  start_uhrzeit: string;
  ende_uhrzeit: string;
  aktiv: boolean;
};

type Sperre = {
  id: string;
  datum_von: string;
  datum_bis: string;
  grund: string | null;
};

type TerminFuerGrid = {
  id: string;
  datum: string;
  dauer_min: number;
  anfrage_id: string;
  betreff: string | null;
  von_name: string | null;
};

function formatDateShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

/**
 * Wochen-Grid als Client-Komponente, damit alle Date-Operationen in der
 * Browser-Zeitzone laufen – consistent mit den datetime-local-Eingaben des
 * Users im Regel- und Sperre-Editor.
 *
 * Die Server-Page reicht raw ISO-Strings rein, hier wird gerechnet.
 */
export function WochenGrid({
  daysIso,
  regeln,
  sperren,
  termine,
}: {
  daysIso: string[]; // 7 Strings, jeder ist 'YYYY-MM-DDT00:00:00.000Z' der Monday-Reihe
  regeln: Regel[];
  sperren: Sperre[];
  termine: TerminFuerGrid[];
}) {
  // Aus den ISO-Strings nehmen wir nur den Datumsteil und bauen daraus
  // browser-lokale Date-Objekte (00:00 Uhr Browser-TZ am jeweiligen Tag).
  const days = daysIso.map((iso) => {
    const datumsteil = iso.slice(0, 10); // 'YYYY-MM-DD'
    const [y, m, d] = datumsteil.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  });

  const todayMs = (() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  })();

  type CellInfo = {
    istFrei: boolean;
    sperreGrund?: string;
    termine: TerminFuerGrid[];
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

    const cellTermine = termine.filter((t) => {
      const tStart = new Date(t.datum).getTime();
      const tEnd = tStart + (t.dauer_min || 60) * 60 * 1000;
      return tStart < cellEnd.getTime() && tEnd > cellStart.getTime();
    });

    return {
      istFrei: istFrei && !sperre && cellTermine.length === 0,
      sperreGrund: sperre ? sperre.grund || 'Gesperrt' : undefined,
      termine: cellTermine,
    };
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left px-2 py-2 text-muted-foreground font-medium w-14 bg-muted/30">
              Zeit
            </th>
            {days.map((d, i) => {
              const istHeute = d.getTime() === todayMs;
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
  );
}
