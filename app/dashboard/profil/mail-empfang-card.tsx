'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  InboxIcon,
  Copy01Icon,
  CheckmarkCircle02Icon,
  ArrowDown01Icon,
  ArrowRight02Icon,
  HelpCircleIcon,
  CancelCircleIcon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

const DISMISSED_KEY = 'auftragswerk:mail-empfang-anleitung-dismissed';

type Provider = 'workspace' | 'ionos' | 'wordpress' | 'allgemein';

const PROVIDERS: { id: Provider; label: string; subtitle: string }[] = [
  { id: 'workspace', label: 'Gmail / Google Workspace', subtitle: 'wenn dein info@... über Google läuft' },
  { id: 'ionos', label: 'IONOS / 1&1', subtitle: 'Webhosting + E-Mail' },
  { id: 'wordpress', label: 'WordPress.com Email', subtitle: 'E-Mail-Weiterleitung im WP-Plan' },
  { id: 'allgemein', label: 'Anderer Provider', subtitle: 'Strato, all-inkl, eigener Server, …' },
];

/**
 * Card "Mail-Empfang einrichten". Zeigt dem Owner die saubere
 * Inbound-Adresse seines Betriebs (Subdomain seit Welle E.2) +
 * Forward-Anleitungen pro Provider, damit Kundenmails an seine
 * Geschäftsadresse (z.B. info@mustermann-bau.de) automatisch
 * in Auftragswerk landen.
 *
 * Endkunden schreiben weiterhin an die echte Geschäftsadresse –
 * der Forward ist unsichtbar für sie. Die Subdomain-Adresse
 * (`slug@kunden.auftragswerk.app`) ist nur das interne Ziel.
 *
 * Dismissable mit localStorage, mit ghost-Link zum Wieder-Einblenden.
 */
export function MailEmpfangCard({
  inboundEmail,
}: {
  inboundEmail: string | null;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [offenerProvider, setOffenerProvider] = useState<Provider | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(DISMISSED_KEY) === '1') {
      setDismissed(true);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    window.localStorage.setItem(DISMISSED_KEY, '1');
  }

  function show() {
    setDismissed(false);
    window.localStorage.removeItem(DISMISSED_KEY);
  }

  async function copyAddress() {
    if (!inboundEmail) return;
    try {
      await navigator.clipboard.writeText(inboundEmail);
      toast.success('Adresse in die Zwischenablage kopiert');
    } catch {
      toast.error('Konnte nicht kopieren – manuell auswählen');
    }
  }

  if (!inboundEmail) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HugeiconsIcon icon={InboxIcon} size={18} strokeWidth={1.5} />
          Mail-Empfang einrichten
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inbound-Adresse prominent zum Kopieren */}
        <div className="rounded-md border bg-secondary/30 p-3 space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            Deine Auftragswerk-Inbound-Adresse
          </p>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 min-w-0 truncate rounded-md bg-background border px-3 py-2 text-sm font-mono">
              {inboundEmail}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyAddress}
              className="gap-1.5 flex-shrink-0"
            >
              <HugeiconsIcon icon={Copy01Icon} size={14} strokeWidth={1.5} />
              Kopieren
            </Button>
          </div>
        </div>

        {dismissed ? (
          <button
            type="button"
            onClick={show}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <HugeiconsIcon icon={HelpCircleIcon} size={14} strokeWidth={1.5} />
            Setup-Anleitung wieder anzeigen
          </button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium">
                    Damit Mails an deine Geschäftsadresse hier ankommen
                  </p>
                  <p className="text-amber-800">
                    Deine Kunden schreiben weiter an deine gewohnte Adresse
                    (z. B. <code className="bg-amber-100 rounded px-1">info@dein-betrieb.de</code>).
                    Richte dort einmalig eine Weiterleitung auf die
                    Auftragswerk-Adresse oben ein.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Anleitung schließen"
                  title="Weiterleitung ist eingerichtet – Anleitung schließen"
                  className="flex-shrink-0 -mt-0.5 -mr-1 rounded p-1 text-amber-700 hover:bg-amber-100 hover:text-amber-900 transition-colors"
                >
                  <HugeiconsIcon icon={CancelCircleIcon} size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Provider-Auswahl als Akkordeon */}
            <div className="space-y-1">
              {PROVIDERS.map((p) => {
                const offen = offenerProvider === p.id;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      'rounded-md border transition-colors',
                      offen ? 'border-primary/40 bg-primary/5' : 'border-input bg-background'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setOffenerProvider(offen ? null : p.id)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{p.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.subtitle}</p>
                      </div>
                      <HugeiconsIcon
                        icon={offen ? ArrowDown01Icon : ArrowRight02Icon}
                        size={14}
                        strokeWidth={1.5}
                        className="flex-shrink-0 text-muted-foreground"
                      />
                    </button>
                    {offen && (
                      <div className="px-3 pb-3 pt-1 text-xs text-foreground/85 space-y-2 border-t border-primary/20">
                        <ProviderAnleitung id={p.id} inboundEmail={inboundEmail} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={dismiss}
                className="gap-1.5 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
              >
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  size={14}
                  strokeWidth={2}
                />
                Weiterleitung ist eingerichtet
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Provider-spezifische Forward-Anleitung. Bewusst kein Klick-für-Klick-
 * Tutorial (Interfaces ändern sich), sondern konkreter Pfad + Tipps.
 */
function ProviderAnleitung({
  id,
  inboundEmail,
}: {
  id: Provider;
  inboundEmail: string;
}) {
  switch (id) {
    case 'workspace':
      return (
        <>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              In Gmail/Workspace: <strong>Einstellungen</strong> (Zahnrad) →{' '}
              <strong>Alle Einstellungen aufrufen</strong> →{' '}
              <strong>Weiterleitung und POP/IMAP</strong>
            </li>
            <li>
              <strong>Weiterleitungsadresse hinzufügen</strong> → trag ein:
              <br />
              <code className="bg-primary/10 rounded px-1 break-all">
                {inboundEmail}
              </code>
            </li>
            <li>
              Google sendet einen Bestätigungs-Code an diese Adresse → der
              landet als neue Anfrage in Auftragswerk-Inbox. Code öffnen und
              kopieren.
            </li>
            <li>
              Zurück in Gmail-Settings → Code eingeben → bestätigen → wählen:
              <em>„Eine Kopie an eingehende Nachrichten weiterleiten an
              {' '}{inboundEmail}"</em>
            </li>
          </ol>
          <p className="text-muted-foreground pt-1">
            Tipp: alternativ <strong>Filter erstellen</strong> für „Alle
            eingehenden Mails" → Aktion <em>Weiterleiten an</em>. Bei
            Google Workspace mit eigener Domain geht auch
            <em>Routing</em> über die Admin-Konsole.
          </p>
        </>
      );

    case 'ionos':
      return (
        <>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              Login bei <strong>IONOS</strong> → <strong>E-Mail</strong> →
              dein E-Mail-Postfach anklicken
            </li>
            <li>
              <strong>Weiterleitung einrichten</strong> oder{' '}
              <strong>E-Mail-Weiterleitung</strong>
            </li>
            <li>
              Ziel-Adresse eingeben:
              <br />
              <code className="bg-primary/10 rounded px-1 break-all">
                {inboundEmail}
              </code>
            </li>
            <li>
              Empfehlung: <strong>„Kopie behalten"</strong> aktivieren – damit
              hast du im Original-Postfach noch ein Backup
            </li>
          </ol>
          <p className="text-muted-foreground pt-1">
            Bei IONOS-Webhosting-Paketen ist Email-Forwarding kostenlos.
            Aktiv nach 1-2 Min.
          </p>
        </>
      );

    case 'wordpress':
      return (
        <>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              Login bei <strong>WordPress.com</strong> → deine Site öffnen
            </li>
            <li>
              <strong>Upgrades</strong> → <strong>Emails</strong> (oder direkt{' '}
              <strong>E-Mail-Weiterleitung</strong> falls im Plan enthalten)
            </li>
            <li>
              <strong>Neue Weiterleitung hinzufügen</strong>:
              <br />
              Source: <code className="bg-primary/10 rounded px-1">info</code> (oder dein gewünschter Alias)
              <br />
              Destination:{' '}
              <code className="bg-primary/10 rounded px-1 break-all">
                {inboundEmail}
              </code>
            </li>
            <li>Speichern → aktiv nach wenigen Minuten</li>
          </ol>
          <p className="text-muted-foreground pt-1">
            Wenn dein Plan keine Email-Weiterleitung enthält, brauchst du
            entweder Google Workspace (über WordPress.com einrichtbar) oder
            einen Wechsel zu einem Hoster mit kostenloser Weiterleitung
            (z. B. IONOS, all-inkl).
          </p>
        </>
      );

    case 'allgemein':
      return (
        <>
          <p>
            Bei den meisten Providern (Strato, all-inkl, mailbox.org, eigener
            Server) findest du die Funktion unter:
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>E-Mail-Verwaltung → <strong>Weiterleitung</strong> / <strong>Forward</strong></li>
            <li>oder im Postfach selbst → <strong>Filter / Regel</strong> erstellen → Aktion „Weiterleiten an"</li>
          </ul>
          <p className="pt-1">
            Ziel-Adresse für die Weiterleitung:
            <br />
            <code className="bg-primary/10 rounded px-1 break-all">
              {inboundEmail}
            </code>
          </p>
          <p className="text-muted-foreground pt-1">
            Wichtig: <strong>nicht</strong> „Antwort-an" oder „From" ändern –
            nur eine Weiterleitung der ankommenden Mails.
          </p>
        </>
      );
  }
}
