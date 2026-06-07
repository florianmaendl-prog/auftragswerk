'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Brand-Confirm-Dialog statt window.confirm() (Sprint 6, Tag 19 Polish).
 *
 * Browser-natives confirm() sieht in jedem Browser anders aus (Chrome,
 * Safari, Firefox, iOS-System) und passt nicht zu unserem Brand. Dieser
 * Provider stellt eine Promise-basierte API bereit:
 *
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Auftrag annehmen?',
 *     description: 'Die KI schreibt einen neuen Entwurf als Zusage.',
 *     confirmLabel: 'Auftrag annehmen',
 *     destructive: false,
 *   });
 *   if (!ok) return;
 *
 * Provider wird in app/layout.tsx einmal um den ganzen Tree gewrappt.
 * Im SSR/Server-Component nicht direkt nutzbar – die Aufrufe stehen
 * eh nur in Client-Components (Buttons / Aktionen).
 */

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Wenn true: roter Confirm-Button (für Lösch- / Block-Aktionen). */
  destructive?: boolean;
};

type InternalState = {
  options: ConfirmOptions;
  resolver: (ok: boolean) => void;
};

const ConfirmCtx = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(
  null
);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InternalState | null>(null);
  // Resolver-Ref damit wir bei schnellem Dispose nicht in stale closures landen
  const stateRef = useRef<InternalState | null>(null);
  stateRef.current = state;

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolver: resolve });
    });
  }, []);

  function handleResolve(ok: boolean) {
    const current = stateRef.current;
    setState(null);
    current?.resolver(ok);
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog
        open={state !== null}
        onOpenChange={(open) => {
          if (!open) handleResolve(false);
        }}
      >
        {state && (
          <DialogContent className="max-w-md" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>{state.options.title}</DialogTitle>
              {state.options.description && (
                <DialogDescription className="pt-1 leading-relaxed">
                  {state.options.description}
                </DialogDescription>
              )}
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2 mt-2">
              <Button
                variant="outline"
                onClick={() => handleResolve(false)}
              >
                {state.options.cancelLabel ?? 'Abbrechen'}
              </Button>
              <Button
                variant={state.options.destructive ? 'destructive' : 'default'}
                onClick={() => handleResolve(true)}
                className={cn(
                  'gap-1.5',
                  state.options.destructive && 'bg-destructive hover:bg-destructive/90'
                )}
              >
                {state.options.confirmLabel ?? 'Bestätigen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) {
    throw new Error('useConfirm() muss innerhalb von <ConfirmProvider> stehen');
  }
  return ctx;
}
