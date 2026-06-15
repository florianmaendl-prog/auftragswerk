'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  MailIcon,
  CheckmarkCircle02Icon,
  Alert02Icon,
  CancelCircleIcon,
} from '@hugeicons/core-free-icons';

type MicrosoftConnection = {
  microsoft_email: string;
  status: 'aktiv' | 'fehler' | 'widerrufen';
  letzter_fehler: string | null;
};

/**
 * Card im Profil für die Microsoft-365/Outlook-OAuth-Verbindung. Symmetrisch
 * zur Gmail-Card, drei sichtbare Zustände (nicht verbunden / verbunden /
 * fehler). Liest URL-Param `?outlook=connected|error` nach dem Callback.
 *
 * Versand-Logik: bei beiden Providern aktiv hat Microsoft Vorrang
 * (siehe app/api/versand/route.ts Provider-Hierarchie). UI verhindert
 * das nicht aktiv, aber im Alltag verbindet jeder Owner nur einen.
 */
export function MicrosoftConnectionCard({
  initial,
}: {
  initial: MicrosoftConnection | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const outlook = searchParams.get('outlook');
    if (!outlook) return;
    const detail = searchParams.get('detail');
    if (outlook === 'connected') {
      toast.success(`Outlook verbunden: ${detail || 'Konto aktiv'}`);
    } else if (outlook === 'error') {
      toast.error(
        `Outlook-Verbindung fehlgeschlagen${detail ? ` (${detail})` : ''}`
      );
    }
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('outlook');
    cleanUrl.searchParams.delete('detail');
    window.history.replaceState({}, '', cleanUrl.toString());
  }, [searchParams]);

  async function handleDisconnect() {
    if (busy) return;
    const ok = await confirm({
      title: 'Outlook-Verbindung trennen?',
      description:
        'Der Versand fällt danach auf den Postmark-Standard zurück. Du kannst jederzeit neu verbinden. Für vollständigen Widerruf in deinem Microsoft-Konto unter myaccount.microsoft.com die Auftragswerk-App entfernen.',
      confirmLabel: 'Verbindung trennen',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch('/api/auth/microsoft/disconnect', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Trennen fehlgeschlagen');
      } else {
        toast.success('Outlook-Verbindung getrennt');
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Trennen fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  const istVerbunden = initial && initial.status === 'aktiv';
  const istFehler =
    initial && (initial.status === 'fehler' || initial.status === 'widerrufen');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HugeiconsIcon icon={MailIcon} size={18} strokeWidth={1.5} />
          Outlook / Microsoft 365
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {istVerbunden && (
          <div className="space-y-3">
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
              <p className="font-medium text-green-900 flex items-center gap-2">
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  size={16}
                  strokeWidth={2}
                />
                Verbunden als{' '}
                <span className="font-mono text-xs">
                  {initial!.microsoft_email}
                </span>
              </p>
              <p className="text-xs text-green-800 mt-1">
                Antworten werden aus deinem Outlook-Account versendet –
                Auftragswerk ist für deine Kunden komplett unsichtbar.
              </p>
            </div>

            <div className="rounded-md border border-input bg-muted/30 p-3 text-xs text-foreground/80 space-y-1">
              <p className="font-medium text-foreground">
                Outbound läuft – Antworten gehen aus deinem Outlook raus
              </p>
              <p className="text-muted-foreground">
                Für den Empfang von Kundenmails siehe die Karte „Mail-Empfang
                einrichten" unten.
              </p>
            </div>

            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={busy}
                className="gap-1.5"
              >
                <HugeiconsIcon
                  icon={CancelCircleIcon}
                  size={14}
                  strokeWidth={1.5}
                />
                Verbindung trennen
              </Button>
            </div>
          </div>
        )}

        {istFehler && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm">
            <p className="font-medium text-rose-900 flex items-center gap-2">
              <HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={2} />
              Verbindung unterbrochen
              {initial!.microsoft_email && (
                <span className="font-mono text-xs">
                  ({initial!.microsoft_email})
                </span>
              )}
            </p>
            <p className="text-xs text-rose-800 mt-1">
              {initial!.status === 'widerrufen'
                ? 'Der Zugriff wurde in deinem Microsoft-Konto widerrufen.'
                : 'Der letzte Versand ist fehlgeschlagen.'}{' '}
              Bitte neu verbinden – bis dahin fällt der Versand auf
              info@auftragswerk.app zurück.
            </p>
            {initial!.letzter_fehler && (
              <p className="text-xs text-rose-700 mt-1 font-mono">
                {initial!.letzter_fehler}
              </p>
            )}
            <div className="mt-3">
              <Button asChild size="sm">
                <a href="/api/auth/microsoft/start">Neu verbinden</a>
              </Button>
            </div>
          </div>
        )}

        {!initial && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Verbinde dein Outlook oder Microsoft 365. Deine Antworten gehen
              dann aus deiner gewohnten Mail-Adresse raus – wie immer. Ein
              Klick, fertig.
            </p>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <strong className="font-medium">Beim ersten Klick:</strong>{' '}
              Microsoft zeigt eine Berechtigungs-Anfrage. Falls dein Unternehmen
              einen IT-Admin hat, kann es sein, dass der freigeben muss.
            </div>
            <Button asChild className="w-full sm:w-auto">
              <a href="/api/auth/microsoft/start">Mit Outlook verbinden</a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
