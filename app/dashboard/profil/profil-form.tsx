'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { LogoUploader } from './logo-uploader';

export type Gebiet = {
  plz_muster: string;
  label: string;
  mindestauftragswert: number | null;
};

type ProfilData = {
  name: string;
  inhaber: string;
  branche: string;
  inbound_email: string;
  region: string;
  mindestauftragswert: number | null;
  was_wir_machen: string[];
  was_wir_nicht_machen: string[];
  wichtige_kunden: string[];
  signatur: string;
  ton_beispiele: string[];
  vermeiden: string;
  gebiete: Gebiet[];
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function ProfilForm({
  betriebId,
  initialData,
}: {
  betriebId: string;
  initialData: ProfilData;
}) {
  const router = useRouter();
  const [data, setData] = useState<ProfilData>(initialData);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty = JSON.stringify(data) !== JSON.stringify(initialData);

  async function save() {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      // inbound_email NICHT mitschicken – ist read-only
      const payload = { ...data };
      delete (payload as Partial<ProfilData>).inbound_email;

      const res = await fetch(`/api/betriebe/${betriebId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Speichern fehlgeschlagen');
      }
      setSaveStatus('saved');
      startTransition(() => router.refresh());
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      setSaveStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unbekannter Fehler');
    }
  }

  return (
    <div className="space-y-6">
      {/* Stammdaten */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stammdaten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Betriebsname</Label>
              <Input
                id="name"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                placeholder="z.B. Metallbau Mustermann GmbH"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="inhaber">Inhaber</Label>
              <Input
                id="inhaber"
                value={data.inhaber}
                onChange={(e) => setData({ ...data, inhaber: e.target.value })}
                placeholder="z.B. Max Mustermann"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="branche">Branche</Label>
              <Input
                id="branche"
                value={data.branche}
                onChange={(e) => setData({ ...data, branche: e.target.value })}
                placeholder="z.B. metallbau"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Beeinflusst die KI-Klassifikation. Behutsam ändern.
              </p>
            </div>
            <div>
              <Label htmlFor="inbound_email" className="flex items-center gap-2">
                Inbound-Mail
                <span className="text-xs text-muted-foreground font-normal">
                  (fest)
                </span>
              </Label>
              <Input
                id="inbound_email"
                value={data.inbound_email}
                readOnly
                disabled
                className="mt-1.5 font-mono text-xs bg-muted/50 cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Postmark-Konfiguration. Änderung nur durch Admin möglich.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Region + Mindestauftrag */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Geschäftsbereich</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="region">Region / Einsatzgebiet</Label>
            <Input
              id="region"
              value={data.region}
              onChange={(e) => setData({ ...data, region: e.target.value })}
              placeholder="z.B. München und Umland (bis 50 km)"
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Hilft der KI zu entscheiden, ob Anfragen geografisch passen.
            </p>
          </div>

          <div>
            <Label htmlFor="mindestauftragswert">
              Allgemeiner Mindestauftragswert (€)
            </Label>
            <Input
              id="mindestauftragswert"
              type="number"
              min={0}
              step={100}
              value={data.mindestauftragswert ?? ''}
              onChange={(e) =>
                setData({
                  ...data,
                  mindestauftragswert:
                    e.target.value === '' ? null : Number(e.target.value),
                })
              }
              placeholder="z.B. 5000"
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Gilt überall – wenn du unten Regionen einträgst, gewinnt der
              Wert pro Region.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Einzugsgebiete – PLZ-Muster + Mindestauftragswert pro Gebiet */}
      <GebieteEditor
        items={data.gebiete}
        onChange={(items) => setData({ ...data, gebiete: items })}
      />

      {/* Was wir machen */}
      <ListEditor
        title="Was wir machen"
        description="Gewerke und Leistungen. KI prüft anhand dieser Liste, ob eine Anfrage zum Betrieb passt."
        items={data.was_wir_machen}
        onChange={(items) => setData({ ...data, was_wir_machen: items })}
        placeholder="z.B. Geländer aus Edelstahl (V2A, V4A)"
        addLabel="+ Gewerk hinzufügen"
        emptyText="Noch keine Gewerke eingetragen."
      />

      {/* Was wir NICHT machen */}
      <ListEditor
        title="Was wir NICHT machen"
        description="Klare Ausschlüsse. KI lehnt entsprechende Anfragen höflich ab."
        items={data.was_wir_nicht_machen}
        onChange={(items) => setData({ ...data, was_wir_nicht_machen: items })}
        placeholder="z.B. Aluminium-Konstruktionen"
        addLabel="+ Ausschluss hinzufügen"
        emptyText="Keine Ausschlüsse definiert."
      />

      {/* Wichtige Kunden */}
      <ListEditor
        title="Wichtige Kunden"
        description="Stammkunden / Großkunden. KI gibt deren Anfragen höhere Priorität."
        items={data.wichtige_kunden}
        onChange={(items) => setData({ ...data, wichtige_kunden: items })}
        placeholder="z.B. Bauträger Müller GmbH"
        addLabel="+ Kunde hinzufügen"
        emptyText="Noch keine Stammkunden eingetragen."
      />

      {/* Signatur */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signatur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={data.signatur}
            onChange={(e) => setData({ ...data, signatur: e.target.value })}
            rows={6}
            maxLength={5000}
            placeholder={`Mit freundlichen Grüßen\nMax Mustermann\nMustermann Bau\n...`}
            className="font-sans"
          />
          <p className="text-xs text-muted-foreground">
            Wird automatisch unter jeden KI-Entwurf gesetzt. Logo wird – wenn
            hochgeladen – darunter eingebettet.
          </p>
          <LogoUploader />
        </CardContent>
      </Card>

      {/* Tonbeispiele */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stilbeispiele</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Beispiele, wie eine perfekte Antwort von dir aussieht. Je mehr und je
            besser die Beispiele, desto natürlicher klingen die KI-Entwürfe nach
            deinem Stil. <strong>Wichtigstes Feld im Profil.</strong>
          </p>
          <TonbeispieleEditor
            items={data.ton_beispiele}
            onChange={(items) => setData({ ...data, ton_beispiele: items })}
          />
        </CardContent>
      </Card>

      {/* Vermeiden – negatives Pendant zu Stilbeispielen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Was die KI vermeiden soll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Sag der KI klar was du <em>nicht</em> in deinen Antworten sehen
            willst. Genauso wichtig wie Stilbeispiele – oft sogar wirksamer.
          </p>
          <Textarea
            id="vermeiden"
            value={data.vermeiden}
            onChange={(e) => setData({ ...data, vermeiden: e.target.value })}
            placeholder={`Zum Beispiel:
• Keine Gedankenstriche (–) im Mitteltext.
• Sag „gern" statt „gerne".
• Nicht zu förmlich – ich duze viele Kunden.
• Kein „Es freut mich, von Ihnen zu hören".
• Keine englischen Begriffe wie „Service".`}
            rows={6}
            maxLength={2000}
            className="font-sans text-sm leading-relaxed"
          />
          <p className="text-[11px] text-muted-foreground">
            {data.vermeiden.length}/2000 Zeichen
          </p>
        </CardContent>
      </Card>

      {/* Save-Bar */}
      <div className="sticky bottom-4 z-20">
        <div className="flex items-center justify-between gap-4 rounded-md border bg-background px-4 py-3 shadow-md">
          <div className="flex-1 text-sm">
            {saveStatus === 'saved' && (
              <span className="text-green-600 font-medium">Gespeichert</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-destructive">
                Fehler: {errorMessage || 'unbekannt'}
              </span>
            )}
            {saveStatus === 'idle' && isDirty && (
              <span className="text-muted-foreground">Du hast Änderungen.</span>
            )}
            {saveStatus === 'idle' && !isDirty && (
              <span className="text-muted-foreground">Alles aktuell.</span>
            )}
          </div>
          <Button
            onClick={save}
            disabled={!isDirty || saveStatus === 'saving' || isPending}
          >
            {saveStatus === 'saving' ? 'Speichert…' : 'Speichern'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Sub-Components ─────────────── */

/**
 * Eine simple Textarea statt Liste-mit-Add-Buttons. Owner schreibt
 * frei rein (Komma, Semikolon oder Zeilenumbrüche egal) – beim Save
 * wird automatisch in items[] gesplittet. Lehre aus Pilot-Feedback:
 * Handwerker lesen kein UI, Klick+Add+Eingabe pro Item ist zu viel
 * Reibung. Eine Textarea ist genau Friction-frei.
 */
function ListEditor({
  title,
  description,
  items,
  onChange,
  placeholder,
  emptyText: _emptyText,
}: {
  title: string;
  description: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  // addLabel/emptyText sind in der neuen Textarea-UX nicht mehr nötig –
  // bleiben in der Signatur als optional für Backward-Kompatibilität.
  addLabel?: string;
  emptyText?: string;
}) {
  // Lokaler Textarea-State, damit der User Zeilen mitten in der Eingabe
  // haben kann ohne dass jeder Tastenanschlag das Items-Array umbaut.
  // Synchronisiert mit items[] beim Blur (oder Save via Parent).
  const [draft, setDraft] = useState(items.join('\n'));

  function parseDraft(raw: string): string[] {
    // Split bei Zeilenumbruch, Komma oder Semikolon – jedem Item trimmen.
    return raw
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  function commit(raw: string) {
    setDraft(raw);
    onChange(parseDraft(raw));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{description}</p>
        <Textarea
          value={draft}
          onChange={(e) => commit(e.target.value)}
          placeholder={placeholder}
          rows={Math.min(Math.max(items.length + 1, 3), 8)}
          maxLength={3000}
          className="font-sans text-sm leading-relaxed"
        />
        <p className="text-[11px] text-muted-foreground">
          {items.length === 0
            ? 'Eine Zeile pro Eintrag, oder durch Komma trennen.'
            : `${items.length} ${items.length === 1 ? 'Eintrag' : 'Einträge'} – eine Zeile pro Eintrag, oder durch Komma trennen.`}
        </p>
      </CardContent>
    </Card>
  );
}

function TonbeispieleEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const confirm = useConfirm();
  const [draft, setDraft] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  function add() {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft('');
  }

  async function remove(idx: number) {
    const ok = await confirm({
      title: 'Stilbeispiel entfernen?',
      confirmLabel: 'Entfernen',
      destructive: true,
    });
    if (!ok) return;
    onChange(items.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
  }

  function update(idx: number, value: string) {
    onChange(items.map((it, i) => (i === idx ? value : it)));
  }

  function preview(text: string): string {
    const firstLine = text.split('\n').find((l) => l.trim().length > 0) ?? '';
    return firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{items.length} Beispiele</Badge>
        {items.length < 3 && (
          <span className="text-amber-600">
            Empfehlung: mindestens 3 Beispiele für guten Stil-Transfer.
          </span>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => {
          const isExpanded = expandedIdx === idx;
          return (
            <div
              key={idx}
              className={cn(
                'rounded-md border bg-background',
                isExpanded && 'border-primary/40 shadow-sm'
              )}
            >
              <button
                type="button"
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
              >
                <span className="text-sm flex-1 truncate">
                  <span className="text-muted-foreground text-xs mr-2">#{idx + 1}</span>
                  {preview(item)}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {isExpanded ? 'einklappen' : 'bearbeiten'}
                </span>
              </button>
              {isExpanded && (
                <div className="border-t p-3 space-y-2">
                  <Textarea
                    value={item}
                    onChange={(e) => update(idx, e.target.value)}
                    rows={Math.max(6, Math.min(20, item.split('\n').length + 1))}
                    maxLength={3000}
                    className="font-sans"
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(idx)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      Beispiel entfernen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-md border border-dashed p-3 space-y-2">
        <p className="text-xs text-muted-foreground">Neues Stilbeispiel hinzufügen</p>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          maxLength={3000}
          disabled={items.length >= 10}
          placeholder={
            items.length >= 10
              ? 'Maximum von 10 Stilbeispielen erreicht – ältere entfernen für neue.'
              : `Servus Herr ...,\n\nvielen Dank für Ihre Anfrage. ...\n\nBeste Grüße\nMax`
          }
          className="font-sans"
        />
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={add} disabled={!draft.trim()}>
            + Beispiel hinzufügen
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * GebieteEditor: Tabellen-artiger Editor für betriebe.gebiete.
 * Jede Zeile = ein PLZ-Tier mit Muster, Label, Mindestauftragswert.
 *
 * Pattern-Beispiele:
 *   "85*"   → alle PLZ die mit 85 beginnen (Hauptgebiet)
 *   "80*"   → München-Stadt
 *   "85737" → genau diese PLZ
 *   "*"     → Wildcard-Fallback (immer am Ende)
 *
 * Reihenfolge zählt: erste Übereinstimmung gewinnt → spezifischste oben,
 * "*" unten. Die KI verwendet die Liste im Entwurf-Prompt.
 */
function GebieteEditor({
  items,
  onChange,
}: {
  items: Gebiet[];
  onChange: (items: Gebiet[]) => void;
}) {
  function addRow() {
    onChange([
      ...items,
      { plz_muster: '', label: '', mindestauftragswert: null },
    ]);
  }

  function removeRow(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, patch: Partial<Gebiet>) {
    onChange(items.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...items];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Einzugsgebiet & Mindestaufträge</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Trag ein, wo du normalerweise arbeitest und ab welcher
            Auftragsgröße es sich für dich lohnt. Die KI geht die Liste
            von oben nach unten durch – schreib also deine wichtigsten
            Regionen zuerst hin.
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            So schreibst du die PLZ:{' '}
            <strong>85*</strong> = alle PLZ die mit 85 anfangen.{' '}
            <strong>85737</strong> = nur genau diese PLZ.{' '}
            <strong>*</strong> = alles andere.
          </p>
        </div>

        {items.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            Noch nichts eingetragen. Solange hier leer ist, gilt der
            „Allgemeine Mindestauftragswert" oben für alle Anfragen.
          </p>
        )}

        {items.length > 0 && (
          <div className="space-y-3 sm:space-y-2">
            {/* Header-Zeile – nur Desktop, Mobile nutzt Placeholder */}
            <div className="hidden sm:grid grid-cols-[80px_1fr_110px_64px] gap-2 px-1 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              <span>PLZ</span>
              <span>Region</span>
              <span>Ab € lohnt's</span>
              <span></span>
            </div>

            {items.map((g, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-2 rounded-md border border-input bg-muted/20 p-2 sm:flex-none sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:grid sm:grid-cols-[80px_1fr_110px_64px] sm:items-center"
              >
                <Input
                  value={g.plz_muster}
                  onChange={(e) =>
                    updateRow(idx, { plz_muster: e.target.value })
                  }
                  placeholder="85*"
                  maxLength={20}
                  className="font-mono text-sm"
                />
                <Input
                  value={g.label}
                  onChange={(e) => updateRow(idx, { label: e.target.value })}
                  placeholder="z.B. Ismaning & Umkreis"
                  maxLength={80}
                  className="text-sm"
                />
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={g.mindestauftragswert ?? ''}
                  onChange={(e) =>
                    updateRow(idx, {
                      mindestauftragswert:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="100"
                  className="text-sm"
                />
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    title="Nach oben"
                    aria-label="Nach oben verschieben"
                    className="h-8 w-7 p-0 text-muted-foreground hover:text-foreground"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(idx)}
                    title="Entfernen"
                    aria-label="Gebiet entfernen"
                    className="h-8 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    ×
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={addRow}>
            + Region hinzufügen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}