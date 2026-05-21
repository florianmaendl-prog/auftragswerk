'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function ReplyEditor({
  anfrageId,
  empfaenger,
  empfaengerName,
  urspruenglicherBetreff,
}: {
  anfrageId: string;
  empfaenger: string;
  empfaengerName: string | null;
  urspruenglicherBetreff: string;
}) {
  const router = useRouter();

  // Betreff sinnvoll initialisieren: AW: davor wenn noch nicht da
  const initBetreff = urspruenglicherBetreff.toLowerCase().startsWith('aw:')
    ? urspruenglicherBetreff
    : `AW: ${urspruenglicherBetreff}`;

  const [betreff, setBetreff] = useState(initBetreff);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kannSenden = body.trim().length > 0 && betreff.trim().length > 0 && !sending;

  async function handleSend() {
    if (sending) return; // Doppelklick-Schutz
    if (!kannSenden) return;

    const confirmed = confirm(
      `Antwort senden an ${empfaenger}?\n\nBetreff: ${betreff}`
    );
    if (!confirmed) return;

    setSending(true);
    setError(null);

    try {
      const response = await fetch('/api/versand/manuell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anfrage_id: anfrageId,
          betreff,
          body_text: body,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || `HTTP ${response.status}`);
      } else {
        setSentAt(new Date());
        setBody('');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Versand fehlgeschlagen');
    }

    setSending(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">📨 Antwort schreiben</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">An</label>
          <Input
            value={empfaengerName ? `${empfaengerName} <${empfaenger}>` : empfaenger}
            disabled
            className="bg-muted/30"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Betreff</label>
          <Input
            value={betreff}
            onChange={(e) => setBetreff(e.target.value)}
            disabled={sending}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nachricht</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            disabled={sending}
            placeholder="Schreib deine Antwort hier ..."
            className="font-sans text-sm leading-relaxed"
          />
        </div>

        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            <strong>Fehler:</strong> {error}
          </div>
        )}

        {sentAt && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            ✓ Antwort versendet um {sentAt.toLocaleTimeString('de-DE')}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t">
          <Button onClick={handleSend} disabled={!kannSenden}>
            {sending ? 'Wird gesendet ...' : 'Senden'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}