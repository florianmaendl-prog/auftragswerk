'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { HugeiconsIcon } from '@hugeicons/react';
import { Note01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

/**
 * Owner-Notiz pro Anfrage (Sprint 6, Polish-Welle Tag 19).
 *
 * Freier Text – nicht in Mails sichtbar. Auto-Save beim Blur (also wenn
 * der Owner aus dem Feld klickt) – Debounce-Save bei Tastendruck wäre
 * zu viel Netzwerk. Status-Indikator zeigt "gespeichert" für 2 Sek
 * nach erfolgreichem Save.
 */
export function NotizEditor({
  anfrageId,
  initialNotiz,
}: {
  anfrageId: string;
  initialNotiz: string | null;
}) {
  const [wert, setWert] = useState(initialNotiz ?? '');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const lastSavedRef = useRef(initialNotiz ?? '');

  // Save beim Blur – nur wenn sich etwas geändert hat
  async function saveOnBlur() {
    if (wert === lastSavedRef.current) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/anfragen/${anfrageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notiz: wert }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Notiz speichern fehlgeschlagen');
        return;
      }
      lastSavedRef.current = wert;
      setSavedFlash(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Notiz speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  // Saved-Flash nach 2s ausblenden
  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 2000);
    return () => clearTimeout(t);
  }, [savedFlash]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <HugeiconsIcon
              icon={Note01Icon}
              size={14}
              strokeWidth={1.5}
              className="text-muted-foreground"
            />
            Interne Notiz
          </CardTitle>
          {(saving || savedFlash) && (
            <span
              className={cn(
                'text-[11px] flex items-center gap-1 transition-opacity',
                saving ? 'text-muted-foreground' : 'text-green-700'
              )}
            >
              {saving ? (
                'speichern…'
              ) : (
                <>
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    size={12}
                    strokeWidth={1.5}
                  />
                  gespeichert
                </>
              )}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <Textarea
          value={wert}
          onChange={(e) => setWert(e.target.value)}
          onBlur={saveOnBlur}
          placeholder={
            'Eigene Notiz zu diesem Kunden / dieser Anfrage – z.B. ' +
            '„telefoniert, zahlt schlecht, lieber 50% Anzahlung". ' +
            'Nicht in Mails sichtbar.'
          }
          rows={3}
          maxLength={5000}
          className="font-sans text-sm leading-relaxed resize-y"
        />
        <p className="text-[11px] text-muted-foreground">
          Wird beim Verlassen des Felds automatisch gespeichert. Nur für
          dich – Kunde sieht sie nie.
        </p>
      </CardContent>
    </Card>
  );
}
