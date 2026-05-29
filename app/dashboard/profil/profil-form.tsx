'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
            <Label htmlFor="mindestauftragswert">Mindestauftragswert (€)</Label>
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
              KI markiert Anfragen unter diesem Wert als „unter Mindestauftrag".
            </p>
          </div>
        </CardContent>
      </Card>

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
        <CardContent>
          <Textarea
            value={data.signatur}
            onChange={(e) => setData({ ...data, signatur: e.target.value })}
            rows={6}
            maxLength={5000}
            placeholder={`Mit freundlichen Grüßen\nMax Mustermann\nMetallbau Max\n...`}
            className="font-sans"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Wird automatisch unter jeden KI-Entwurf gesetzt.
          </p>
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

function ListEditor({
  title,
  description,
  items,
  onChange,
  placeholder,
  addLabel,
  emptyText,
}: {
  title: string;
  description: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
  emptyText: string;
}) {
  const [draft, setDraft] = useState('');

  function add() {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft('');
  }

  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function update(idx: number, value: string) {
    onChange(items.map((it, i) => (i === idx ? value : it)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{description}</p>

        {items.length === 0 && (
          <p className="text-sm text-muted-foreground italic">{emptyText}</p>
        )}

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={item}
                onChange={(e) => update(idx, e.target.value)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(idx)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label="Entfernen"
              >
                ×
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            maxLength={500}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={add} disabled={!draft.trim()}>
            {addLabel}
          </Button>
        </div>
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
  const [draft, setDraft] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  function add() {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft('');
  }

  function remove(idx: number) {
    if (!confirm('Dieses Stilbeispiel wirklich entfernen?')) return;
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