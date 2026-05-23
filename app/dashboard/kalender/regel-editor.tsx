'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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

const WOCHENTAGE_KURZ = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export type Regel = {
  id: string;
  wochentag: number;
  start_uhrzeit: string;
  ende_uhrzeit: string;
  aktiv: boolean;
};

export function RegelEditor({ regeln }: { regeln: Regel[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [wochentage, setWochentage] = useState<number[]>([1]);
  const [start, setStart] = useState('08:00');
  const [ende, setEnde] = useState('12:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleWochentag(wt: number) {
    setWochentage((prev) =>
      prev.includes(wt) ? prev.filter((x) => x !== wt) : [...prev, wt].sort()
    );
  }

  async function speichere() {
    if (wochentage.length === 0) {
      setError('Mindestens einen Wochentag wählen.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const results = await Promise.all(
        wochentage.map((wt) =>
          fetch('/api/verfuegbarkeit/regel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wochentag: wt,
              start_uhrzeit: start,
              ende_uhrzeit: ende,
              aktiv: true,
            }),
          }).then(async (r) => ({ ok: r.ok, data: await r.json() }))
        )
      );
      const failures = results.filter((r) => !r.ok || !r.data.success);
      if (failures.length > 0) {
        setError(
          `${failures.length} von ${results.length} Regel(n) fehlgeschlagen: ${
            failures[0].data.error || 'unbekannter Fehler'
          }`
        );
      } else {
        setShowAdd(false);
        setWochentage([1]);
        setStart('08:00');
        setEnde('12:00');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setBusy(false);
  }

  async function loesche(id: string) {
    if (!confirm('Regel wirklich löschen?')) return;
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
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Verfügbarkeits-Regeln</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {regeln.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Noch keine Regeln. Trag deine Standard-Aufmaß-Zeiten ein, dann
            schlägt die KI bei neuen Anfragen automatisch passende Slots vor.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {regeln.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 text-sm rounded-md border border-input bg-background px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="font-medium">{WOCHENTAGE_LANG[r.wochentag]}</span>{' '}
                  <span className="text-muted-foreground">
                    {r.start_uhrzeit.slice(0, 5)}–{r.ende_uhrzeit.slice(0, 5)} Uhr
                  </span>
                  {!r.aktiv && (
                    <span className="text-xs ml-2 text-muted-foreground">(inaktiv)</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => loesche(r.id)}
                  disabled={busy}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-50 text-sm"
                  aria-label="Regel entfernen"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {showAdd ? (
          <div className="space-y-3 rounded-md border border-input p-3 bg-muted/20">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Wochentage (mehrere möglich)
              </label>
              <div className="flex gap-1 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7].map((wt) => (
                  <button
                    key={wt}
                    type="button"
                    onClick={() => toggleWochentag(wt)}
                    disabled={busy}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-md border transition-colors',
                      wochentage.includes(wt)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-accent border-input',
                      busy && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {WOCHENTAGE_KURZ[wt]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Von</label>
                <Input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Bis</label>
                <Input
                  type="time"
                  value={ende}
                  onChange={(e) => setEnde(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
            {wochentage.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Legt {wochentage.length} Regeln an – eine pro gewähltem Wochentag.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAdd(false);
                  setError(null);
                }}
                disabled={busy}
              >
                Abbrechen
              </Button>
              <Button size="sm" onClick={speichere} disabled={busy}>
                {busy ? 'Speichert ...' : 'Speichern'}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            + Regel hinzufügen
          </Button>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
