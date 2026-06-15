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
 * Fallback: wenn Browser nicht unterstützt → Button hidden statt Error.
 */

// Minimaler Typ-Shim für Web Speech API – wird vom TS-Lib nicht standard-mäßig
// bereitgestellt, je nach Browser ist es webkitSpeechRecognition.
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

  if (!supported) return null;

  function start() {
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
        // Sicherstellen dass am Anfang ein Trennzeichen vorhanden ist
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
        toast.error(`Diktat-Fehler: ${ev.error}`);
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
      toast.error(err instanceof Error ? err.message : 'Diktat konnte nicht starten');
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
