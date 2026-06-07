'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle02Icon, Sparkles } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

/**
 * "Passt doch"-Button (Sprint 5, Max-Wunsch).
 *
 * Sichtbar wenn Anfrage manuell_pruefen ist und KI eher abgesagt hat
 * (gewerk_match=unklar oder passt_nicht). Klick → API rebuilds Entwurf
 * mit forciertem gewerk_match='passt' → Owner kriegt eine Zusage statt
 * Absage und kann direkt freigeben.
 *
 * Lernen V1: nach Erfolg Toast mit Hinweis im Profil zu ergänzen.
 * Auto-Lernen kommt später (Phase 3) wenn 30+ Korrekturen vorliegen.
 */
export function PasstDochButton({ anfrageId }: { anfrageId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    if (
      !confirm(
        'KI hat diese Anfrage als nicht-passend eingestuft. Soll ich einen neuen Entwurf als Zusage schreiben?'
      )
    ) {
      return;
    }

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
      toast.success('Entwurf wurde als Zusage neu geschrieben.', {
        description:
          'Tipp: ergänze diese Art Anfrage in deinem Profil unter „Was wir machen" – dann erkennt die KI sie künftig direkt.',
        duration: 8000,
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Neuer Entwurf fehlgeschlagen');
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={cn('gap-1.5')}
      size="sm"
    >
      <HugeiconsIcon
        icon={busy ? Sparkles : CheckmarkCircle02Icon}
        size={14}
        strokeWidth={1.5}
        className={cn(busy && 'animate-pulse')}
      />
      {busy ? 'KI schreibt neu…' : 'Passt doch – Entwurf als Zusage'}
    </Button>
  );
}
