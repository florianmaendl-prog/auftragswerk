'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { KategorieBadge } from '@/components/brand/kategorie-badge';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight02Icon,
  ArrowLeft02Icon,
  CheckmarkCircle02Icon,
  Calendar03Icon,
  Idea01Icon,
  ShieldUserIcon,
  HelpCircleIcon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

const TOUR_KEY = 'auftragswerk:tour-gesehen';

/**
 * Funktions-Tour als Dialog beim ersten Login. Statt Screenshots werden
 * die echten UI-Komponenten der App mit kuratiertem Fake-Content gerendert
 * – aktualisiert sich automatisch wenn die UI sich ändert, premium-Optik
 * konsistent zur App.
 *
 * 5 Slides:
 *   1. Anfrage kommt rein (Inbox-Card-Mock)
 *   2. Entwurf ist fertig (Editor-Mock mit Antworttext)
 *   3. Termine gleich dabei (TerminCard-Mock mit Slots)
 *   4. Vertrauen ("Bei jeder Mail entscheidest du" – pure Botschaft)
 *   5. Lernt deinen Ton (Stilbeispiel-Mock)
 *
 * Beim ersten Öffnen automatisch (localStorage-Flag), danach via
 * "Funktions-Tour wiederholen"-Link manuell. Skip jederzeit möglich.
 */
export function FunktionsTour({
  autoOpen = false,
  trigger,
}: {
  autoOpen?: boolean;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Beim ersten Mount: prüfen ob Tour schon gesehen wurde
  useEffect(() => {
    if (!autoOpen || typeof window === 'undefined') return;
    if (window.localStorage.getItem(TOUR_KEY) !== '1') {
      // kleine Verzögerung damit die Page erst sauber aufbaut
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [autoOpen]);

  function close() {
    setOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOUR_KEY, '1');
    }
    // beim nächsten Öffnen wieder bei Slide 0 starten
    setTimeout(() => setStep(0), 200);
  }

  function next() {
    if (step < SLIDES.length - 1) {
      setStep(step + 1);
    } else {
      close();
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  function openManually() {
    setStep(0);
    setOpen(true);
  }

  const current = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <>
      {trigger && (
        <span onClick={openManually} className="inline-block">
          {trigger}
        </span>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent
          showCloseButton={true}
          className="max-w-2xl p-0 gap-0 overflow-hidden"
        >
          {/* sr-only Title für Accessibility */}
          <DialogTitle className="sr-only">
            Funktions-Tour: {current.titel}
          </DialogTitle>

          {/* Slide-Inhalt */}
          <div className="px-6 sm:px-8 pt-8 pb-6 min-h-[480px] flex flex-col">
            <div className="mb-5 text-center">
              <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-medium mb-2">
                Schritt {step + 1} von {SLIDES.length}
              </p>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold uppercase tracking-wide leading-tight text-foreground">
                {current.titel}
              </h2>
              {current.subtitel && (
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                  {current.subtitel}
                </p>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center">
              {current.render()}
            </div>
          </div>

          {/* Footer mit Progress-Dots + Navigation */}
          <div className="border-t bg-muted/30 px-6 sm:px-8 py-4 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={prev}
              disabled={step === 0}
              className="gap-1.5"
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} size={14} strokeWidth={2} />
              Zurück
            </Button>

            <div className="flex items-center gap-1.5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStep(i)}
                  aria-label={`Zu Schritt ${i + 1} springen`}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === step
                      ? 'w-6 bg-primary'
                      : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  )}
                />
              ))}
            </div>

            <Button onClick={next} size="sm" className="gap-1.5">
              {isLast ? 'Loslegen' : 'Weiter'}
              <HugeiconsIcon icon={ArrowRight02Icon} size={14} strokeWidth={2} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================
// Mock-Slides – echte UI-Komponenten + Fake-Content
// ============================================

type Slide = {
  titel: string;
  subtitel?: string;
  render: () => React.ReactNode;
};

const SLIDES: Slide[] = [
  // ============================================
  // 1. Anfrage kommt rein – Inbox-Card-Look
  // ============================================
  {
    titel: 'Anfrage kommt rein',
    subtitel:
      'Eine Kundenanfrage landet automatisch in deiner Auftragswerk-Inbox – sortiert, mit Kategorie.',
    render: () => (
      <div className="w-full max-w-md mx-auto">
        <Card className="border-border/80 shadow-sm">
          <CardContent className="p-4 sm:p-5 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-foreground truncate">
                  Sabine Müller
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  sabine.mueller@web.de
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <KategorieBadge kategorie="kundenanfrage" gewerkMatch="passt" />
                <span className="text-[11px] text-muted-foreground">
                  Vor 5 Min
                </span>
              </div>
            </div>
            <p className="text-sm font-medium text-foreground mt-2">
              Anfrage Aufmaß Carport – nächste Woche möglich?
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              Guten Tag, wir möchten an unser Haus einen Carport anbauen
              lassen, ca. 6 x 3 m. Wäre ein Aufmaß-Termin nächste Woche
              möglich? Wir sind flexibel …
            </p>
          </CardContent>
        </Card>
      </div>
    ),
  },

  // ============================================
  // 2. Entwurf ist fertig – Editor-Mock
  // ============================================
  {
    titel: 'Der Entwurf liegt schon fertig',
    subtitel:
      'Während du noch auf der Baustelle bist, hat die KI bereits einen Antwortentwurf in deinem Ton geschrieben.',
    render: () => (
      <div className="w-full">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">
                Antwort-Entwurf
              </CardTitle>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-secondary">
                Bereit
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[60px_1fr] gap-x-2 gap-y-1.5 text-xs">
              <span className="text-muted-foreground">An:</span>
              <span className="font-mono text-foreground truncate">
                sabine.mueller@web.de
              </span>
              <span className="text-muted-foreground">Betreff:</span>
              <span className="font-medium text-foreground truncate">
                AW: Anfrage Aufmaß Carport
              </span>
            </div>

            <Textarea
              readOnly
              value={`Hallo Frau Müller,

danke für Ihre Anfrage. Für ein Aufmaß komme ich gern bei Ihnen vorbei – ich bringe alles mit, was wir dafür brauchen.

Passen Ihnen einer dieser Termine?
• Di 8.6. um 9:30 Uhr
• Mi 9.6. um 14:00 Uhr
• Do 10.6. um 8:00 Uhr

Geben Sie mir kurz Bescheid welcher.

Beste Grüße
[Dein Name]`}
              className="text-xs leading-relaxed font-sans h-44 resize-none pointer-events-none"
            />

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-[11px] text-muted-foreground">
                Was du änderst, hilft beim nächsten Mal.
              </span>
              <div className="flex gap-2">
                <span className="text-xs px-3 py-1.5 rounded-md border border-input text-muted-foreground">
                  Speichern
                </span>
                <span className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold">
                  Senden
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    ),
  },

  // ============================================
  // 3. Termine gleich dabei – TerminCard-Mock
  // ============================================
  {
    titel: 'Termine sind gleich dabei',
    subtitel:
      'Die KI schaut in deinen Kalender und schlägt direkt 2–3 freie Slots vor. Du machst einen mit einem Klick fest.',
    render: () => (
      <div className="w-full max-w-md mx-auto">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HugeiconsIcon
                icon={Calendar03Icon}
                size={16}
                strokeWidth={1.5}
                className="text-primary"
              />
              Termin-Vorschläge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { tag: 'Di', datum: '8.6.', zeit: '9:30 Uhr' },
              { tag: 'Mi', datum: '9.6.', zeit: '14:00 Uhr' },
              { tag: 'Do', datum: '10.6.', zeit: '8:00 Uhr' },
            ].map((slot, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-md border border-input bg-background px-3 py-2.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 text-center w-10">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {slot.tag}
                    </p>
                    <p className="text-sm font-bold text-foreground leading-tight">
                      {slot.datum}
                    </p>
                  </div>
                  <span className="text-sm text-foreground">{slot.zeit}</span>
                </div>
                <span
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-md font-medium',
                    i === 0
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-input text-muted-foreground'
                  )}
                >
                  Festmachen
                </span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-1 leading-relaxed">
              Aus deiner Verfügbarkeit. Bestätigte Termine landen direkt im
              Kalender.
            </p>
          </CardContent>
        </Card>
      </div>
    ),
  },

  // ============================================
  // 4. Vertrauen – pure Botschaft
  // ============================================
  {
    titel: 'Bei jeder Mail entscheidest du',
    subtitel: undefined,
    render: () => (
      <div className="w-full max-w-md mx-auto text-center space-y-6 py-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <HugeiconsIcon
            icon={ShieldUserIcon}
            size={32}
            strokeWidth={1.5}
            className="text-primary"
          />
        </div>
        <p className="text-lg sm:text-xl text-foreground leading-relaxed font-medium">
          Es geht keine Mail raus, bevor du auf <strong>Senden</strong>{' '}
          klickst.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
          Du liest jeden Entwurf, änderst was nicht passt, und entscheidest
          bei jeder einzelnen. Auftragswerk schreibt nur vor – du gibst die
          Antwort frei.
        </p>
      </div>
    ),
  },

  // ============================================
  // 5. Lernt deinen Ton – Stilbeispiel-Mock
  // ============================================
  {
    titel: 'Lernt deinen Ton',
    subtitel:
      'Je mehr du die KI nutzt und kleine Sachen anpasst, desto besser klingen die Entwürfe nach dir.',
    render: () => (
      <div className="w-full max-w-md mx-auto">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HugeiconsIcon
                icon={Idea01Icon}
                size={16}
                strokeWidth={1.5}
                className="text-primary"
              />
              Wie du schreibst
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              'Servus, schau ich mir morgen früh an.',
              'Material bring ich mit, brauchen Sie nichts vorbereiten.',
              'Termin passt – melde mich Montag wegen genauer Uhrzeit.',
            ].map((satz, i) => (
              <div
                key={i}
                className="rounded-md bg-secondary/50 border border-border/60 px-3 py-2.5"
              >
                <p className="text-xs text-foreground/85 italic leading-relaxed">
                  „{satz}"
                </p>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-2 leading-relaxed">
              Solche Stilbeispiele pflegst du im Profil. Je mehr, desto
              besser trifft die KI deinen Ton.
            </p>
          </CardContent>
        </Card>
      </div>
    ),
  },
];

/**
 * Hilfs-Komponente für den permanenten „Tour wiederholen"-Link
 * unten auf der Willkommen-Page.
 */
export function FunktionsTourLink() {
  return (
    <FunktionsTour
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <HugeiconsIcon icon={HelpCircleIcon} size={14} strokeWidth={1.5} />
          Funktions-Tour nochmal ansehen
        </button>
      }
    />
  );
}
