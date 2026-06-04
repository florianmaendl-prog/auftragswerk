'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { CancelCircleIcon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

/**
 * "× Kunde löschen"-Button in der Kunden-Liste. Hinter den Kulissen:
 * sperrt den Absender (gesperrte_sender) + setzt alle bestehenden
 * Anfragen dieses Absenders auf 'aussortiert'. Künftige Mails von dieser
 * Adresse landen direkt im aussortiert-Tab ohne KI-Klassifikation
 * (siehe app/api/inbound/route.ts Pre-Check).
 *
 * Wichtig: das Stop-Event verhindert dass der Click die Karten-Link
 * mitgreift (Kunden-Detail-Page).
 */
export function KundeSperrenButton({ email }: { email: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy || isPending) return;

    if (
      !confirm(
        `Absender "${email}" sperren? Alle bestehenden Anfragen werden aussortiert, künftige Mails von dieser Adresse landen direkt im Aussortiert-Tab.`
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/sender/sperren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, grund: 'Aus Kunden-Liste entfernt' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Sperren fehlgeschlagen');
        setBusy(false);
        return;
      }
      toast.success(
        `Gesperrt. ${data.aussortierte_anfragen} alte Anfrage${
          data.aussortierte_anfragen === 1 ? '' : 'n'
        } aussortiert.`
      );
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sperren fehlgeschlagen');
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || isPending}
      title="Diesen Absender sperren – alle Anfragen aussortieren"
      aria-label="Absender sperren"
      className={cn(
        'flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md',
        'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
        'transition-colors disabled:opacity-50 disabled:cursor-wait'
      )}
    >
      <HugeiconsIcon
        icon={CancelCircleIcon}
        size={16}
        strokeWidth={1.5}
      />
    </button>
  );
}
