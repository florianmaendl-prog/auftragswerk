'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AddSquareIcon,
  CancelCircleIcon,
  ArrowUp01Icon,
  ArrowDown01Icon,
} from '@hugeicons/core-free-icons';
import { SendenModal } from './senden-modal';

type Position = {
  pos: number;
  bezeichnung: string;
  beschreibung?: string;
  menge: number;
  einheit: string;
  einzelpreis_netto: number;
  gesamtpreis_netto: number;
  ki_schaetzpreis?: number;
  baustein_id?: string | null;
};

type EditorState = {
  titel: string;
  einleitung: string;
  positionen: Position[];
  schlusstext: string;
  mwst_satz: number;
  summe_netto: number;
  summe_brutto: number;
  status: 'entwurf' | 'versendet' | 'angenommen' | 'abgelehnt';
  angebotsnummer: string;
  gueltig_bis: string;
  notiz_intern: string;
  empfaenger_name: string;
  empfaenger_firma: string;
  empfaenger_email: string;
  empfaenger_adresse: string;
  empfaenger_plz: string;
};

const EINHEITEN = ['Stk', 'm', 'm²', 'm³', 'h', 'pauschal'];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(n);
}

export function AngebotEditor({
  id,
  initial,
}: {
  id: string;
  initial: EditorState;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [state, setState] = useState<EditorState>(initial);
  // Baseline für Dirty-Detection: wird nach jedem erfolgreichen Save
  // auf den aktuellen State gesetzt, damit "gespeichert" = "sauber" gilt.
  const [baseline, setBaseline] = useState<EditorState>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dirty-Detection über JSON-Vergleich (pragmatisch bei diesem
  // Datenumfang, kein Perf-Problem).
  const isDirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(baseline),
    [state, baseline]
  );

  // Browser-Warnung bei Tab-Schließen/Reload wenn ungespeicherte Änderungen.
  // Sidebar-Klicks werden NICHT abgefangen (Next 16 App Router hat keinen
  // Router-Event-Hook; das wäre eigener UX-Sprint).
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const { summeNetto, summeBrutto } = useMemo(() => {
    const netto = state.positionen.reduce(
      (acc, p) => acc + p.menge * p.einzelpreis_netto,
      0
    );
    const brutto = netto * (1 + state.mwst_satz / 100);
    return { summeNetto: round2(netto), summeBrutto: round2(brutto) };
  }, [state.positionen, state.mwst_satz]);

  function updatePosition(idx: number, patch: Partial<Position>) {
    setState((prev) => {
      const positionen = [...prev.positionen];
      const updated = { ...positionen[idx], ...patch };
      updated.gesamtpreis_netto = round2(
        Number(updated.menge) * Number(updated.einzelpreis_netto)
      );
      positionen[idx] = updated;
      return { ...prev, positionen };
    });
  }

  function addPosition() {
    setState((prev) => ({
      ...prev,
      positionen: [
        ...prev.positionen,
        {
          pos: prev.positionen.length + 1,
          bezeichnung: '',
          menge: 1,
          einheit: 'Stk',
          einzelpreis_netto: 0,
          gesamtpreis_netto: 0,
        },
      ],
    }));
  }

  function removePosition(idx: number) {
    setState((prev) => ({
      ...prev,
      positionen: prev.positionen
        .filter((_, i) => i !== idx)
        .map((p, i) => ({ ...p, pos: i + 1 })),
    }));
  }

  function movePosition(idx: number, dir: -1 | 1) {
    setState((prev) => {
      const positionen = [...prev.positionen];
      const target = idx + dir;
      if (target < 0 || target >= positionen.length) return prev;
      [positionen[idx], positionen[target]] = [positionen[target], positionen[idx]];
      return {
        ...prev,
        positionen: positionen.map((p, i) => ({ ...p, pos: i + 1 })),
      };
    });
  }

  async function save(zusatz?: Partial<EditorState>) {
    setSaving(true);
    setError(null);
    try {
      const payload = { ...state, ...(zusatz ?? {}) };
      const res = await fetch(`/api/angebote/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Speichern fehlgeschlagen');
        toast.error(data.error || 'Speichern fehlgeschlagen');
        return false;
      }
      setSavedAt(new Date());
      const neuerState = { ...state, ...(zusatz ?? {}) };
      if (zusatz) setState(neuerState);
      // Baseline für Dirty-Check nachziehen – ab jetzt ist der Editor "sauber".
      setBaseline(neuerState);
      router.refresh();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Angebot löschen?',
      description:
        'Wird endgültig entfernt. Wenn es schon an einen Kunden raus ist, lass es lieber in „abgelehnt" stehen statt zu löschen.',
      confirmLabel: 'Endgültig löschen',
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/angebote/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Löschen fehlgeschlagen');
        return;
      }
      toast.success('Angebot gelöscht');
      router.push('/dashboard/angebote');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Empfänger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Empfänger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Name
              </label>
              <Input
                value={state.empfaenger_name}
                onChange={(e) =>
                  setState({ ...state, empfaenger_name: e.target.value })
                }
                placeholder="z.B. Max Schmidt"
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Firma (optional)
              </label>
              <Input
                value={state.empfaenger_firma}
                onChange={(e) =>
                  setState({ ...state, empfaenger_firma: e.target.value })
                }
                placeholder="z.B. Schmidt Bau GmbH"
                maxLength={200}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              E-Mail
              <span className="text-muted-foreground/70"> – pflicht für Versand</span>
            </label>
            <Input
              type="email"
              value={state.empfaenger_email}
              onChange={(e) =>
                setState({ ...state, empfaenger_email: e.target.value })
              }
              placeholder="kunde@beispiel.de"
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">
                Adresse
              </label>
              <Input
                value={state.empfaenger_adresse}
                onChange={(e) =>
                  setState({ ...state, empfaenger_adresse: e.target.value })
                }
                placeholder="Straße + Nr."
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                PLZ + Ort
              </label>
              <Input
                value={state.empfaenger_plz}
                onChange={(e) =>
                  setState({ ...state, empfaenger_plz: e.target.value })
                }
                placeholder="12345 Musterstadt"
                maxLength={100}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kopf-Daten */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kopf-Daten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Titel</label>
            <Input
              value={state.titel}
              onChange={(e) => setState({ ...state, titel: e.target.value })}
              placeholder="z.B. Edelstahl-Geländer Terrasse Müller"
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Angebotsnummer
              </label>
              <Input
                value={state.angebotsnummer}
                onChange={(e) =>
                  setState({ ...state, angebotsnummer: e.target.value })
                }
                placeholder="z.B. 2026-042"
                maxLength={50}
                className="font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Gültig bis
              </label>
              <Input
                type="date"
                value={state.gueltig_bis}
                onChange={(e) =>
                  setState({ ...state, gueltig_bis: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                MwSt-Satz (%)
              </label>
              <Input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={state.mwst_satz}
                onChange={(e) =>
                  setState({
                    ...state,
                    mwst_satz: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Einleitung
            </label>
            <Textarea
              value={state.einleitung}
              onChange={(e) =>
                setState({ ...state, einleitung: e.target.value })
              }
              rows={3}
              maxLength={2000}
              placeholder={'Z.B. „Vielen Dank für deine Anfrage..." – kurzer Brücken-Text vor den Positionen.'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Positionen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Positionen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.positionen.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              Noch keine Positionen. Füg unten welche hinzu.
            </p>
          )}

          {state.positionen.map((p, idx) => (
            <div
              key={idx}
              className="rounded-md border border-input bg-muted/20 p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground w-6 flex-shrink-0">
                  {p.pos}.
                </span>
                <Input
                  value={p.bezeichnung}
                  onChange={(e) =>
                    updatePosition(idx, { bezeichnung: e.target.value })
                  }
                  placeholder="Bezeichnung"
                  className="text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => movePosition(idx, -1)}
                  disabled={idx === 0}
                  className="h-8 w-8 p-0 text-muted-foreground"
                  aria-label="Nach oben"
                >
                  <HugeiconsIcon icon={ArrowUp01Icon} size={14} strokeWidth={1.5} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => movePosition(idx, 1)}
                  disabled={idx === state.positionen.length - 1}
                  className="h-8 w-8 p-0 text-muted-foreground"
                  aria-label="Nach unten"
                >
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={14}
                    strokeWidth={1.5}
                  />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePosition(idx)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label="Position entfernen"
                >
                  <HugeiconsIcon
                    icon={CancelCircleIcon}
                    size={14}
                    strokeWidth={1.5}
                  />
                </Button>
              </div>
              <Textarea
                value={p.beschreibung ?? ''}
                onChange={(e) =>
                  updatePosition(idx, { beschreibung: e.target.value })
                }
                rows={2}
                placeholder="Optional: Beschreibung, Maße, Annahmen"
                className="text-sm"
              />
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-0.5 block">
                    Menge
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={p.menge}
                    onChange={(e) =>
                      updatePosition(idx, {
                        menge: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-0.5 block">
                    Einheit
                  </label>
                  <select
                    value={p.einheit}
                    onChange={(e) =>
                      updatePosition(idx, { einheit: e.target.value })
                    }
                    className="rounded-md border border-input bg-background px-2 text-sm h-9 w-full"
                  >
                    {EINHEITEN.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-0.5 block">
                    Einzelpreis €
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={p.einzelpreis_netto}
                    onChange={(e) =>
                      updatePosition(idx, {
                        einzelpreis_netto: Math.max(
                          0,
                          Number(e.target.value) || 0
                        ),
                      })
                    }
                    className="text-sm"
                  />
                  {p.ki_schaetzpreis !== undefined &&
                    Math.abs(p.ki_schaetzpreis - p.einzelpreis_netto) > 0.01 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        KI-Vorschlag war {formatEuro(p.ki_schaetzpreis)}
                      </p>
                    )}
                </div>
                <div className="col-span-2 sm:col-span-2 text-right">
                  <label className="text-[11px] text-muted-foreground mb-0.5 block">
                    Gesamt
                  </label>
                  <p className="font-medium text-sm h-9 flex items-center justify-end">
                    {formatEuro(p.gesamtpreis_netto)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addPosition}
            className="gap-1.5"
          >
            <HugeiconsIcon icon={AddSquareIcon} size={14} strokeWidth={1.5} />
            Position hinzufügen
          </Button>
        </CardContent>
      </Card>

      {/* Summen + Schluss */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summen + Schluss</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-input bg-muted/20 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Netto</span>
              <span className="font-medium">{formatEuro(summeNetto)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                + MwSt {state.mwst_satz} %
              </span>
              <span className="font-medium">
                {formatEuro(summeBrutto - summeNetto)}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t mt-1">
              <span className="font-medium">Brutto</span>
              <span className="font-bold text-base">{formatEuro(summeBrutto)}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Schlusstext
            </label>
            <Textarea
              value={state.schlusstext}
              onChange={(e) =>
                setState({ ...state, schlusstext: e.target.value })
              }
              rows={3}
              maxLength={2000}
              placeholder={'Z.B. „Angebot gültig 30 Tage. Aufmaß vor Auftrag noch zu prüfen."'}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Interne Notiz (nicht im PDF)
            </label>
            <Textarea
              value={state.notiz_intern}
              onChange={(e) =>
                setState({ ...state, notiz_intern: e.target.value })
              }
              rows={2}
              maxLength={2000}
              placeholder={'Eigene Anmerkungen, z.B. „Kunde will bis Ende Juli fertig".'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Status:</span>
            <select
              value={state.status}
              onChange={(e) =>
                setState({
                  ...state,
                  status: e.target.value as EditorState['status'],
                })
              }
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="entwurf">Entwurf</option>
              <option value="versendet">Versendet</option>
              <option value="angenommen">Angenommen</option>
              <option value="abgelehnt">Abgelehnt</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <p className="text-xs">
              {isDirty ? (
                <span className="text-amber-700 font-medium">
                  Ungespeicherte Änderungen
                </span>
              ) : savedAt ? (
                <span className="text-muted-foreground">
                  Gespeichert {savedAt.toLocaleTimeString('de-DE')}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Wird beim Klick auf „Speichern" gespeichert.
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                disabled={saving}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Löschen
              </Button>
              <Button asChild variant="outline" disabled={saving}>
                <a href={`/api/angebote/${id}/pdf`} target="_blank" rel="noopener noreferrer">
                  PDF
                </a>
              </Button>
              <Button
                onClick={() => save()}
                disabled={saving}
                variant={state.status === 'entwurf' ? 'outline' : 'default'}
              >
                {saving ? 'Speichern…' : 'Speichern'}
              </Button>
              {state.status === 'entwurf' && (
                <SendenModal
                  id={id}
                  empfaengerEmail={state.empfaenger_email || null}
                  defaultBetreff={
                    state.titel
                      ? `Angebot: ${state.titel}`
                      : state.angebotsnummer
                      ? `Angebot ${state.angebotsnummer}`
                      : 'Angebot'
                  }
                  defaultBody={[
                    state.empfaenger_name
                      ? `Hallo ${
                          state.empfaenger_name.split(' ').slice(-1)[0] ||
                          state.empfaenger_name
                        },`
                      : 'Hallo,',
                    '',
                    state.einleitung ||
                      'anbei das Angebot wie besprochen. Bei Fragen melde dich gern.',
                    '',
                    'Beste Grüße',
                  ].join('\n')}
                  disabled={saving}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
