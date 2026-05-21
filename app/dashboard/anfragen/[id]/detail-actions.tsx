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
import { Button } from '@/components/ui/button';
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

const STATUS_LABELS: Record<string, { label: string; icon: string }> = {
  neu: { label: 'Eingang', icon: '📥' },
  entwurf_bereit: { label: 'Freigabe', icon: '✏️' },
  manuell_pruefen: { label: 'Manuell prüfen', icon: '⚠️' },
  info: { label: 'Info', icon: '📌' },
  versendet: { label: 'Versendet', icon: '📤' },
  reply_eingegangen: { label: 'Im Gespräch', icon: '💬' },
  erledigt: { label: 'Erledigt', icon: '✅' },
  aussortiert: { label: 'Aussortiert', icon: '🗑️' },
];

// Quick-Erledigt-Button: nur bei Workflow-Schritten, die natürlich "fertig" werden können
const STATUS_MIT_ERLEDIGT_BUTTON = new Set([
  'versendet',
  'reply_eingegangen',
  'manuell_pruefen',
  'info',
]);

export function DetailActions({
  anfrageId,
  currentStatus,
}: {
  anfrageId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const currentLabel = STATUS_LABELS[currentStatus] ?? {
    label: currentStatus,
    icon: '•',
  };

  const zeigeErledigtButton = STATUS_MIT_ERLEDIGT_BUTTON.has(currentStatus);

  async function aendereStatus(newStatus: string) {
    if (isLoading) return;
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
    if (isLoading) return;
    if (
      !confirm(
        'Diese Anfrage in den Papierkorb verschieben? Sie kann später wiederhergestellt werden.'
      )
    ) {
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
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      alert(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Quick-Erledigt-Button: klare Aktion, kein State-Look */}
      {zeigeErledigtButton && (
        <Button
          variant="default"
          size="sm"
          onClick={() => aendereStatus('erledigt')}
          disabled={isLoading}
          className="gap-1.5 bg-green-600 text-white hover:bg-green-700"
          title="Diese Anfrage als erledigt markieren – wandert in den Erledigt-Tab"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Als erledigt markieren</span>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="gap-2"
          >
            <span>{currentLabel.icon}</span>
            <span>{currentLabel.label}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-50"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
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
                <span className="ml-auto text-xs text-muted-foreground">
                  aktuell
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        onClick={softDelete}
        disabled={isLoading}
        className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-1.5"
        >
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
        </svg>
        Löschen
      </Button>
    </div>
  );
}