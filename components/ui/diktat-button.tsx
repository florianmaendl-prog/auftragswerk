'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Mic01Icon, MicOff01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

/**
 * Diktat-Button: Browser-native Web Speech API für Spracherkennung
 * (gratis, kein STT-Server). Praktiker-Feature für Handwerker im
 * Auto/Baustelle die nicht tippen wollen.
 *
 * Schreibt erkannten Text via Callback in den Editor (= append am Ende).
 * Mobile-relevant – iOS Safari + Android Chrome unterstützen das.
 *
 * Bei fehlender Browser-Unterstützung: Button sichtbar aber disabled
 * mit Tooltip. Handwerker soll wissen dass das Feature existiert, statt
 * dass es einfach fehlt.
 *
 * Bei "not-allowed" (Mikro blockiert): verständliche Anleitung mit
 * konkreten Schritten statt rohem API-Fehlercode.
 */

// Minimaler Typ-Shim für Web Speech API
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

type RecognitionResultLike = {
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
  resultIndex: number;
};

const MIKRO_BLOCKIERT_MELDUNG =
  'Dein Browser blockiert das Mikrofon für diese Seite. Klick auf das Schloss-Symbol links in der Adressleiste und erlaube das Mikrofon. Auf dem Mac zusätzlich prüfen: Systemeinstellungen → Datenschutz → Mikrofon → Browser erlauben.';

function fehlerMeldung(code: string | undefined): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return MIKRO_BLOCKIERT_MELDUNG;
    case 'network':
      return 'Die Spracherkennung braucht Internet. Bitte Verbindung prüfen.';
    case 'audio-capture':
      return 'Kein Mikrofon gefunden. Ist eins angeschlossen?';
    default:
      return 'Diktat hat nicht geklappt. Am zuverlässigsten funktioniert es in Chrome oder Edge.';
  }
}

export function DiktatButton({
  onText,
  disabled,
  className,
}: {
  onText: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [aktiv, setAktiv] = useState(false);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const finalBufferRef = useRef<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => RecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => RecognitionLike })
        .webkitSpeechRecognition;
    if (Ctor) setSupported(true);
  }, []);

  // Bei fehlendem Browser-Support: sichtbar aber disabled (Handwerker
  // soll wissen dass es das Feature gibt).
  if (!supported) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        className={cn('gap-1.5', className)}
        title="Diktat funktioniert in Chrome, Edge und Safari – dein Browser unterstützt es nicht."
      >
        <HugeiconsIcon icon={Mic01Icon} size={14} strokeWidth={1.5} />
        Diktat
      </Button>
    );
  }

  async function start() {
    // Permission-Pre-Check: wenn schon "denied", gar nicht erst starten,
    // sondern direkt die Anleitung zeigen. Safari kennt den Permission-
    // Namen manchmal nicht → try/catch.
    try {
      const perms = (
        navigator as unknown as {
          permissions?: {
            query: (o: { name: string }) => Promise<{ state: string }>;
          };
        }
      ).permissions;
      if (perms?.query) {
        const result = await perms.query({ name: 'microphone' });
        if (result.state === 'denied') {
          toast.error(MIKRO_BLOCKIERT_MELDUNG, { duration: 10000 });
          return;
        }
      }
    } catch {
      // Permission-API nicht verfügbar → weiter, echter Fehler kommt
      // dann aus onerror
    }

    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => RecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => RecognitionLike })
        .webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = 'de-DE';
    rec.continuous = true;
    rec.interimResults = false;

    finalBufferRef.current = '';
    rec.onresult = (eventRaw) => {
      const event = eventRaw as RecognitionResultLike;
      let neuerText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          neuerText += r[0].transcript;
        }
      }
      if (neuerText) {
        const trimmed = neuerText.trim();
        if (trimmed) {
          onText(' ' + trimmed);
        }
      }
    };
    rec.onerror = (evRaw) => {
      const ev = evRaw as { error?: string };
      // "no-speech" und "aborted" sind keine echten Fehler – User hat halt nichts gesagt
      if (ev.error && ev.error !== 'no-speech' && ev.error !== 'aborted') {
        console.warn('[Diktat] Web Speech API error:', ev.error);
        toast.error(fehlerMeldung(ev.error), { duration: 10000 });
      }
      setAktiv(false);
    };
    rec.onend = () => {
      setAktiv(false);
      recognitionRef.current = null;
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setAktiv(true);
    } catch (err) {
      console.warn('[Diktat] Start failed:', err);
      toast.error(fehlerMeldung(undefined), { duration: 10000 });
      setAktiv(false);
    }
  }

  function stop() {
    recognitionRef.current?.stop();
    setAktiv(false);
  }

  return (
    <Button
      type="button"
      variant={aktiv ? 'default' : 'outline'}
      size="sm"
      onClick={() => (aktiv ? stop() : start())}
      disabled={disabled}
      className={cn(
        'gap-1.5',
        aktiv && 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse',
        className
      )}
      title={aktiv ? 'Diktat stoppen' : 'Diktat starten'}
    >
      <HugeiconsIcon
        icon={aktiv ? MicOff01Icon : Mic01Icon}
        size={14}
        strokeWidth={1.5}
      />
      {aktiv ? 'Stopp' : 'Diktat'}
    </Button>
  );
}
