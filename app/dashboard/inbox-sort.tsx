'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { SortingDownIcon } from '@hugeicons/core-free-icons';

type SortMode = 'datum' | 'dringlichkeit' | 'wert' | 'kategorie';

const LABELS: Record<SortMode, string> = {
  datum: 'Neueste zuerst',
  dringlichkeit: 'Dringlichste zuerst',
  wert: 'Höchster Wert zuerst',
  kategorie: 'Nach Kategorie',
};

/**
 * Sort-Picker für die Inbox. Klein und handwerker-freundlich –
 * ein simples Select, kein Drag&Drop oder Multi-Sort.
 * URL-Param `?sort=` damit die Wahl persistent bleibt + teilbar ist.
 */
export function InboxSort() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = (searchParams.get('sort') ?? 'datum') as SortMode;

  function setSort(neu: SortMode) {
    const sp = new URLSearchParams(searchParams.toString());
    if (neu === 'datum') {
      sp.delete('sort');
    } else {
      sp.set('sort', neu);
    }
    const qs = sp.toString();
    router.push(qs ? `/dashboard?${qs}` : '/dashboard');
  }

  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <HugeiconsIcon icon={SortingDownIcon} size={14} strokeWidth={1.5} />
      Sortieren:
      <select
        value={current}
        onChange={(e) => setSort(e.target.value as SortMode)}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
      >
        {(Object.keys(LABELS) as SortMode[]).map((mode) => (
          <option key={mode} value={mode}>
            {LABELS[mode]}
          </option>
        ))}
      </select>
    </label>
  );
}
