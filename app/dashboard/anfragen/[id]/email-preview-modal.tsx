'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { ViewIcon } from '@hugeicons/core-free-icons';

/**
 * Email-Preview-Modal: Owner klickt "Vorschau wie's beim Kunden ankommt",
 * wir rendern das finale HTML (mit Signatur + Logo) in einem iframe.
 * iframe schützt vor CSS-Bleeding ins Dashboard und zeigt das Layout
 * so wie ein Mail-Client es darstellen würde.
 *
 * Server-Render-Endpoint: /api/profil/signatur-preview
 */
export function EmailPreviewButton({ bodyText }: { bodyText: string }) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lade, setLade] = useState(false);

  useEffect(() => {
    if (!open) {
      setHtml(null);
      setError(null);
      return;
    }
    setLade(true);
    fetch('/api/profil/signatur-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bodyText }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Preview fehlgeschlagen');
        setHtml(data.html);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Preview fehlgeschlagen');
      })
      .finally(() => setLade(false));
  }, [open, bodyText]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon icon={ViewIcon} size={14} strokeWidth={1.5} />
        Vorschau wie's beim Kunden ankommt
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>So sieht der Empfänger deine Mail</DialogTitle>
            <DialogDescription>
              Rendering wie in modernen Mail-Clients. Outlook-Desktop kann
              Layout/Schriften leicht anders darstellen.
            </DialogDescription>
          </DialogHeader>
          <div className="border-t bg-muted/30 px-5 py-3 max-h-[70vh] overflow-auto">
            {lade && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Vorschau wird gebaut…
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive py-6 text-center">
                {error}
              </p>
            )}
            {html && (
              <iframe
                title="Email Preview"
                srcDoc={html}
                sandbox=""
                className="w-full min-h-[400px] rounded-md border border-input bg-white"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
