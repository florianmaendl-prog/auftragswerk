'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fileToBase64Payload, formatBytes } from '@/lib/files';

export function ReplyEditor({
  anfrageId,
  empfaenger,
  empfaengerName,
  urspruenglicherBetreff,
  istFolgeNachricht = false,
}: {
  anfrageId: string;
  empfaenger: string;
  empfaengerName: string | null;
  urspruenglicherBetreff: string;
  istFolgeNachricht?: boolean;
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
  const [files, setFiles] = useState<File[]>([]);

  const kannSenden = body.trim().length > 0 && betreff.trim().length > 0 && !sending;

  // Wording je nach Kontext: bei bestehender Konversation "Weitere Nachricht",
  // sonst Erstantwort
  const cardTitel = istFolgeNachricht
    ? '💬 Weitere Nachricht senden'
    : '📨 Antwort schreiben';
  const placeholderText = istFolgeNachricht
    ? 'Schreib hier deine nächste Nachricht im laufenden Gespräch ...'
    : 'Schreib deine Antwort hier ...';

  async function handleSend() {
    if (sending) return; // Doppelklick-Schutz
    if (!kannSenden) return;

    setSending(true);
    setError(null);

    try {
      const anhaenge = files.length > 0
        ? await Promise.all(files.map(fileToBase64Payload))
        : undefined;

      const response = await fetch('/api/versand/manuell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anfrage_id: anfrageId,
          betreff,
          body_text: body,
          anhaenge,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || `HTTP ${response.status}`);
      } else {
        setSentAt(new Date());
        setBody('');
        setFiles([]);
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
        <CardTitle className="text-base">{cardTitel}</CardTitle>
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
            placeholder={placeholderText}
            className="font-sans text-sm leading-relaxed"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Anhänge</label>
          <input
            type="file"
            multiple
            onChange={(e) => {
              const selected = Array.from(e.target.files || []);
              if (selected.length > 0) setFiles((prev) => [...prev, ...selected]);
              e.target.value = '';
            }}
            disabled={sending}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
          />
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((file, idx) => (
                <li
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between text-xs rounded-md border border-input bg-muted/30 px-2 py-1.5"
                >
                  <span className="truncate">
                    📎 {file.name}{' '}
                    <span className="text-muted-foreground">
                      ({formatBytes(file.size)})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={sending}
                    className="ml-2 text-muted-foreground hover:text-destructive disabled:opacity-50"
                    aria-label="Anhang entfernen"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            <strong>Fehler:</strong> {error}
          </div>
        )}

        {sentAt && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            ✓ {istFolgeNachricht ? 'Nachricht' : 'Antwort'} versendet um{' '}
            {sentAt.toLocaleTimeString('de-DE')}
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