'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  const [wochentag, setWochentag] = useState('1');
  const [start, setStart] = useState('08:00');
  const [ende, setEnde] = useState('12:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function speichere() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/verfuegbarkeit/regel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wochentag: parseInt(wochentag, 10),
          start_uhrzeit: start,
          ende_uhrzeit: ende,
          aktiv: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setShowAdd(false);
        setWochentag('1');
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
          <div className="space-y-2 rounded-md border border-input p-3 bg-muted/20">
            <div className="grid grid-cols-3 gap-2">
              <select
                value={wochentag}
                onChange={(e) => setWochentag(e.target.value)}
                disabled={busy}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {WOCHENTAGE_LANG.slice(1).map((w, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    {w}
                  </option>
                ))}
              </select>
              <Input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={busy}
              />
              <Input
                type="time"
                value={ende}
                onChange={(e) => setEnde(e.target.value)}
                disabled={busy}
              />
            </div>
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
