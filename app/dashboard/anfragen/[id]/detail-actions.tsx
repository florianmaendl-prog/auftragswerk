'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Edit02Icon,
  AlertCircleIcon,
  PinIcon,
  SentIcon,
  ChatIcon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  InboxIcon,
  ArrowDown01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';

type StatusOption = {
  value: string;
  label: string;
  icon: IconSvgElement;
};

const STATUS_OPTIONEN: StatusOption[] = [
  { value: 'entwurf_bereit', label: 'Freigabe', icon: Edit02Icon },
  { value: 'manuell_pruefen', label: 'Manuell prüfen', icon: AlertCircleIcon },
  { value: 'info', label: 'Info', icon: PinIcon },
  { value: 'versendet', label: 'Versendet', icon: SentIcon },
  { value: 'reply_eingegangen', label: 'Im Gespräch', icon: ChatIcon },
  { value: 'erledigt', label: 'Erledigt', icon: CheckmarkCircle02Icon },
  { value: 'aussortiert', label: 'Aussortiert', icon: Delete02Icon },
];

const STATUS_LABELS: Record<string, { label: string; icon: IconSvgElement }> = {
  neu: { label: 'Eingang', icon: InboxIcon },
  entwurf_bereit: { label: 'Freigabe', icon: Edit02Icon },
  manuell_pruefen: { label: 'Manuell prüfen', icon: AlertCircleIcon },
  info: { label: 'Info', icon: PinIcon },
  versendet: { label: 'Versendet', icon: SentIcon },
  reply_eingegangen: { label: 'Im Gespräch', icon: ChatIcon },
  erledigt: { label: 'Erledigt', icon: CheckmarkCircle02Icon },
  aussortiert: { label: 'Aussortiert', icon: Delete02Icon },
};

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
    icon: PinIcon,
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
        toast.error(data.error || 'Status ändern fehlgeschlagen');
        return;
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status ändern fehlgeschlagen');
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
        toast.error(data.error || 'In Papierkorb verschieben fehlgeschlagen');
        return;
      }
      toast.success('In Papierkorb verschoben');
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'In Papierkorb verschieben fehlgeschlagen');
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
          className="gap-1.5"
          title="Diese Anfrage als erledigt markieren – wandert in den Erledigt-Tab"
        >
          <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2} />
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
            <HugeiconsIcon icon={currentLabel.icon} size={14} strokeWidth={1.5} />
            <span>{currentLabel.label}</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={12}
              strokeWidth={1.5}
              className="opacity-50"
            />
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
              <HugeiconsIcon
                icon={opt.icon}
                size={16}
                strokeWidth={1.5}
                className="mr-2"
              />
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
        <HugeiconsIcon
          icon={Delete02Icon}
          size={14}
          strokeWidth={1.5}
          className="mr-1.5"
        />
        Löschen
      </Button>
    </div>
  );
}
