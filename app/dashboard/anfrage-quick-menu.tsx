'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type StatusOption = {
  value: string;
  label: string;
  icon: string;
};

const STATUS_OPTIONEN: StatusOption[] = [
  { value: 'entwurf_bereit', label: 'Freigabe', icon: '✏️' },
  { value: 'manuell_pruefen', label: 'Manuell prüfen', icon: '⚠️' },
  { value: 'info', label: 'Info', icon: '📌' },
  { value: 'versendet', label: 'Versendet', icon: '📤' },
  { value: 'reply_eingegangen', label: 'Im Gespräch', icon: '💬' },
  { value: 'erledigt', label: 'Erledigt', icon: '✅' },
  { value: 'aussortiert', label: 'Aussortiert', icon: '🗑️' },
];

export function AnfrageQuickMenu({
  anfrageId,
  currentStatus,
}: {
  anfrageId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function aendereStatus(newStatus: string) {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/anfragen/${anfrageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
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

  async function softDelete() {
    if (!confirm('In den Papierkorb verschieben? Kann später wiederhergestellt werden.')) {
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/anfragen/${anfrageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'soft_delete' }),
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
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => {
          // Verhindert dass der umgebende Link feuert
          e.preventDefault();
          e.stopPropagation();
        }}
        disabled={isLoading}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-md',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
          'transition-colors',
          isLoading && 'opacity-50 cursor-wait'
        )}
        aria-label="Optionen"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel>Status ändern</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {STATUS_OPTIONEN.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={(e) => {
              e.preventDefault();
              if (opt.value !== currentStatus) {
                aendereStatus(opt.value);
              }
            }}
            disabled={opt.value === currentStatus}
            className={cn(opt.value === currentStatus && 'opacity-50')}
          >
            <span className="mr-2">{opt.icon}</span>
            {opt.label}
            {opt.value === currentStatus && (
              <span className="ml-auto text-xs text-muted-foreground">aktuell</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            softDelete();
          }}
          className="text-destructive focus:text-destructive"
        >
          <span className="mr-2">🗑️</span>
          In Papierkorb
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}