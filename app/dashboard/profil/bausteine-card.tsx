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
  PuzzleIcon,
  CancelCircleIcon,
  AddSquareIcon,
} from '@hugeicons/core-free-icons';

type Baustein = {
  id: string;
  kategorie: string | null;
  bezeichnung: string;
  beschreibung: string | null;
  einheit: string;
  material_kosten: number;
  arbeitszeit_min: number;
  kalkulations_faktor: number;
};

const EINHEITEN = ['Stk', 'm', 'm²', 'm³', 'h', 'pauschal'];

/**
 * Säule-2-Profil-Sektion: Bausteine = wiederverwendbare Positions-Templates.
 *
 * Owner trägt typische Leistungen ein (z.B. „Edelstahl-Geländer-Pfosten") mit
 * Material-Kosten + Arbeitszeit + Aufschlag-Faktor. Der Angebots-Generator
 * (S2.2) nutzt diese Bausteine, um aus einer Anfrage einen Vorschlag zu bauen.
 *
 * Löschen ist Soft-Delete (aktiv=false), damit alte Angebote ihre Referenz
 * behalten.
 */
export function BausteineCard() {
  const router = useRouter();
  const confirm = useConfirm();
  const [items, setItems] = useState<Baustein[]>([]);
  const [bezeichnung, setBezeichnung] = useState('');
  const [einheit, setEinheit] = useState('Stk');
  const [materialKosten, setMaterialKosten] = useState('');
  const [arbeitszeitMin, setArbeitszeitMin] = useState('');
  const [faktor, setFaktor] = useState('1.0');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/profil/bausteine')
      .then((r) => r.json())
      .then((d) => setItems(d.bausteine ?? []))
      .catch(() => undefined);
  }, []);

  async function handleAdd() {
    if (!bezeichnung.trim()) {
      toast.error('Bezeichnung fehlt');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/profil/bausteine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bezeichnung: bezeichnung.trim(),
          einheit,
          material_kosten: Number(materialKosten) || 0,
          arbeitszeit_min: Number(arbeitszeitMin) || 0,
          kalkulations_faktor: Number(faktor) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Hinzufügen fehlgeschlagen');
        return;
      }
      setItems((prev) => [...prev, data.baustein]);
      setBezeichnung('');
      setMaterialKosten('');
      setArbeitszeitMin('');
      setFaktor('1.0');
      toast.success('Baustein hinzugefügt');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(b: Baustein) {
    if (busy) return;
    const ok = await confirm({
      title: `Baustein „${b.bezeichnung}" entfernen?`,
      description:
        'Bestehende Angebote bleiben unverändert. Der Baustein wird nur in zukünftigen Angeboten nicht mehr vorgeschlagen.',
      confirmLabel: 'Entfernen',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/profil/bausteine/${b.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Entfernen fehlgeschlagen');
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== b.id));
      toast.success('Baustein entfernt');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HugeiconsIcon icon={PuzzleIcon} size={18} strokeWidth={1.5} />
          Bausteine für Angebote
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Typische Leistungen mit Material-Kosten und Arbeitszeit. Der Angebots-
          Generator nutzt diese Liste, um aus einer Kunden-Anfrage einen Entwurf
          zu bauen. Beispiel: „Geländer-Pfosten Edelstahl" → 45 € Material + 30
          min Arbeit, Faktor 1.4.
        </p>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-2 rounded-md border border-input bg-muted/30 p-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{b.bezeichnung}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {Number(b.material_kosten).toFixed(2)} € Material ·{' '}
                    {b.arbeitszeit_min} min Arbeit · ×
                    {Number(b.kalkulations_faktor).toFixed(2)} · pro {b.einheit}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(b)}
                  disabled={busy}
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label="Baustein entfernen"
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
            placeholder="Bezeichnung (z.B. Geländer-Pfosten Edelstahl)"
            value={bezeichnung}
            onChange={(e) => setBezeichnung(e.target.value)}
            disabled={busy}
            maxLength={200}
            className="text-sm"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
              placeholder="Material €"
              value={materialKosten}
              onChange={(e) => setMaterialKosten(e.target.value)}
              disabled={busy}
              className="text-sm"
            />
            <Input
              type="number"
              min={0}
              step={5}
              placeholder="Min Arbeit"
              value={arbeitszeitMin}
              onChange={(e) => setArbeitszeitMin(e.target.value)}
              disabled={busy}
              className="text-sm"
            />
            <Input
              type="number"
              min={0.5}
              step={0.05}
              placeholder="Faktor"
              value={faktor}
              onChange={(e) => setFaktor(e.target.value)}
              disabled={busy}
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
            Baustein hinzufügen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
