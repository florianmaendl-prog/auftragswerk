'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle02Icon,
  Sparkles,
  Alert02Icon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

/**
 * "Auftrag annehmen"-Banner (Sprint 5, Pilot-Feedback, Tag 19 Polish).
 *
 * Eigener Banner über der Konversation – nicht inline neben dem
 * KategorieBadge, weil dort zu klein und der CTA unterging. Sichtbar
 * nur wenn manuell_pruefen + gewerk_match=unklar/passt_nicht. Klick →
 * API rebuilds Entwurf mit ownerBestaetigtPassend=true (Override-Block
 * im KI-Prompt sorgt für echte Zusage statt Absage).
 *
 * Toast nach Erfolg ist bewusst KURZ – der längere Lern-Tipp landet
 * als Inline-Hinweis (separat) damit's nicht über Brand-Design knallt.
 */
export function PasstDochButton({ anfrageId }: { anfrageId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    const ok = await confirm({
      title: 'Auftrag annehmen?',
      description:
        'Die KI hat diese Anfrage als nicht-passend eingestuft. Wenn du den Auftrag trotzdem machst, schreibt die KI in wenigen Sekunden einen neuen Entwurf als Zusage.',
      confirmLabel: 'Auftrag annehmen',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/anfragen/${anfrageId}/passt-doch`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Neuer Entwurf fehlgeschlagen');
        setBusy(false);
        return;
      }
      toast.success('Entwurf neu geschrieben.');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Neuer Entwurf fehlgeschlagen');
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
            KI ist unsicher, ob diese Anfrage zu deinem Spektrum passt.
          </p>
          <p className="text-xs text-amber-800/85 mt-0.5">
            Wenn du den Auftrag machen willst, schreibt die KI in 5 Sek einen
            neuen Entwurf als Zusage.
          </p>
        </div>
      </div>
      <Button
        type="button"
        onClick={handleClick}
        disabled={busy}
        size="sm"
        className={cn('gap-1.5 flex-shrink-0 w-full sm:w-auto min-h-11')}
      >
        <HugeiconsIcon
          icon={busy ? Sparkles : CheckmarkCircle02Icon}
          size={14}
          strokeWidth={1.5}
          className={cn(busy && 'animate-pulse')}
        />
        {busy ? 'KI schreibt neu…' : 'Auftrag annehmen'}
      </Button>
    </div>
  );
}
