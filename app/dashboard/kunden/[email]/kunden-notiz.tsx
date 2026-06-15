'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { HugeiconsIcon } from '@hugeicons/react';
import { Note01Icon } from '@hugeicons/core-free-icons';

/**
 * Kunden-Notiz mit Auto-Save bei Blur (analog NotizEditor für Anfragen).
 * Owner schreibt "zahlt schlecht, 50% Anzahlung verlangen" o.ä. – bleibt
 * intern, geht nie in eine Mail.
 */
export function KundenNotiz({
  kundeId,
  initialNotiz,
}: {
  kundeId: string;
  initialNotiz: string | null;
}) {
  const [text, setText] = useState(initialNotiz ?? '');
  const [saved, setSaved] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const initialRef = useRef(initialNotiz ?? '');

  useEffect(() => {
    setText(initialNotiz ?? '');
    initialRef.current = initialNotiz ?? '';
  }, [initialNotiz]);

  async function speichere() {
    if (busy) return;
    if (text === initialRef.current) return; // nichts geändert
    setBusy(true);
    try {
      const res = await fetch(`/api/kunden/${kundeId}/notiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notizen: text }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Speichern fehlgeschlagen');
        return;
      }
      initialRef.current = text;
      setSaved(new Date());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <HugeiconsIcon icon={Note01Icon} size={14} strokeWidth={1.5} />
          Notizen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={speichere}
          rows={5}
          maxLength={10000}
          placeholder={'z.B. „zahlt schlecht, lieber Anzahlung verlangen" oder „Stammkunde, faire Preise"'}
          disabled={busy}
          className="text-sm font-sans"
        />
        <p className="text-[11px] text-muted-foreground text-right">
          {saved
            ? `Gespeichert ${saved.toLocaleTimeString('de-DE')}`
            : 'Wird beim Verlassen des Felds automatisch gespeichert.'}
        </p>
      </CardContent>
    </Card>
  );
}
