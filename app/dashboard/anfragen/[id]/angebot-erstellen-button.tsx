'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { File02Icon, Sparkles } from '@hugeicons/core-free-icons';

/**
 * Button auf der Anfrage-Detail-Page: erstellt ein neues Angebot
 * (mit KI-Vorschlag auf Basis der Anfrage + den im Profil gepflegten
 * Bausteinen/Materialien) und springt direkt in den Editor.
 */
export function AngebotErstellenButton({ anfrageId }: { anfrageId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/angebote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anfrage_id: anfrageId,
          ki_generieren: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Angebot konnte nicht erstellt werden');
        return;
      }
      toast.success('Angebot-Vorschlag bereit');
      router.push(`/dashboard/angebote/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={busy}
      size="sm"
      variant="outline"
      className="gap-1.5 w-full sm:w-auto min-h-11"
    >
      <HugeiconsIcon
        icon={busy ? Sparkles : File02Icon}
        size={14}
        strokeWidth={1.5}
        className={busy ? 'animate-pulse' : ''}
      />
      {busy ? 'KI baut Angebot…' : 'Angebot erstellen'}
    </Button>
  );
}
