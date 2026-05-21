'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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

  const istVersendet = entwurf.status === 'versendet' || sentAt !== null;
  const hatAenderungen =
    betreff !== entwurf.betreff_vorschlag || body !== entwurf.body_text;
  const istBusy = saving || sending;

  async function handleSave() {
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

    if (updateError) {
      setError(updateError.message);
    } else {
      setSavedAt(new Date());
      router.refresh();
    }

    setSaving(false);
  }

  async function handleSend() {
    if (istBusy || istVersendet) return; // Doppelklick-Schutz

    if (hatAenderungen) {
      await handleSave();
    }

    const confirmed = confirm(
      `Mail wirklich senden an ${empfaenger}?\n\nBetreff: ${betreff}\n\nDie Mail kann danach nicht zurückgeholt werden.`
    );
    if (!confirmed) return;

    setSending(true);
    setError(null);

    try {
      const response = await fetch('/api/versand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entwurf_id: entwurf.id }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || `HTTP ${response.status}`);
      } else {
        setSentAt(new Date());
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
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nachricht</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            disabled={istBusy || istVersendet}
            className="font-sans text-sm leading-relaxed"
          />
        </div>

        {entwurf.interne_notiz && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <p className="font-medium text-muted-foreground mb-1">💡 Interne KI-Notiz</p>
            <p className="leading-relaxed">{entwurf.interne_notiz}</p>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            <strong>Fehler:</strong> {error}
          </div>
        )}

        {sentAt && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            ✓ Mail erfolgreich versendet um {sentAt.toLocaleTimeString('de-DE')}
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
      </CardContent>
    </Card>
  );
}