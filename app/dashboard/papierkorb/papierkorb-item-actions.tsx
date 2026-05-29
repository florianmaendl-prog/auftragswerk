'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowTurnBackwardIcon } from '@hugeicons/core-free-icons';

export function PapierkorbItemActions({ anfrageId }: { anfrageId: string }) {
  const router = useRouter();
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
        alert(`Fehler: ${data.error || 'Unbekannt'}`);
        return;
      }
      router.refresh();
    } catch (err) {
      alert(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function hardDelete() {
    if (
      !confirm(
        'ENDGÜLTIG löschen?\n\nDie Anfrage wird komplett aus der Datenbank entfernt – inklusive aller Nachrichten, Entwürfe und Analysen. Das kann NICHT rückgängig gemacht werden.'
      )
    ) {
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/anfragen/${anfrageId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Fehler: ${data.error || 'Unbekannt'}`);
        return;
      }
      router.refresh();
    } catch (err) {
      alert(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
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
