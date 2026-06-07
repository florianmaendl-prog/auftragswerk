'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowTurnBackwardIcon } from '@hugeicons/core-free-icons';

export function PapierkorbItemActions({ anfrageId }: { anfrageId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isLoading, setIsLoading] = useState(false);

  async function restore() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/anfragen/${anfrageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Wiederherstellen fehlgeschlagen');
        return;
      }
      toast.success('Anfrage wiederhergestellt');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Wiederherstellen fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  }

  async function hardDelete() {
    const ok = await confirm({
      title: 'Endgültig löschen?',
      description:
        'Die Anfrage wird komplett aus der Datenbank entfernt – inklusive aller Nachrichten, Entwürfe und Analysen. Das kann NICHT rückgängig gemacht werden.',
      confirmLabel: 'Endgültig löschen',
      destructive: true,
    });
    if (!ok) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/anfragen/${anfrageId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Endgültig löschen fehlgeschlagen');
        return;
      }
      toast.success('Anfrage endgültig gelöscht');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Endgültig löschen fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={restore}
        disabled={isLoading}
        className="gap-1.5"
      >
        <HugeiconsIcon
          icon={ArrowTurnBackwardIcon}
          size={14}
          strokeWidth={1.5}
        />
        Wiederherstellen
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={hardDelete}
        disabled={isLoading}
        className={cn(
          'text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20'
        )}
      >
        Endgültig löschen
      </Button>
    </div>
  );
}
