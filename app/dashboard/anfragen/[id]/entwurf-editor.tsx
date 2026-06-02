'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fileToBase64Payload, formatBytes, validateAttachments } from '@/lib/files';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  FileAttachmentIcon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Idea01Icon,
} from '@hugeicons/core-free-icons';

type Entwurf = {
  id: string;
  betreff_vorschlag: string;
  body_text: string;
  interne_notiz: string | null;
  status: string;
  modell: string | null;
};

export default function EntwurfEditor({
  entwurf,
  anfrageId,
  empfaenger,
}: {
  entwurf: Entwurf;
  anfrageId: string;
  empfaenger: string;
}) {
  const router = useRouter();
  const [betreff, setBetreff] = useState(entwurf.betreff_vorschlag);
  const [body, setBody] = useState(entwurf.body_text);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const istVersendet = entwurf.status === 'versendet' || sentAt !== null;
  const hatAenderungen =
    betreff !== entwurf.betreff_vorschlag || body !== entwurf.body_text;
  const istBusy = saving || sending;

  async function handleSave(): Promise<boolean> {
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('entwuerfe')
      .update({
        betreff_vorschlag: betreff,
        body_text: body,
        vom_user_bearbeitet: hatAenderungen ? 'true' : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entwurf.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return false;
    }

    setSavedAt(new Date());
    router.refresh();
    return true;
  }

  async function handleSend() {
    if (istBusy || istVersendet) return; // Doppelklick-Schutz

    // Wenn der User Änderungen am Entwurf hat, muss der Save klappen –
    // sonst würde die ALTE Version rausgehen und die Bearbeitung wäre weg.
    if (hatAenderungen) {
      const saved = await handleSave();
      if (!saved) return;
    }

    setSending(true);
    setError(null);

    try {
      const anhaenge = files.length > 0
        ? await Promise.all(files.map(fileToBase64Payload))
        : undefined;

      const response = await fetch('/api/versand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entwurf_id: entwurf.id, anhaenge }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || `HTTP ${response.status}`);
      } else {
        setSentAt(new Date());
        setFiles([]);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Versand fehlgeschlagen');
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Antwort-Entwurf</CardTitle>
          <div className="flex items-center gap-2">
            {istVersendet && <Badge>versendet</Badge>}
            <Badge variant="outline" className="text-xs">
              {entwurf.modell || 'KI'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">An</label>
          <Input value={empfaenger} disabled className="bg-muted/30" />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Betreff</label>
          <Input
            value={betreff}
            onChange={(e) => setBetreff(e.target.value)}
            disabled={istBusy || istVersendet}
            maxLength={500}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nachricht</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            disabled={istBusy || istVersendet}
            maxLength={50000}
            className="font-sans text-sm leading-relaxed"
          />
        </div>

        {!istVersendet && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Anhänge</label>
            <input
              type="file"
              multiple
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                e.target.value = '';
                if (selected.length === 0) return;
                const check = validateAttachments(selected, files);
                if (!check.ok) {
                  setError(check.fehler);
                  return;
                }
                setError(null);
                setFiles((prev) => [...prev, ...check.files]);
              }}
              disabled={istBusy}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
            />
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((file, idx) => (
                  <li
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between text-xs rounded-md border border-input bg-muted/30 px-2 py-1.5"
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <HugeiconsIcon
                        icon={FileAttachmentIcon}
                        size={12}
                        strokeWidth={1.5}
                      />
                      {file.name}{' '}
                      <span className="text-muted-foreground">
                        ({formatBytes(file.size)})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                      disabled={istBusy}
                      className="ml-2 text-muted-foreground hover:text-destructive disabled:opacity-50"
                      aria-label="Anhang entfernen"
                    >
                      <HugeiconsIcon
                        icon={CancelCircleIcon}
                        size={14}
                        strokeWidth={1.5}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {entwurf.interne_notiz && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <p className="font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
              <HugeiconsIcon
                icon={Idea01Icon}
                size={12}
                strokeWidth={1.5}
              />
              Interne KI-Notiz
            </p>
            <p className="leading-relaxed">{entwurf.interne_notiz}</p>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            <strong>Fehler:</strong> {error}
          </div>
        )}

        {sentAt && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 flex items-center gap-2">
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              size={16}
              strokeWidth={2}
            />
            Mail erfolgreich versendet um {sentAt.toLocaleTimeString('de-DE')}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            {istVersendet && 'Versendet – keine Bearbeitung mehr möglich'}
            {!istVersendet &&
              savedAt &&
              `Zuletzt gespeichert: ${savedAt.toLocaleTimeString('de-DE')}`}
            {!istVersendet &&
              !savedAt &&
              hatAenderungen &&
              '● Nicht gespeicherte Änderungen'}
          </div>
          {!istVersendet && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={istBusy || !hatAenderungen}
              >
                {saving ? 'Wird gespeichert...' : 'Speichern'}
              </Button>
              <Button onClick={handleSend} disabled={istBusy}>
                {sending ? 'Wird gesendet...' : 'Senden'}
              </Button>
            </div>
          )}
        </div>

        {!istVersendet && (
          <p className="text-[11px] text-muted-foreground text-right -mt-1">
            Was du änderst, hilft beim nächsten Mal.
          </p>
        )}
      </CardContent>
    </Card>
  );
}