import type { ReactNode } from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Einheitlicher Empty-State im Brand-Stil. Wird auf allen Listen-Seiten
 * verwendet (Inbox, Kunden, Termine, Kalender, Diagnose), damit "noch
 * nichts da" konsistent aussieht – Icon im Hellgrau-Kreis, klare
 * Headline, dezenter Subtext, optional ein Call-to-Action.
 *
 * `tone` steuert die Akzent-Farbe des Icon-Kreises:
 *   - default: Hellgrau + stahlblaues Icon (Standard für "leer = neutral")
 *   - success: Hellgrün + grünes Icon ("leer ist gut", z.B. Diagnose)
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'default',
  className,
}: {
  icon: IconSvgElement;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: 'default' | 'success';
  className?: string;
}) {
  const circleClass =
    tone === 'success' ? 'bg-green-100 text-green-700' : 'bg-secondary text-primary';

  return (
    <Card className={className}>
      <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
        <div className={cn('rounded-full p-4', circleClass)}>
          <HugeiconsIcon icon={icon} size={28} strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
        )}
        {action && <div className="mt-2">{action}</div>}
      </CardContent>
    </Card>
  );
}
