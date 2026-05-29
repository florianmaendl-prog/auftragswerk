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
  MoreVerticalCircle01Icon,
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
        toast.error(data.error || 'In Papierkorb verschieben fehlgeschlagen');
        return;
      }
      toast.success('In Papierkorb verschoben');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'In Papierkorb verschieben fehlgeschlagen');
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
        <HugeiconsIcon
          icon={MoreVerticalCircle01Icon}
          size={16}
          strokeWidth={1.5}
        />
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
            <HugeiconsIcon
              icon={opt.icon}
              size={16}
              strokeWidth={1.5}
              className="mr-2"
            />
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
          <HugeiconsIcon
            icon={Delete02Icon}
            size={16}
            strokeWidth={1.5}
            className="mr-2"
          />
          In Papierkorb
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}