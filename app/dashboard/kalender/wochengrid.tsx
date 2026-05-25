'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { berlinDateTimeToUtc } from '@/lib/datetime';

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WOCHENTAGE_LANG = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
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
  dayLabels,
  todayLabel,
  regeln,
  sperren,
  termine,
}: {
  /** 7 Strings im Format "YYYY-MM-DD" – Berliner Datums-Tag der Mo-So-Reihe */
  dayLabels: string[];
  /** Heutiges Datum in Berliner Zeit als "YYYY-MM-DD" (oder leer) */
  todayLabel: string;
  regeln: Regel[];
  sperren: Sperre[];
  termine: TerminFuerGrid[];
}) {
  const router = useRouter();
  const [selectedCell, setSelectedCell] = useState<{ dayIdx: number; hour: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // dayLabels (z.B. "2026-05-25") sind Berliner Daten. Wir parsen sie
  // explizit zu year/month/day-Tupeln – KEIN new Date()-Parsing weil das
  // ja wieder in Browser-TZ landet.
  const days = dayLabels.map((label) => {
    const [y, m, d] = label.split('-').map(Number);
    return { y, m, d, label };
  });

  function formatDateShort(d: { y: number; m: number; d: number }): string {
    return `${String(d.d).padStart(2, '0')}.${String(d.m).padStart(2, '0')}.`;
  }

  function selectedCellLabel(): string {
    if (!selectedCell) return '';
    const d = days[selectedCell.dayIdx];
    return `${WOCHENTAGE_LANG[selectedCell.dayIdx + 1]}, ${String(d.d).padStart(2, '0')}.${String(d.m).padStart(2, '0')}.${d.y} um ${String(selectedCell.hour).padStart(2, '0')}:00 Uhr (Berliner Zeit)`;
  }

  async function macheFrei() {
    if (!selectedCell) return;
    setBusy(true);
    setError(null);
    const wochentag = selectedCell.dayIdx + 1;
    const startU = `${String(selectedCell.hour).padStart(2, '0')}:00`;
    const endeU = `${String(selectedCell.hour + 1).padStart(2, '0')}:00`;
    try {
      const res = await fetch('/api/verfuegbarkeit/regel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wochentag,
          start_uhrzeit: startU,
          ende_uhrzeit: endeU,
          aktiv: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setSelectedCell(null);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setBusy(false);
  }

  async function macheSperre() {
    if (!selectedCell) return;
    setBusy(true);
    setError(null);
    const d = days[selectedCell.dayIdx];
    // Sperre läuft eine Stunde, von Berlin-hour:00 bis Berlin-(hour+1):00
    const von = berlinDateTimeToUtc(d.y, d.m, d.d, selectedCell.hour);
    const bis = berlinDateTimeToUtc(d.y, d.m, d.d, selectedCell.hour + 1);
    try {
      const res = await fetch('/api/verfuegbarkeit/sperre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datum_von: von.toISOString(),
          datum_bis: bis.toISOString(),
          grund: 'Manuell gesperrt',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setSelectedCell(null);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setBusy(false);
  }

  type CellInfo = {
    istFrei: boolean;
    sperreGrund?: string;
    termine: TerminFuerGrid[];
  };

  function cellInfo(dayIdx: number, hour: number): CellInfo {
    const d = days[dayIdx];
    // cellStart/cellEnd in Berliner Zeit-Semantik – damit Cells überall
    // (Bali, Berlin, UTC-Server) auf dieselben absoluten Momente referenzieren.
    const cellStart = berlinDateTimeToUtc(d.y, d.m, d.d, hour);
    const cellEnd = berlinDateTimeToUtc(d.y, d.m, d.d, hour + 1);

    const wochentag = dayIdx + 1;

    const istFrei = regeln.some((r) => {
      if (!r.aktiv) return false;
      if (r.wochentag !== wochentag) return false;
      const [sh, sm] = r.start_uhrzeit.split(':').map(Number);
      const [eh, em] = r.ende_uhrzeit.split(':').map(Number);
      const ruleStart = berlinDateTimeToUtc(d.y, d.m, d.d, sh, sm);
      const ruleEnd = berlinDateTimeToUtc(d.y, d.m, d.d, eh, em);
      return cellStart.getTime() >= ruleStart.getTime() && cellEnd.getTime() <= ruleEnd.getTime();
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
    <>
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left px-2 py-2 text-muted-foreground font-medium w-14 bg-muted/30">
              Zeit
            </th>
            {days.map((d, i) => {
              const istHeute = d.label === todayLabel;
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
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedCell({ dayIdx, hour: h })}
                        disabled={busy}
                        className="block w-full h-full text-muted-foreground/40 hover:bg-accent/40 hover:text-foreground transition-colors rounded text-xs"
                        title="Klicken um Regel oder Sperre einzutragen"
                        aria-label={`Slot ${WOCHENTAGE[dayIdx]} ${h}:00 belegen`}
                      >
                        +
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <Dialog
      open={selectedCell !== null}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedCell(null);
          setError(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{selectedCellLabel()}</DialogTitle>
          <DialogDescription>
            Was willst du mit diesem Slot machen?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Button
            variant="outline"
            className="w-full h-auto py-3 justify-start text-left"
            onClick={macheFrei}
            disabled={busy}
          >
            <div>
              <div className="font-medium">🟢 Regelmäßig frei machen</div>
              <div className="text-xs text-muted-foreground font-normal mt-0.5">
                {selectedCell &&
                  `Jeden ${WOCHENTAGE_LANG[selectedCell.dayIdx + 1]} ${String(selectedCell.hour).padStart(2, '0')}:00–${String(selectedCell.hour + 1).padStart(2, '0')}:00 Uhr – als Regel`}
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full h-auto py-3 justify-start text-left"
            onClick={macheSperre}
            disabled={busy}
          >
            <div>
              <div className="font-medium">🔴 Diesen Slot sperren</div>
              <div className="text-xs text-muted-foreground font-normal mt-0.5">
                Einmalig an diesem Datum, eine Stunde lang
              </div>
            </div>
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {busy && <p className="text-xs text-muted-foreground">Wird gespeichert …</p>}
      </DialogContent>
    </Dialog>
    </>
  );
}
