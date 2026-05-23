'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export type Sperre = {
  id: string;
  datum_von: string;
  datum_bis: string;
  grund: string | null;
};

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SperreEditor({ sperren }: { sperren: Sperre[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [grund, setGrund] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function speichere() {
    if (!von || !bis) {
      setError('Von und Bis ausfüllen.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/verfuegbarkeit/sperre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datum_von: new Date(von).toISOString(),
          datum_bis: new Date(bis).toISOString(),
          grund: grund || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setShowAdd(false);
        setVon('');
        setBis('');
        setGrund('');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
    setBusy(false);
  }

  async function loesche(id: string) {
    if (!confirm('Sperre wirklich löschen?')) return;
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
        <CardTitle className="text-base">Sperren (Urlaub / fester Termin)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sperren.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Noch keine Sperren. Trag Urlaub oder einen fixen Termin ein – die
            KI vermeidet diese Zeit dann beim Vorschlagen.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sperren.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-2 text-sm rounded-md border border-input bg-background px-3 py-2"
              >
                <div className="min-w-0">
                  <div>
                    {formatDateTime(s.datum_von)} – {formatDateTime(s.datum_bis)}
                  </div>
                  {s.grund && (
                    <div className="text-xs text-muted-foreground truncate">
                      {s.grund}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => loesche(s.id)}
                  disabled={busy}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-50 text-sm flex-shrink-0"
                  aria-label="Sperre entfernen"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {showAdd ? (
          <div className="space-y-2 rounded-md border border-input p-3 bg-muted/20">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Von</label>
                <Input
                  type="datetime-local"
                  value={von}
                  onChange={(e) => setVon(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Bis</label>
                <Input
                  type="datetime-local"
                  value={bis}
                  onChange={(e) => setBis(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
            <Textarea
              placeholder="Grund (optional, nur für dich – Kunde sieht das nie)"
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              disabled={busy}
              rows={2}
              className="text-sm"
            />
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
            + Sperre hinzufügen
          </Button>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
