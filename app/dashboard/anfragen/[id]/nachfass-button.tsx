'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import { Mailbox01Icon, Sparkles, Alert02Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

/**
 * Nachfass-Banner für stale versendete Anfragen (Sprint 7, Tag 20).
 *
 * Sichtbar nur wenn Anfrage status='versendet' UND letzte Mail >7 Tage
 * her (Stale-Schwelle, siehe app/dashboard/page.tsx). Klick → API
 * generiert kurzen Nachfass-Entwurf (lib/entwurf.ts nachfassModus).
 * Owner kann den Entwurf wie immer editieren oder direkt senden.
 *
 * UI-Stil: amber Banner analog "Auftrag annehmen" – aber andere Botschaft
 * ("seit X Tagen ohne Antwort"). Banner schließt den Loop den der
 * Stale-Indikator in der Inbox eröffnet.
 */
export function NachfassButton({
  anfrageId,
  wartetTage,
}: {
  anfrageId: string;
  wartetTage: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    const ok = await confirm({
      title: 'Nachfass-Entwurf schreiben?',
      description:
        'Die KI baut einen kurzen, höflichen Nachfass im selben Mail-Faden. Du kannst ihn wie immer prüfen, ändern oder direkt senden.',
      confirmLabel: 'Nachfass schreiben',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/anfragen/${anfrageId}/nachfass`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Nachfass-Entwurf fehlgeschlagen');
        setBusy(false);
        return;
      }
      toast.success('Nachfass-Entwurf bereit.');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Nachfass-Entwurf fehlgeschlagen');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
      <div className="flex items-start gap-2 min-w-0">
        <HugeiconsIcon
          icon={Alert02Icon}
          size={18}
          strokeWidth={1.5}
          className="text-amber-700 flex-shrink-0 mt-0.5"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-900">
            Wartet seit {wartetTage} Tagen ohne Antwort.
          </p>
          <p className="text-xs text-amber-800/85 mt-0.5">
            Vielleicht ist die Mail im Spam gelandet oder untergegangen. KI
            kann einen kurzen, höflichen Nachfass schreiben.
          </p>
        </div>
      </div>
      <Button
        type="button"
        onClick={handleClick}
        disabled={busy}
        size="sm"
        className={cn('gap-1.5 flex-shrink-0 w-full sm:w-auto')}
      >
        <HugeiconsIcon
          icon={busy ? Sparkles : Mailbox01Icon}
          size={14}
          strokeWidth={1.5}
          className={cn(busy && 'animate-pulse')}
        />
        {busy ? 'KI schreibt…' : 'Nachfass schreiben'}
      </Button>
    </div>
  );
}
