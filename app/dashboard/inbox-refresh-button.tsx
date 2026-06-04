'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { RefreshIcon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

/**
 * Manueller Refresh-Knopf für die Inbox. Auto-Refresh ist noch im
 * Backlog (würde Polling-Last und Komplexität bringen) – manueller
 * Reload deckt 90% der Fälle: Owner sieht "ich warte gerade auf was",
 * drückt einmal kurz, sieht ob's da ist.
 */
export function InboxRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [justRefreshed, setJustRefreshed] = useState(false);

  function refresh() {
    startTransition(() => {
      router.refresh();
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 1200);
    });
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={isPending}
      title="Inbox aktualisieren"
      aria-label="Inbox aktualisieren"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 min-h-9 px-3 rounded-md',
        'text-sm font-medium border border-input bg-background',
        'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        'transition-colors disabled:opacity-60 disabled:cursor-wait'
      )}
    >
      <HugeiconsIcon
        icon={RefreshIcon}
        size={14}
        strokeWidth={2}
        className={cn(isPending && 'animate-spin')}
      />
      <span>{justRefreshed ? 'Aktuell' : 'Aktualisieren'}</span>
    </button>
  );
}
