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

type GmailConnection = {
  google_email: string;
  status: 'aktiv' | 'fehler' | 'widerrufen';
  letzter_fehler: string | null;
  calendar_sync_aktiv?: boolean;
  calendar_letzter_sync?: string | null;
};

type MicrosoftConnection = {
  microsoft_email: string;
  status: 'aktiv' | 'fehler' | 'widerrufen';
  letzter_fehler: string | null;
};

type Verbunden =
  | { provider: 'gmail'; conn: GmailConnection }
  | { provider: 'outlook'; conn: MicrosoftConnection }
  | null;

/**
 * Eine Karte für beide OAuth-Provider. Owner verbindet ENTWEDER Gmail
 * ODER Outlook – beide gleichzeitig macht im echten Alltag niemand und
 * würde nur verwirren („welche nutzt das Tool jetzt?").
 *
 * UI-Logik:
 *  - nichts verbunden → Auswahl-Block mit zwei Buttons
 *  - genau einer aktiv → Status-Block für diesen Provider + Disconnect
 *  - einer im Fehler-Zustand → roter Banner + „Neu verbinden" + Option
 *    auf Provider zu wechseln
 *  - beide verbunden (theoretisch möglich wenn jemand bewusst beides
 *    macht) → primärer Banner für Outlook (Versand-Hierarchie nutzt
 *    den zuerst), Sekundär-Hinweis für Gmail mit Disconnect
 */
export function EmailKontoCard({
  gmail,
  microsoft,
}: {
  gmail: GmailConnection | null;
  microsoft: MicrosoftConnection | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  // OAuth-Callback-Toast (gilt für beide Provider)
  useEffect(() => {
    const gmailParam = searchParams.get('gmail');
    const outlookParam = searchParams.get('outlook');
    const detail = searchParams.get('detail');
    if (gmailParam === 'connected') {
      toast.success(`Gmail verbunden: ${detail || 'Konto aktiv'}`);
    } else if (gmailParam === 'error') {
      toast.error(
        `Gmail-Verbindung fehlgeschlagen${detail ? ` (${detail})` : ''}`
      );
    } else if (outlookParam === 'connected') {
      toast.success(`Outlook verbunden: ${detail || 'Konto aktiv'}`);
    } else if (outlookParam === 'error') {
      toast.error(
        `Outlook-Verbindung fehlgeschlagen${detail ? ` (${detail})` : ''}`
      );
    }
    if (gmailParam || outlookParam) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('gmail');
      cleanUrl.searchParams.delete('outlook');
      cleanUrl.searchParams.delete('detail');
      window.history.replaceState({}, '', cleanUrl.toString());
    }
  }, [searchParams]);

  async function handleDisconnect(provider: 'gmail' | 'outlook') {
    if (busy) return;
    const isGmail = provider === 'gmail';
    const ok = await confirm({
      title: isGmail
        ? 'Gmail-Verbindung trennen?'
        : 'Outlook-Verbindung trennen?',
      description: isGmail
        ? 'Der Versand fällt danach auf den Postmark-Standard zurück. Du kannst jederzeit neu verbinden – oder auf Outlook wechseln.'
        : 'Der Versand fällt danach auf den Postmark-Standard zurück. Du kannst jederzeit neu verbinden – oder auf Gmail wechseln. Für vollständigen Widerruf in deinem Microsoft-Konto unter myaccount.microsoft.com die Auftragswerk-App entfernen.',
      confirmLabel: 'Verbindung trennen',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const url = isGmail
        ? '/api/auth/google/disconnect'
        : '/api/auth/microsoft/disconnect';
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Trennen fehlgeschlagen');
      } else {
        toast.success(
          isGmail ? 'Gmail-Verbindung getrennt' : 'Outlook-Verbindung getrennt'
        );
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Trennen fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  const gmailAktiv = gmail?.status === 'aktiv';
  const outlookAktiv = microsoft?.status === 'aktiv';
  const gmailFehler =
    gmail && (gmail.status === 'fehler' || gmail.status === 'widerrufen');
  const outlookFehler =
    microsoft &&
    (microsoft.status === 'fehler' || microsoft.status === 'widerrufen');

  const verbunden: Verbunden = outlookAktiv
    ? { provider: 'outlook', conn: microsoft! }
    : gmailAktiv
    ? { provider: 'gmail', conn: gmail! }
    : null;

  const fehlerAktiv = !verbunden && (gmailFehler || outlookFehler);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HugeiconsIcon icon={MailIcon} size={18} strokeWidth={1.5} />
          E-Mail-Konto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Aktiver Provider – grüner Status + Disconnect */}
        {verbunden && (
          <div className="space-y-3">
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
              <p className="font-medium text-green-900 flex items-center gap-2">
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  size={16}
                  strokeWidth={2}
                />
                {verbunden.provider === 'gmail' ? 'Gmail' : 'Outlook'} verbunden
                als{' '}
                <span className="font-mono text-xs">
                  {verbunden.provider === 'gmail'
                    ? verbunden.conn.google_email
                    : verbunden.conn.microsoft_email}
                </span>
              </p>
              <p className="text-xs text-green-800 mt-1">
                Antworten werden aus deinem{' '}
                {verbunden.provider === 'gmail' ? 'Gmail' : 'Outlook'}-Account
                versendet – Auftragswerk ist für deine Kunden komplett
                unsichtbar.
              </p>
              {verbunden.provider === 'gmail' &&
                verbunden.conn.calendar_sync_aktiv && (
                  <p className="text-xs text-green-800 mt-1">
                    Google-Kalender-Sync aktiv – belegte Zeiten werden
                    automatisch von den Termin-Vorschlägen ausgeblendet.
                  </p>
                )}
              {verbunden.provider === 'gmail' &&
                !verbunden.conn.calendar_sync_aktiv && (
                  <p className="text-xs text-green-800 mt-1">
                    Tipp: unter „Kalender" kannst du zusätzlich deinen
                    Google-Kalender verbinden, damit belegte Zeiten
                    automatisch ausgeblendet werden.
                  </p>
                )}
            </div>

            <div className="rounded-md border border-input bg-muted/30 p-3 text-xs text-foreground/80 space-y-1">
              <p className="font-medium text-foreground">
                Outbound läuft – Antworten gehen aus deinem{' '}
                {verbunden.provider === 'gmail' ? 'Gmail' : 'Outlook'} raus
              </p>
              <p className="text-muted-foreground">
                Für den Empfang von Kundenmails siehe die Karte „Mail-Empfang
                einrichten" unten.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDisconnect(verbunden.provider)}
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

            {/* Edge case: beide gleichzeitig verbunden – Owner soll wissen
                dass Outlook genutzt wird und Gmail "Backup" ist */}
            {verbunden.provider === 'outlook' && gmail && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Du hast zusätzlich Gmail verbunden ({gmail.google_email}). Das
                Tool nutzt Outlook – Gmail liegt nur im Hintergrund. Wenn du
                eigentlich Gmail nutzen willst, oben Outlook trennen.
              </div>
            )}
          </div>
        )}

        {/* Fehler-Zustand bei einem der Provider – wenn keiner aktiv */}
        {fehlerAktiv && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm">
            <p className="font-medium text-rose-900 flex items-center gap-2">
              <HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={2} />
              {gmailFehler ? 'Gmail-Verbindung' : 'Outlook-Verbindung'}{' '}
              unterbrochen
              <span className="font-mono text-xs">
                ({gmailFehler ? gmail!.google_email : microsoft!.microsoft_email})
              </span>
            </p>
            <p className="text-xs text-rose-800 mt-1">
              Bitte neu verbinden – bis dahin fällt der Versand auf
              info@auftragswerk.app zurück.
            </p>
            {((gmailFehler && gmail?.letzter_fehler) ||
              (outlookFehler && microsoft?.letzter_fehler)) && (
              <p className="text-xs text-rose-700 mt-1 font-mono">
                {gmailFehler ? gmail!.letzter_fehler : microsoft!.letzter_fehler}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a
                  href={
                    gmailFehler
                      ? '/api/auth/google/start'
                      : '/api/auth/microsoft/start'
                  }
                >
                  Neu verbinden
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a
                  href={
                    gmailFehler
                      ? '/api/auth/microsoft/start'
                      : '/api/auth/google/start'
                  }
                >
                  Stattdessen{' '}
                  {gmailFehler ? 'Outlook verbinden' : 'Gmail verbinden'}
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* Nichts verbunden – Auswahl-Block */}
        {!verbunden && !fehlerAktiv && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Verbinde dein Mail-Konto. Deine Antworten gehen dann aus deiner
              gewohnten Mail-Adresse raus – wie immer. Ein Klick, fertig.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
              <Button asChild className="w-full min-h-11">
                <a href="/api/auth/google/start">Mit Gmail verbinden</a>
              </Button>
              <Button asChild variant="outline" className="w-full min-h-11">
                <a href="/api/auth/microsoft/start">Mit Outlook verbinden</a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Du wählst eines – nicht beide. Wechseln geht jederzeit über
              „Verbindung trennen".
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
