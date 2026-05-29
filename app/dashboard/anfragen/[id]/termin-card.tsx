'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  berlinLocalToUtcIso,
  utcIsoToBerlinLocal,
  formatBerlinDatetime,
} from '@/lib/datetime';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  TimeScheduleIcon,
  CheckmarkCircle02Icon,
  Location01Icon,
  Idea01Icon,
} from '@hugeicons/core-free-icons';

export type Termin = {
  id: string;
  datum: string;
  dauer_min: number;
  ort: string | null;
  notiz: string | null;
  status: 'vorgeschlagen' | 'bestaetigt' | 'absolviert' | 'abgesagt';
};

export type ExtrahierterTerminInfo = {
  datum_iso: string | null;
  ort: string | null;
  notiz: string | null;
};

function formatTermin(datum: string): string {
  // Display IMMER in Europe/Berlin, egal wo der Browser steht.
  return formatBerlinDatetime(datum, "EEEEEE, dd.MM.yyyy, HH:mm 'Uhr'");
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
  extrahierterTermin,
}: {
  anfrageId: string;
  termine: Termin[];
  extrahierterTermin?: ExtrahierterTerminInfo | null;
}) {
  const router = useRouter();
  const [termine, setTermine] = useState<Termin[]>(initialTermine);
  const [mode, setMode] = useState<'view' | 'vorschlag' | 'festmachen'>('view');
  const [slots, setSlots] = useState<Slot[]>(LEER_SLOTS);
  // Festmach-Form (separater State, damit Vorschlag-Slots unangetastet bleiben)
  const [festDatum, setFestDatum] = useState('');
  const [festOrt, setFestOrt] = useState('');
  const [festNotiz, setFestNotiz] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);

  const bestaetigt = termine.find((t) => t.status === 'bestaetigt');
  const vorgeschlagene = termine.filter((t) => t.status === 'vorgeschlagen');
  const hatKiVorschlag =
    !bestaetigt &&
    extrahierterTermin &&
    extrahierterTermin.datum_iso &&
    extrahierterTermin.datum_iso.trim().length > 0;

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
    const valid = slots
      .filter((s) => s.datum.trim())
      .map((s) => ({
        // datetime-local → Berlin → UTC, sonst Bali-/Server-TZ-Verschiebung
        datum: berlinLocalToUtcIso(s.datum),
        ort: s.ort,
      }));
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

  /** Wechselt in den Festmach-Mode. Wenn KI was extrahiert hat, Felder pre-fillen. */
  function starteFestmachen(preFill: boolean) {
    if (preFill && extrahierterTermin) {
      // datum_iso ist von der KI "YYYY-MM-DDTHH:MM:SS" (Berliner Zeit
      // ohne TZ-Suffix). Direkt als datetime-local-Wert nehmen – das Feld
      // erwartet "YYYY-MM-DDTHH:MM" und der User soll im Input genau das
      // sehen, was die KI vorschlägt (Berlin-Zeit). Beim Speichern unten
      // konvertieren wir explizit via berlinLocalToUtcIso.
      setFestDatum(extrahierterTermin.datum_iso?.slice(0, 16) || '');
      setFestOrt(extrahierterTermin.ort || '');
      setFestNotiz(extrahierterTermin.notiz || '');
    } else {
      setFestDatum('');
      setFestOrt('');
      setFestNotiz('');
    }
    setError(null);
    setMode('festmachen');
  }

  async function macheFest() {
    if (!festDatum) {
      setError('Datum + Uhrzeit ausfüllen.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Wir behandeln festDatum als Berliner Zeit – egal wo der Browser
      // steht. Erzeugt UTC-ISO für die Speicherung.
      const datumUtc = berlinLocalToUtcIso(festDatum);
      const res = await fetch('/api/termine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anfrage_id: anfrageId,
          direkt_bestaetigen: true,
          slots: [
            {
              datum: datumUtc,
              ort: festOrt.trim() || undefined,
              notiz: festNotiz.trim() || undefined,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        // Lokal: neuer bestätigter Termin in die Liste, alte vorgeschlagene auf abgesagt
        setTermine((prev) =>
          prev
            .map((t) =>
              t.status === 'vorgeschlagen' ? { ...t, status: 'abgesagt' as const } : t
            )
            .concat(data.termine || [])
        );
        setMode('view');
        setFestDatum('');
        setFestOrt('');
        setFestNotiz('');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Festmachen');
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HugeiconsIcon icon={TimeScheduleIcon} size={18} strokeWidth={1.5} />
          Termin
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {bestaetigt && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
            <p className="font-medium text-green-900 flex items-center gap-1.5">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={14}
                strokeWidth={2}
              />
              Bestätigt: {formatTermin(bestaetigt.datum)}
            </p>
            {bestaetigt.ort && (
              <p className="text-xs text-green-800 mt-0.5 flex items-center gap-1">
                <HugeiconsIcon
                  icon={Location01Icon}
                  size={12}
                  strokeWidth={1.5}
                />
                {bestaetigt.ort}
              </p>
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
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <HugeiconsIcon
                          icon={Location01Icon}
                          size={12}
                          strokeWidth={1.5}
                        />
                        {t.ort}
                      </p>
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
                    {kopiert ? 'kopiert' : 'Kopieren'}
                  </button>
                </div>
                <pre className="text-xs whitespace-pre-wrap font-sans">
                  {vorschlagText}
                </pre>
              </div>
            )}
          </>
        )}

        {!bestaetigt && mode === 'view' && hatKiVorschlag && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 space-y-2">
            <p className="text-sm flex items-start gap-2">
              <HugeiconsIcon
                icon={Idea01Icon}
                size={16}
                strokeWidth={1.5}
                className="mt-0.5 flex-shrink-0 text-amber-700"
              />
              <span>
                <span className="font-medium">Kunde scheint einen Termin zu bestätigen:</span>{' '}
                <span className="text-foreground">
                  {extrahierterTermin?.datum_iso
                    ? formatTermin(extrahierterTermin.datum_iso)
                    : ''}
                </span>
                {extrahierterTermin?.ort && (
                  <span className="text-muted-foreground"> · {extrahierterTermin.ort}</span>
                )}
              </span>
            </p>
            <Button size="sm" onClick={() => starteFestmachen(true)} disabled={busy}>
              Termin direkt festmachen
            </Button>
          </div>
        )}

        {!bestaetigt && mode === 'view' && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode('vorschlag')}
            >
              {vorgeschlagene.length > 0 ? 'Weitere vorschlagen' : 'Termin vorschlagen'}
            </Button>
            {!hatKiVorschlag && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => starteFestmachen(false)}
              >
                Direkt festmachen
              </Button>
            )}
          </div>
        )}

        {mode === 'festmachen' && (
          <div className="space-y-2 rounded-md border border-input p-3">
            <p className="text-xs text-muted-foreground">
              Termin direkt als bestätigt anlegen – erscheint danach im Kalender.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-0.5 block">
                  Datum + Uhrzeit
                </label>
                <Input
                  type="datetime-local"
                  value={festDatum}
                  onChange={(e) => setFestDatum(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-0.5 block">
                  Ort (optional)
                </label>
                <Input
                  placeholder="z.B. Trogerstraße 18"
                  value={festOrt}
                  onChange={(e) => setFestOrt(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
            <Textarea
              placeholder="Notiz (optional, nur intern)"
              value={festNotiz}
              onChange={(e) => setFestNotiz(e.target.value)}
              disabled={busy}
              rows={2}
              className="text-sm"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMode('view');
                  setError(null);
                }}
                disabled={busy}
              >
                Abbrechen
              </Button>
              <Button size="sm" onClick={macheFest} disabled={busy}>
                {busy ? 'Festmacht ...' : 'Festmachen'}
              </Button>
            </div>
          </div>
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
