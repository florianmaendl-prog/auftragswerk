'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type Termin = {
  id: string;
  datum: string;
  dauer_min: number;
  ort: string | null;
  notiz: string | null;
  status: 'vorgeschlagen' | 'bestaetigt' | 'absolviert' | 'abgesagt';
};

function formatTermin(datum: string): string {
  return new Date(datum).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Slot = { datum: string; ort: string };

const LEER_SLOTS: Slot[] = [
  { datum: '', ort: '' },
  { datum: '', ort: '' },
  { datum: '', ort: '' },
];

export function TerminCard({
  anfrageId,
  termine: initialTermine,
}: {
  anfrageId: string;
  termine: Termin[];
}) {
  const router = useRouter();
  const [termine, setTermine] = useState<Termin[]>(initialTermine);
  const [mode, setMode] = useState<'view' | 'vorschlag'>('view');
  const [slots, setSlots] = useState<Slot[]>(LEER_SLOTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);

  const bestaetigt = termine.find((t) => t.status === 'bestaetigt');
  const vorgeschlagene = termine.filter((t) => t.status === 'vorgeschlagen');

  const vorschlagText =
    vorgeschlagene.length > 0
      ? `Ich kann anbieten:\n${vorgeschlagene
          .map(
            (t, i) =>
              `${i + 1}. ${formatTermin(t.datum)}${t.ort ? ` (${t.ort})` : ''}`
          )
          .join('\n')}`
      : '';

  async function speichereVorschlaege() {
    const valid = slots.filter((s) => s.datum.trim());
    if (valid.length === 0) {
      setError('Bitte mindestens einen Termin angeben.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/termine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anfrage_id: anfrageId, slots: valid }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setTermine([...termine, ...data.termine]);
        setMode('view');
        setSlots(LEER_SLOTS);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
    setBusy(false);
  }

  async function bestaetigeTermin(terminId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/termine', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termin_id: terminId, action: 'bestaetigen' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setTermine(
          termine.map((t) => {
            if (t.id === terminId) return { ...t, status: 'bestaetigt' };
            if (t.status === 'vorgeschlagen') return { ...t, status: 'abgesagt' };
            return t;
          })
        );
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Bestätigen');
    }
    setBusy(false);
  }

  async function kopiereText() {
    try {
      await navigator.clipboard.writeText(vorschlagText);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1500);
    } catch {
      setError('Kopieren fehlgeschlagen');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">📅 Termin</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {bestaetigt && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
            <p className="font-medium text-green-900">
              ✓ Bestätigt: {formatTermin(bestaetigt.datum)}
            </p>
            {bestaetigt.ort && (
              <p className="text-xs text-green-800 mt-0.5">📍 {bestaetigt.ort}</p>
            )}
            {bestaetigt.notiz && (
              <p className="text-xs text-green-700 mt-1">{bestaetigt.notiz}</p>
            )}
          </div>
        )}

        {!bestaetigt && vorgeschlagene.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground">
              Vorgeschlagene Termine – auf „Festmachen“ klicken, sobald der Kunde
              bestätigt:
            </p>
            <ul className="space-y-1.5">
              {vorgeschlagene.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{formatTermin(t.datum)}</p>
                    {t.ort && (
                      <p className="text-xs text-muted-foreground">📍 {t.ort}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => bestaetigeTermin(t.id)}
                    disabled={busy}
                  >
                    Festmachen
                  </Button>
                </li>
              ))}
            </ul>

            {vorschlagText && (
              <div className="rounded-md border bg-muted/30 p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Text für die Mail:</p>
                  <button
                    type="button"
                    onClick={kopiereText}
                    className="text-xs text-primary hover:underline"
                  >
                    {kopiert ? '✓ kopiert' : 'Kopieren'}
                  </button>
                </div>
                <pre className="text-xs whitespace-pre-wrap font-sans">
                  {vorschlagText}
                </pre>
              </div>
            )}
          </>
        )}

        {!bestaetigt && mode === 'view' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode('vorschlag')}
          >
            {vorgeschlagene.length > 0 ? 'Weitere vorschlagen' : 'Termin vorschlagen'}
          </Button>
        )}

        {mode === 'vorschlag' && (
          <div className="space-y-2 rounded-md border border-input p-3">
            <p className="text-xs text-muted-foreground">
              Bis zu 3 Slots vorschlagen (Datum + Uhrzeit, Ort optional):
            </p>
            {slots.map((slot, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr] gap-2">
                <Input
                  type="datetime-local"
                  value={slot.datum}
                  onChange={(e) =>
                    setSlots(
                      slots.map((s, j) =>
                        j === i ? { ...s, datum: e.target.value } : s
                      )
                    )
                  }
                  disabled={busy}
                />
                <Input
                  placeholder="Ort (optional)"
                  value={slot.ort}
                  onChange={(e) =>
                    setSlots(
                      slots.map((s, j) =>
                        j === i ? { ...s, ort: e.target.value } : s
                      )
                    )
                  }
                  disabled={busy}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMode('view');
                  setSlots(LEER_SLOTS);
                  setError(null);
                }}
                disabled={busy}
              >
                Abbrechen
              </Button>
              <Button size="sm" onClick={speichereVorschlaege} disabled={busy}>
                {busy ? 'Speichert ...' : 'Speichern'}
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
