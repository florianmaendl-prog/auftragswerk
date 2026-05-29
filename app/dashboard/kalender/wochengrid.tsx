'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  berlinDateTimeToUtc,
  berlinLocalToUtcIso,
  utcIsoToBerlinLocal,
  formatBerlinDatetime,
} from '@/lib/datetime';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  TimeScheduleIcon,
  CancelCircleIcon,
  Delete02Icon,
  Edit02Icon,
  Location01Icon,
} from '@hugeicons/core-free-icons';

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WOCHENTAGE_LANG = [
  '',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];
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
  anfrage_id: string | null;
  betreff: string | null;
  von_name: string | null;
  ort?: string | null;
  notiz?: string | null;
};

type CellInfo = {
  istFrei: boolean;
  regelId?: string;
  sperreId?: string;
  sperreGrund?: string;
  termine: TerminFuerGrid[];
};

type CellKind = 'empty' | 'termin' | 'regel' | 'sperre';
type SelectedCell = {
  dayIdx: number;
  hour: number;
  kind: CellKind;
  termin?: TerminFuerGrid;
  regelId?: string;
  sperreId?: string;
};

type SubMode = 'view' | 'create-termin' | 'edit-termin';

export function WochenGrid({
  dayLabels,
  todayLabel,
  regeln,
  sperren,
  termine,
}: {
  /** 7 Strings "YYYY-MM-DD" – Berliner Datums-Tag der Mo-So-Reihe */
  dayLabels: string[];
  /** Heutiges Datum in Berliner Zeit als "YYYY-MM-DD" */
  todayLabel: string;
  regeln: Regel[];
  sperren: Sperre[];
  termine: TerminFuerGrid[];
}) {
  const router = useRouter();
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [subMode, setSubMode] = useState<SubMode>('view');
  // Form-State für create-termin / edit-termin
  const [terminDatum, setTerminDatum] = useState('');
  const [terminOrt, setTerminOrt] = useState('');
  const [terminNotiz, setTerminNotiz] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // dayLabels (z.B. "2026-05-25") zu year/month/day-Tupeln parsen.
  // KEIN new Date() – das würde Browser-TZ verwenden.
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
    return `${WOCHENTAGE_LANG[selectedCell.dayIdx + 1]}, ${String(d.d).padStart(2, '0')}.${String(d.m).padStart(2, '0')}.${d.y} – ${String(selectedCell.hour).padStart(2, '0')}:00 Uhr`;
  }

  function cellInfo(dayIdx: number, hour: number): CellInfo {
    const d = days[dayIdx];
    const cellStart = berlinDateTimeToUtc(d.y, d.m, d.d, hour);
    const cellEnd = berlinDateTimeToUtc(d.y, d.m, d.d, hour + 1);

    const wochentag = dayIdx + 1;

    const matchingRegel = regeln.find((r) => {
      if (!r.aktiv) return false;
      if (r.wochentag !== wochentag) return false;
      const [sh, sm] = r.start_uhrzeit.split(':').map(Number);
      const [eh, em] = r.ende_uhrzeit.split(':').map(Number);
      const ruleStart = berlinDateTimeToUtc(d.y, d.m, d.d, sh, sm);
      const ruleEnd = berlinDateTimeToUtc(d.y, d.m, d.d, eh, em);
      return (
        cellStart.getTime() >= ruleStart.getTime() &&
        cellEnd.getTime() <= ruleEnd.getTime()
      );
    });

    const matchingSperre = sperren.find((s) => {
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
      istFrei: !!matchingRegel && !matchingSperre && cellTermine.length === 0,
      regelId: matchingRegel?.id,
      sperreId: matchingSperre?.id,
      sperreGrund: matchingSperre ? matchingSperre.grund || 'Gesperrt' : undefined,
      termine: cellTermine,
    };
  }

  function openCell(dayIdx: number, hour: number) {
    const info = cellInfo(dayIdx, hour);

    // Termin-Form immer mit der angeklickten Slot-Zeit pre-fillen –
    // damit "Termin anlegen" aus jeder Zellsorte (leer/grün/rot) gleich
    // gut funktioniert.
    const d = days[dayIdx];
    const yyyy = d.y;
    const mm = String(d.m).padStart(2, '0');
    const dd = String(d.d).padStart(2, '0');
    const hh = String(hour).padStart(2, '0');
    setTerminDatum(`${yyyy}-${mm}-${dd}T${hh}:00`);
    setTerminOrt('');
    setTerminNotiz('');

    let sel: SelectedCell;
    if (info.termine.length > 0) {
      sel = { dayIdx, hour, kind: 'termin', termin: info.termine[0] };
      // Für Bearbeiten: Form-Defaults mit Termin-Werten überschreiben
      setTerminDatum(utcIsoToBerlinLocal(info.termine[0].datum));
      setTerminOrt(info.termine[0].ort || '');
      setTerminNotiz(info.termine[0].notiz || '');
    } else if (info.sperreId) {
      sel = { dayIdx, hour, kind: 'sperre', sperreId: info.sperreId };
    } else if (info.regelId) {
      sel = { dayIdx, hour, kind: 'regel', regelId: info.regelId };
    } else {
      sel = { dayIdx, hour, kind: 'empty' };
    }
    setSelectedCell(sel);
    setSubMode('view');
    setError(null);
  }

  function closeDialog() {
    setSelectedCell(null);
    setSubMode('view');
    setError(null);
  }

  // ---------- ACTIONS ----------

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
        closeDialog();
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
        closeDialog();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setBusy(false);
  }

  async function legeStandaloneTerminAn() {
    if (!terminDatum) {
      setError('Datum + Uhrzeit ausfüllen.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/termine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // anfrage_id absent → Standalone
          direkt_bestaetigen: true,
          slots: [
            {
              datum: berlinLocalToUtcIso(terminDatum),
              ort: terminOrt.trim() || undefined,
              notiz: terminNotiz.trim() || undefined,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        closeDialog();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setBusy(false);
  }

  async function speichereTerminEdit() {
    if (!selectedCell?.termin || !terminDatum) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/termine', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termin_id: selectedCell.termin.id,
          action: 'bearbeiten',
          datum: berlinLocalToUtcIso(terminDatum),
          ort: terminOrt,
          notiz: terminNotiz,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        closeDialog();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setBusy(false);
  }

  async function sageTerminAb() {
    if (!selectedCell?.termin) return;
    if (
      !confirm(
        'Termin wirklich absagen? Status wird auf "abgesagt" gesetzt – kann später wiederhergestellt werden.'
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/termine', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termin_id: selectedCell.termin.id,
          action: 'absagen',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        closeDialog();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setBusy(false);
  }

  async function loescheRegel(id: string) {
    if (!confirm('Regel löschen? Diese wiederkehrende Verfügbarkeit ist danach weg.')) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/verfuegbarkeit/regel?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        closeDialog();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setBusy(false);
  }

  async function loescheSperre(id: string) {
    if (!confirm('Sperre löschen?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/verfuegbarkeit/sperre?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        closeDialog();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setBusy(false);
  }

  // ---------- RENDER ----------

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
                  const hasTermin = info.termine.length > 0;
                  const cellLabel =
                    hasTermin
                      ? info.termine[0].betreff || '(Termin)'
                      : info.sperreGrund ?? (info.istFrei ? '●' : '+');
                  const cellTitle =
                    hasTermin
                      ? `${info.termine[0].betreff || '(Termin)'} – ${info.termine[0].von_name || 'Standalone'}`
                      : info.sperreGrund
                      ? info.sperreGrund
                      : info.istFrei
                      ? 'Freier Slot – klicken zum Bearbeiten der Regel'
                      : 'Klicken um Slot zu belegen';
                  const cellTextClass = hasTermin
                    ? 'text-blue-900 hover:underline truncate'
                    : info.sperreGrund
                    ? 'text-red-700 line-through block truncate'
                    : info.istFrei
                    ? 'text-green-700'
                    : 'text-muted-foreground/40 hover:text-foreground';
                  return (
                    <td
                      key={dayIdx}
                      className={cn(
                        'border-l align-top h-12 p-0',
                        info.istFrei && 'bg-green-50',
                        info.sperreGrund && 'bg-red-50',
                        hasTermin && 'bg-blue-50'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => openCell(dayIdx, h)}
                        disabled={busy}
                        className={cn(
                          'block w-full h-full px-1 py-1 text-left transition-colors rounded text-xs',
                          'hover:bg-accent/30',
                          cellTextClass
                        )}
                        title={cellTitle}
                        aria-label={`${WOCHENTAGE[dayIdx]} ${h}:00 öffnen`}
                      >
                        {cellLabel}
                      </button>
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
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCellLabel()}</DialogTitle>
            <DialogDescription>
              {selectedCell?.kind === 'empty' && 'Was willst du mit diesem Slot machen?'}
              {selectedCell?.kind === 'termin' && 'Termin verwalten'}
              {selectedCell?.kind === 'regel' && 'Verfügbarkeits-Regel'}
              {selectedCell?.kind === 'sperre' && 'Sperre'}
            </DialogDescription>
          </DialogHeader>

          {/* --- EMPTY CELL: 3 Aktions-Buttons --- */}
          {selectedCell?.kind === 'empty' && subMode === 'view' && (
            <div className="space-y-2 py-2">
              <Button
                variant="outline"
                className="w-full h-auto py-3 justify-start text-left"
                onClick={macheFrei}
                disabled={busy}
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full bg-green-500" />
                  <div>
                    <div className="font-medium">Regelmäßig frei machen</div>
                    <div className="text-xs text-muted-foreground font-normal mt-0.5">
                      Jeden {WOCHENTAGE_LANG[selectedCell.dayIdx + 1]}{' '}
                      {String(selectedCell.hour).padStart(2, '0')}:00–
                      {String(selectedCell.hour + 1).padStart(2, '0')}:00 Uhr (Regel)
                    </div>
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full h-auto py-3 justify-start text-left"
                onClick={macheSperre}
                disabled={busy}
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full bg-rose-500" />
                  <div>
                    <div className="font-medium">Diesen Slot sperren</div>
                    <div className="text-xs text-muted-foreground font-normal mt-0.5">
                      Einmalig an diesem Datum, eine Stunde
                    </div>
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full h-auto py-3 justify-start text-left"
                onClick={() => setSubMode('create-termin')}
                disabled={busy}
              >
                <div className="flex items-start gap-2.5">
                  <HugeiconsIcon
                    icon={TimeScheduleIcon}
                    size={14}
                    strokeWidth={1.5}
                    className="mt-1 flex-shrink-0"
                  />
                  <div>
                    <div className="font-medium">Termin anlegen</div>
                    <div className="text-xs text-muted-foreground font-normal mt-0.5">
                      Ohne Anfrage-Bezug (Wartung, Privattermin, Innung etc.)
                    </div>
                  </div>
                </div>
              </Button>
            </div>
          )}

          {/* --- TERMIN: View-Mode --- */}
          {selectedCell?.kind === 'termin' && subMode === 'view' && selectedCell.termin && (
            <div className="space-y-3 py-2">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm space-y-1">
                <p className="font-medium text-blue-900 flex items-center gap-1.5">
                  <HugeiconsIcon
                    icon={TimeScheduleIcon}
                    size={14}
                    strokeWidth={1.5}
                  />
                  {selectedCell.termin.betreff || '(Termin ohne Betreff)'}
                </p>
                <p className="text-xs text-blue-800">
                  {formatBerlinDatetime(
                    selectedCell.termin.datum,
                    "EEEEEE, dd.MM.yyyy, HH:mm 'Uhr'"
                  )}
                </p>
                {selectedCell.termin.ort && (
                  <p className="text-xs text-blue-800 flex items-center gap-1">
                    <HugeiconsIcon
                      icon={Location01Icon}
                      size={12}
                      strokeWidth={1.5}
                    />
                    {selectedCell.termin.ort}
                  </p>
                )}
                {selectedCell.termin.notiz && (
                  <p className="text-xs text-blue-700">{selectedCell.termin.notiz}</p>
                )}
                {selectedCell.termin.von_name && (
                  <p className="text-xs text-blue-700">
                    Kunde: {selectedCell.termin.von_name}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSubMode('edit-termin')}
                  disabled={busy}
                  className="gap-1.5"
                >
                  <HugeiconsIcon icon={Edit02Icon} size={14} strokeWidth={1.5} />
                  Bearbeiten
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={sageTerminAb}
                  disabled={busy}
                  className="gap-1.5"
                >
                  <HugeiconsIcon
                    icon={CancelCircleIcon}
                    size={14}
                    strokeWidth={1.5}
                  />
                  Absagen
                </Button>
                {selectedCell.termin.anfrage_id && (
                  <Link href={`/dashboard/anfragen/${selectedCell.termin.anfrage_id}`}>
                    <Button size="sm" variant="outline">
                      → Zur Anfrage
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* --- REGEL: Termin/Sperre anlegen ODER Regel löschen --- */}
          {selectedCell?.kind === 'regel' && selectedCell.regelId && subMode === 'view' && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Aktuell freier Slot – wiederkehrende Verfügbarkeits-Regel für
                jeden {WOCHENTAGE_LANG[selectedCell.dayIdx + 1]}.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => setSubMode('create-termin')}
                  disabled={busy}
                  className="gap-1.5"
                >
                  <HugeiconsIcon
                    icon={TimeScheduleIcon}
                    size={14}
                    strokeWidth={1.5}
                  />
                  Termin anlegen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={macheSperre}
                  disabled={busy}
                  className="gap-1.5"
                >
                  <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-rose-500" />
                  Trotzdem sperren
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => loescheRegel(selectedCell.regelId!)}
                  disabled={busy}
                  className="text-destructive gap-1.5"
                >
                  <HugeiconsIcon
                    icon={Delete02Icon}
                    size={14}
                    strokeWidth={1.5}
                  />
                  Regel löschen
                </Button>
              </div>
            </div>
          )}

          {/* --- SPERRE: Termin überhaupt anlegen ODER Sperre löschen --- */}
          {selectedCell?.kind === 'sperre' && selectedCell.sperreId && subMode === 'view' && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Dieser Slot ist gesperrt
                {(() => {
                  const info = cellInfo(selectedCell.dayIdx, selectedCell.hour);
                  return info.sperreGrund ? ` ("${info.sperreGrund}")` : '';
                })()}
                .
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => setSubMode('create-termin')}
                  disabled={busy}
                  className="gap-1.5"
                >
                  <HugeiconsIcon
                    icon={TimeScheduleIcon}
                    size={14}
                    strokeWidth={1.5}
                  />
                  Trotzdem Termin anlegen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => loescheSperre(selectedCell.sperreId!)}
                  disabled={busy}
                  className="text-destructive gap-1.5"
                >
                  <HugeiconsIcon
                    icon={Delete02Icon}
                    size={14}
                    strokeWidth={1.5}
                  />
                  Sperre löschen
                </Button>
              </div>
            </div>
          )}

          {/* --- CREATE / EDIT TERMIN: gemeinsame Form --- */}
          {(subMode === 'create-termin' || subMode === 'edit-termin') && (
            <div className="space-y-2 py-2 rounded-md border border-input p-3">
              <p className="text-xs text-muted-foreground">
                {subMode === 'create-termin'
                  ? 'Termin direkt im Kalender anlegen – ohne Anfrage-Bezug.'
                  : 'Termin-Daten bearbeiten.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-0.5 block">
                    Datum + Uhrzeit
                  </label>
                  <Input
                    type="datetime-local"
                    value={terminDatum}
                    onChange={(e) => setTerminDatum(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-0.5 block">Ort</label>
                  <Input
                    placeholder="optional"
                    value={terminOrt}
                    onChange={(e) => setTerminOrt(e.target.value)}
                    disabled={busy}
                  />
                </div>
              </div>
              <Textarea
                placeholder="Notiz (optional)"
                value={terminNotiz}
                onChange={(e) => setTerminNotiz(e.target.value)}
                disabled={busy}
                rows={2}
                className="text-sm"
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSubMode('view')}
                  disabled={busy}
                >
                  Abbrechen
                </Button>
                <Button
                  size="sm"
                  onClick={
                    subMode === 'create-termin'
                      ? legeStandaloneTerminAn
                      : speichereTerminEdit
                  }
                  disabled={busy}
                >
                  {busy
                    ? 'Speichert ...'
                    : subMode === 'create-termin'
                    ? 'Termin anlegen'
                    : 'Speichern'}
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
