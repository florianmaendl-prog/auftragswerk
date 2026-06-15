'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/**
 * Modal-Variante: Owner gibt Betreff + Nachricht ein, das Angebot wird
 * als PDF angehängt und versendet. Default-Texte sind vorausgefüllt,
 * Owner kann sie anpassen.
 */
export function SendenModal({
  id,
  defaultBetreff,
  defaultBody,
  empfaengerEmail,
  disabled,
}: {
  id: string;
  defaultBetreff: string;
  defaultBody: string;
  empfaengerEmail: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [betreff, setBetreff] = useState(defaultBetreff);
  const [body, setBody] = useState(defaultBody);
  const [busy, setBusy] = useState(false);

  async function handleSend() {
    if (!betreff.trim() || !body.trim()) {
      toast.error('Betreff und Nachricht müssen ausgefüllt sein');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/angebote/${id}/senden`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betreff, bodyText: body }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Versand fehlgeschlagen');
        return;
      }
      toast.success('Angebot versendet');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Versand fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || !empfaengerEmail}
        title={!empfaengerEmail ? 'Keine Empfänger-Email am Angebot' : undefined}
      >
        An Kunde senden
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Angebot an Kunde senden</DialogTitle>
            <DialogDescription>
              Das PDF wird automatisch als Anhang mitgeschickt. Mail geht aus
              deinem verbundenen Konto raus.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                An
              </label>
              <Input
                value={empfaengerEmail ?? '(keine)'}
                disabled
                className="bg-muted/30 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Betreff
              </label>
              <Input
                value={betreff}
                onChange={(e) => setBetreff(e.target.value)}
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Nachricht
              </label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                maxLength={5000}
                className="font-sans text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Deine Signatur wird automatisch angehängt – musst du hier nicht
                wiederholen.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSend} disabled={busy}>
              {busy ? 'Wird versendet…' : 'Jetzt senden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
