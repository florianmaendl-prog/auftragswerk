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
  Tag01Icon,
  CancelCircleIcon,
  AddSquareIcon,
} from '@hugeicons/core-free-icons';

type Regel = {
  id: string;
  sender_pattern: string;
  tag: string;
  created_at: string;
};

/**
 * Profil-Sektion für Custom-Tags + Sender→Tag-Regeln.
 *
 * Owner kann:
 *  - Sender-Pattern (z.B. "obi.de") + Tag (z.B. "Lieferanten") eintragen
 *  - Vorhandene Regeln löschen
 *
 * Auto-Set passiert serverseitig im Inbound-Webhook nach der Klassifikation.
 * Tags die hier nicht stehen können auch manuell in Anfrage-Detail
 * vergeben werden – dann landen sie als "freie Tags" in der Anfrage.
 */
export function TagRegelnCard() {
  const router = useRouter();
  const confirm = useConfirm();
  const [regeln, setRegeln] = useState<Regel[]>([]);
  const [neuesPattern, setNeuesPattern] = useState('');
  const [neuerTag, setNeuerTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [lade, setLade] = useState(true);

  useEffect(() => {
    fetch('/api/profil/tag-regeln')
      .then((r) => r.json())
      .then((d) => setRegeln(d.regeln ?? []))
      .catch(() => undefined)
      .finally(() => setLade(false));
  }, []);

  async function handleAdd() {
    const sp = neuesPattern.trim();
    const tg = neuerTag.trim();
    if (!sp || !tg) {
      toast.error('Sender-Pattern und Tag müssen ausgefüllt sein');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/profil/tag-regeln', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_pattern: sp, tag: tg }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Hinzufügen fehlgeschlagen');
        return;
      }
      setRegeln((prev) => [data.regel, ...prev]);
      setNeuesPattern('');
      setNeuerTag('');
      toast.success('Regel hinzugefügt');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Hinzufügen fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(regel: Regel) {
    if (busy) return;
    const ok = await confirm({
      title: 'Regel löschen?',
      description: `Neue Mails von „${regel.sender_pattern}" bekommen ab sofort keinen automatischen Tag „${regel.tag}" mehr.`,
      confirmLabel: 'Regel löschen',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/profil/tag-regeln/${regel.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Löschen fehlgeschlagen');
        return;
      }
      setRegeln((prev) => prev.filter((r) => r.id !== regel.id));
      toast.success('Regel gelöscht');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HugeiconsIcon icon={Tag01Icon} size={18} strokeWidth={1.5} />
          Eigene Tags + Sender-Regeln
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Trage einen Absender-Pattern und einen Tag ein. Sobald eine Mail
          mit dem Pattern reinkommt, wird der Tag automatisch gesetzt –
          du siehst die Anfrage dann mit dem Tag in der Inbox. Pattern
          matcht als Teil-String (z.B. „obi.de" passt auf „info@obi.de"
          und „bestellung@obi.de").
        </p>

        {!lade && regeln.length > 0 && (
          <div className="space-y-2">
            {regeln.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-md border border-input bg-muted/30 p-2 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
                  {r.sender_pattern}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                  {r.tag}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(r)}
                  disabled={busy}
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label="Regel entfernen"
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

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Sender enthält… (z.B. obi.de)"
            value={neuesPattern}
            onChange={(e) => setNeuesPattern(e.target.value)}
            disabled={busy}
            maxLength={200}
            className="font-mono text-sm"
          />
          <Input
            placeholder="Tag (z.B. Lieferanten)"
            value={neuerTag}
            onChange={(e) => setNeuerTag(e.target.value)}
            disabled={busy}
            maxLength={60}
            className="text-sm"
          />
          <Button
            type="button"
            onClick={handleAdd}
            disabled={busy}
            className="gap-1.5 sm:w-auto w-full min-h-11"
          >
            <HugeiconsIcon icon={AddSquareIcon} size={14} strokeWidth={1.5} />
            Hinzufügen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
