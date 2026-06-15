'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tag01Icon, CancelCircleIcon, AddSquareIcon } from '@hugeicons/core-free-icons';

/**
 * Tag-Editor auf der Anfrage-Detail-Page. Owner kann manuell Tags
 * hinzufügen/entfernen (z.B. "Wichtig", "Anrufen", "später"). Tags
 * werden über die schon existierende POST /api/anfragen/[id]/tags-Route
 * persistiert.
 *
 * Auto-Tags von tag_regeln werden hier neben manuellen Tags angezeigt
 * – kein Unterschied im UI, alle landen in anfragen.tags.
 */
export function TagEditor({
  anfrageId,
  initialTags,
}: {
  anfrageId: string;
  initialTags: string[];
}) {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [neuerTag, setNeuerTag] = useState('');
  const [busy, setBusy] = useState(false);

  async function mutiere(tag: string, action: 'add' | 'remove') {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/anfragen/${anfrageId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Tag-Update fehlgeschlagen');
        return;
      }
      setTags(data.tags);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tag-Update fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    const tag = neuerTag.trim();
    if (!tag) return;
    if (tags.includes(tag)) {
      toast.info('Tag ist schon gesetzt');
      setNeuerTag('');
      return;
    }
    await mutiere(tag, 'add');
    setNeuerTag('');
  }

  return (
    <div className="rounded-md border border-input bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <HugeiconsIcon icon={Tag01Icon} size={12} strokeWidth={1.5} />
        Tags
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && (
          <span className="text-xs text-muted-foreground italic">
            Keine Tags
          </span>
        )}
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"
          >
            {t}
            <button
              type="button"
              onClick={() => mutiere(t, 'remove')}
              disabled={busy}
              className="text-primary/70 hover:text-destructive disabled:opacity-50"
              aria-label={`Tag ${t} entfernen`}
            >
              <HugeiconsIcon
                icon={CancelCircleIcon}
                size={11}
                strokeWidth={1.5}
              />
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
        className="flex gap-1.5"
      >
        <Input
          value={neuerTag}
          onChange={(e) => setNeuerTag(e.target.value)}
          placeholder="Neuer Tag…"
          disabled={busy}
          maxLength={60}
          className="text-sm h-8"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={busy || !neuerTag.trim()}
          className="h-8 gap-1"
          aria-label="Tag hinzufügen"
        >
          <HugeiconsIcon icon={AddSquareIcon} size={12} strokeWidth={1.5} />
        </Button>
      </form>
    </div>
  );
}
