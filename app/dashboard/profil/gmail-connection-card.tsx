'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  MailIcon,
  CheckmarkCircle02Icon,
  Alert02Icon,
  CancelCircleIcon,
  HelpCircleIcon,
} from '@hugeicons/core-free-icons';

const ANLEITUNG_DISMISSED_KEY = 'auftragswerk:gmail-filter-anleitung-dismissed';

type GmailConnection = {
  google_email: string;
  status: 'aktiv' | 'fehler' | 'widerrufen';
  letzter_fehler: string | null;
};

/**
 * Card im Profil für die Gmail-OAuth-Verbindung. Drei sichtbare Zustände:
 *
 *  1. Nicht verbunden → CTA "Mit Gmail verbinden" + Warnscreen-Hinweis.
 *  2. Verbunden (aktiv) → grüner Banner mit google_email + Disconnect-Button.
 *  3. Fehler / widerrufen → roter Banner mit Hinweis "neu verbinden".
 *
 * Liest URL-Param `?gmail=connected|error` nach dem OAuth-Callback und
 * zeigt entsprechenden Toast.
 */
export function GmailConnectionCard({
  initial,
}: {
  initial: GmailConnection | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  // Filter-Anleitung minimieren wenn User "Erledigt" geklickt hat.
  // Persistiert in localStorage damit's nach Reload weg bleibt.
  const [anleitungDismissed, setAnleitungDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(ANLEITUNG_DISMISSED_KEY) === '1') {
      setAnleitungDismissed(true);
    }
  }, []);

  function dismissAnleitung() {
    setAnleitungDismissed(true);
    window.localStorage.setItem(ANLEITUNG_DISMISSED_KEY, '1');
  }

  function showAnleitung() {
    setAnleitungDismissed(false);
    window.localStorage.removeItem(ANLEITUNG_DISMISSED_KEY);
  }

  // OAuth-Callback-Feedback verarbeiten + URL bereinigen
  useEffect(() => {
    const gmail = searchParams.get('gmail');
    if (!gmail) return;
    const detail = searchParams.get('detail');
    if (gmail === 'connected') {
      toast.success(`Gmail verbunden: ${detail || 'Konto aktiv'}`);
    } else if (gmail === 'error') {
      toast.error(
        `Gmail-Verbindung fehlgeschlagen${detail ? ` (${detail})` : ''}`
      );
    }
    // URL aufräumen damit Toast nicht bei jedem Re-Render wieder feuert
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('gmail');
    cleanUrl.searchParams.delete('detail');
    window.history.replaceState({}, '', cleanUrl.toString());
  }, [searchParams]);

  async function handleDisconnect() {
    if (busy) return;
    if (
      !confirm(
        'Gmail-Verbindung trennen? Versand fällt danach auf den Postmark-Standard zurück. Du kannst jederzeit neu verbinden.'
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/google/disconnect', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Trennen fehlgeschlagen');
      } else {
        toast.success('Gmail-Verbindung getrennt');
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
          E-Mail-Konto
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
                <span className="font-mono text-xs">{initial!.google_email}</span>
              </p>
              <p className="text-xs text-green-800 mt-1">
                Antworten werden aus deinem Gmail-Account versendet – Auftragswerk
                ist für deine Kunden komplett unsichtbar.
              </p>
            </div>

            {anleitungDismissed ? (
              <button
                type="button"
                onClick={showAnleitung}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <HugeiconsIcon
                  icon={HelpCircleIcon}
                  size={14}
                  strokeWidth={1.5}
                />
                Gmail-Filter-Anleitung wieder anzeigen
              </button>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    Damit Kunden-Antworten zurück in Auftragswerk kommen:
                  </p>
                  <button
                    type="button"
                    onClick={dismissAnleitung}
                    aria-label="Anleitung schließen"
                    title="Filter ist eingerichtet – Anleitung schließen"
                    className="flex-shrink-0 -mt-0.5 -mr-1 rounded p-1 text-amber-700 hover:bg-amber-100 hover:text-amber-900 transition-colors"
                  >
                    <HugeiconsIcon
                      icon={CancelCircleIcon}
                      size={16}
                      strokeWidth={1.5}
                    />
                  </button>
                </div>
                <p>
                  Antworten landen automatisch in deinem Gmail. Damit sie
                  auch hier im Tool auftauchen, richte einmal einen Gmail-Filter ein:
                </p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>
                    In Gmail: <strong>Einstellungen</strong> (Zahnrad) →{' '}
                    <strong>Alle Einstellungen aufrufen</strong> →{' '}
                    <strong>Filter und blockierte Adressen</strong> →{' '}
                    <strong>Neuen Filter erstellen</strong>
                  </li>
                  <li>
                    Feld <strong>Betreff</strong>:{' '}
                    <code className="rounded bg-amber-100 px-1 py-0.5">AW:</code>{' '}
                    (oder passendes Pattern für deine Antworten)
                  </li>
                  <li>
                    <strong>Filter erstellen</strong> klicken →{' '}
                    <strong>„Weiterleiten an"</strong> ankreuzen → die
                    Auftragswerk-Inbound-Adresse hinzufügen + bestätigen
                  </li>
                </ol>
                <p className="pt-1">
                  Inbound-Adresse für die Weiterleitung:
                </p>
                <p className="font-mono text-[0.7rem] break-all bg-amber-100 rounded px-2 py-1">
                  22410d58b0879712e00751421bbe7f29@inbound.postmarkapp.com
                </p>
                <p className="pt-1 italic text-amber-800">
                  Bald nicht mehr nötig: wir bauen eine eigene Adresse pro Betrieb
                  (`max@kunden.auftragswerk.app`-Stil). Dann fällt dieser Schritt weg.
                </p>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={dismissAnleitung}
                    className="gap-1.5 border-amber-300 bg-white hover:bg-amber-100 text-amber-900"
                  >
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      size={14}
                      strokeWidth={2}
                    />
                    Filter ist eingerichtet
                  </Button>
                </div>
              </div>
            )}

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
              {initial!.google_email && (
                <span className="font-mono text-xs">
                  ({initial!.google_email})
                </span>
              )}
            </p>
            <p className="text-xs text-rose-800 mt-1">
              {initial!.status === 'widerrufen'
                ? 'Der Zugriff wurde in deinem Google-Konto widerrufen.'
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
                <a href="/api/auth/google/start">Neu verbinden</a>
              </Button>
            </div>
          </div>
        )}

        {!initial && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Verbinde dein Gmail. Deine Antworten gehen dann aus deiner
              gewohnten Mail-Adresse raus – wie immer. Ein Klick, fertig.
            </p>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <strong className="font-medium">Beim ersten Klick:</strong> Google
              zeigt eine Warnung „Diese App ist nicht verifiziert" – ist
              normal. Klick auf <strong>„Erweitert"</strong> →{' '}
              <strong>„Auftragswerk (unsicher) öffnen"</strong>. Die App ist
              sicher, läuft nur gerade durch die Google-Prüfung.
            </div>
            <Button asChild className="w-full sm:w-auto">
              <a href="/api/auth/google/start">Mit Gmail verbinden</a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
