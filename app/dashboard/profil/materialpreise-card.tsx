'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PackageIcon,
  CancelCircleIcon,
  AddSquareIcon,
} from '@hugeicons/core-free-icons';

type Material = {
  id: string;
  bezeichnung: string;
  artikelnummer: string | null;
  einheit: string;
  einkaufspreis: number;
  lieferant: string | null;
  preis_stand: string | null;
};

const EINHEITEN = ['Stk', 'm', 'm²', 'm³', 'kg', 'l', 'pauschal'];

/**
 * Säule-2-Profil-Sektion: Material-Einkaufspreise.
 *
 * Owner pflegt eine kompakte Material-Liste. Der Angebots-Generator (S2.2)
 * kann später bei einer Anfrage daraus konkrete Kostenpositionen ableiten.
 */
export function MaterialpreiseCard() {
  const router = useRouter();
  const confirm = useConfirm();
  const [items, setItems] = useState<Material[]>([]);
  const [bezeichnung, setBezeichnung] = useState('');
  const [einheit, setEinheit] = useState('Stk');
  const [einkaufspreis, setEinkaufspreis] = useState('');
  const [lieferant, setLieferant] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/profil/materialpreise')
      .then((r) => r.json())
      .then((d) => setItems(d.materialien ?? []))
      .catch(() => undefined);
  }, []);

  async function handleAdd() {
    if (!bezeichnung.trim()) {
      toast.error('Bezeichnung fehlt');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/profil/materialpreise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bezeichnung: bezeichnung.trim(),
          einheit,
          einkaufspreis: Number(einkaufspreis) || 0,
          lieferant: lieferant.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Hinzufügen fehlgeschlagen');
        return;
      }
      setItems((prev) => [...prev, data.material]);
      setBezeichnung('');
      setEinkaufspreis('');
      setLieferant('');
      toast.success('Material gespeichert');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(m: Material) {
    if (busy) return;
    const ok = await confirm({
      title: `Material „${m.bezeichnung}" entfernen?`,
      description: 'Nur die Listen-Position. Bestehende Angebote bleiben unverändert.',
      confirmLabel: 'Entfernen',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/profil/materialpreise/${m.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Entfernen fehlgeschlagen');
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== m.id));
      toast.success('Material entfernt');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HugeiconsIcon icon={PackageIcon} size={18} strokeWidth={1.5} />
          Material-Einkaufspreise
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Liste deiner typischen Material-Einkaufspreise. Wird von der KI bei
          der Angebots-Erstellung als Kostengrundlage genutzt. Bezeichnung
          möglichst eindeutig (z.B. „Edelstahl-Rohr V2A 42,4mm").
        </p>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-md border border-input bg-muted/30 p-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{m.bezeichnung}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {Number(m.einkaufspreis).toFixed(2)} € / {m.einheit}
                    {m.lieferant ? ` · ${m.lieferant}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(m)}
                  disabled={busy}
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label="Material entfernen"
                >
                  <HugeiconsIcon
                    icon={CancelCircleIcon}
                    size={14}
                    strokeWidth={1.5}
                  />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 rounded-md border border-input p-3 bg-background">
          <Input
            placeholder="Bezeichnung (z.B. Edelstahl-Rohr V2A 42,4mm)"
            value={bezeichnung}
            onChange={(e) => setBezeichnung(e.target.value)}
            disabled={busy}
            maxLength={200}
            className="text-sm"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <select
              value={einheit}
              onChange={(e) => setEinheit(e.target.value)}
              disabled={busy}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm h-9"
            >
              {EINHEITEN.map((e) => (
                <option key={e} value={e}>
                  pro {e}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder="Einkaufspreis €"
              value={einkaufspreis}
              onChange={(e) => setEinkaufspreis(e.target.value)}
              disabled={busy}
              className="text-sm"
            />
            <Input
              placeholder="Lieferant (optional)"
              value={lieferant}
              onChange={(e) => setLieferant(e.target.value)}
              disabled={busy}
              maxLength={100}
              className="text-sm"
            />
          </div>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={busy}
            className="gap-1.5 w-full sm:w-auto min-h-11"
          >
            <HugeiconsIcon icon={AddSquareIcon} size={14} strokeWidth={1.5} />
            Material hinzufügen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
