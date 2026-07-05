'use client';

import { useEffect, useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

/**
 * CollapsibleCard – Wrapper um `<Card>`, dessen Inhalt einklappbar ist.
 * Der Zustand wird pro `cardId` in localStorage gespeichert
 * (`auftragswerk:collapse:<cardId>`), damit sich der Owner sein Layout
 * einmal einstellt und die Cards diese Wahl auf allen Anfrage-Detail-
 * Seiten übernehmen.
 *
 * Default ist offen. Bewusst: nichts überraschend versteckt. Iron Rule
 * „premium-Look, keine Emojis" – Chevron kommt aus HugeiconsIcon.
 *
 * Aus Max-Audio 3.7.: „stellt sich's selbst zusammen, aber nichts löschen".
 */

const LS_PREFIX = 'auftragswerk:collapse:';

export function CollapsibleCard({
  title,
  cardId,
  defaultOpen = true,
  headerRight,
  contentClassName,
  children,
}: {
  title: string;
  /** Persistenz-Key; auf verschiedenen Anfragen wird derselbe cardId
   *  denselben offen/zu-Zustand haben (Owner-Wunsch). */
  cardId: string;
  defaultOpen?: boolean;
  /** Optionaler Slot rechts im Header (z.B. für Sekundär-Actions) */
  headerRight?: React.ReactNode;
  /** Zusätzliche Klassen für den inneren CardContent (space-y-4 etc.) */
  contentClassName?: string;
  children: React.ReactNode;
}) {
  // Initial: default. Nach Mount aus localStorage lesen (kein SSR-Mismatch).
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LS_PREFIX + cardId);
      if (stored === '0') setOpen(false);
      else if (stored === '1') setOpen(true);
    } catch {
      // localStorage in privatem Modus / iframe eingesperrt → egal
    }
    setHydrated(true);
  }, [cardId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(LS_PREFIX + cardId, open ? '1' : '0');
    } catch {
      // s.o.
    }
  }, [open, cardId, hydrated]);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <Collapsible.Trigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 text-left flex-1 min-w-0 group"
                aria-label={open ? `${title} einklappen` : `${title} ausklappen`}
              >
                <HugeiconsIcon
                  icon={open ? ArrowDown01Icon : ArrowRight01Icon}
                  size={16}
                  strokeWidth={1.5}
                  className="text-muted-foreground flex-shrink-0 transition-transform group-hover:text-foreground"
                />
                <CardTitle className="text-base truncate">{title}</CardTitle>
              </button>
            </Collapsible.Trigger>
            {headerRight}
          </div>
        </CardHeader>
        <Collapsible.Content>
          <CardContent className={contentClassName}>{children}</CardContent>
        </Collapsible.Content>
      </Card>
    </Collapsible.Root>
  );
}
