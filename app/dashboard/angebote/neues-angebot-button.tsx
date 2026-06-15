'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { AddSquareIcon } from '@hugeicons/core-free-icons';

/**
 * Leeres Angebot anlegen – ohne vorgelagerte Mail-Anfrage.
 * Owner landet direkt im Editor und füllt Empfänger + Positionen frei.
 */
export function NeuesAngebotButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/angebote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Anlegen fehlgeschlagen');
        return;
      }
      router.push(`/dashboard/angebote/${data.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="gap-1.5"
    >
      <HugeiconsIcon icon={AddSquareIcon} size={14} strokeWidth={1.5} />
      {loading ? 'Anlegen…' : 'Neues Angebot'}
    </Button>
  );
}
