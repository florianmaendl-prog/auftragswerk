import Link from 'next/link';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { CheckmarkCircle02Icon, ArrowRight02Icon } from '@hugeicons/core-free-icons';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Eine Schritt-Card auf der Wow-Onboarding-Page (/dashboard/willkommen).
 * Drei dieser Cards zeigt der erste Login: Gmail verbinden, Verfügbarkeit
 * eintragen, Profil ausfüllen. Premium-Look: Step-Nummer prominent,
 * Status-Icon (grüner Check wenn done), klare CTA.
 *
 * Zustände:
 *  - done=true → grüner Check oben rechts, dezenter Look, "✓ Erledigt"-Pill
 *  - done=false → CTA-Button prominent, Stahlblau-Nummer
 */
export function OnboardingStep({
  nummer,
  icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  done,
  doneLabel = 'Erledigt',
}: {
  nummer: number;
  icon: IconSvgElement;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  done: boolean;
  doneLabel?: string;
}) {
  return (
    <Card
      className={cn(
        'p-5 flex flex-col gap-4 transition-all',
        done
          ? 'bg-secondary/50 border-secondary'
          : 'border-primary/20 hover:border-primary/40 hover:shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'font-heading text-3xl font-bold leading-none tabular-nums',
              done ? 'text-foreground/40' : 'text-primary'
            )}
          >
            {String(nummer).padStart(2, '0')}
          </span>
          <div
            className={cn(
              'rounded-full p-2',
              done ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'
            )}
          >
            <HugeiconsIcon icon={icon} size={20} strokeWidth={1.5} />
          </div>
        </div>
        {done && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 px-2.5 py-0.5 text-xs font-medium">
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              size={12}
              strokeWidth={2}
            />
            {doneLabel}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <h3 className="font-semibold text-base mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      <div>
        {done ? (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={ctaHref}>
              Anpassen
              <HugeiconsIcon
                icon={ArrowRight02Icon}
                size={14}
                strokeWidth={1.5}
              />
            </Link>
          </Button>
        ) : (
          <Button asChild className="gap-1.5 w-full sm:w-auto">
            <Link href={ctaHref}>
              {ctaLabel}
              <HugeiconsIcon
                icon={ArrowRight02Icon}
                size={14}
                strokeWidth={1.5}
              />
            </Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
