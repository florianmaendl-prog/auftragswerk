'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import EntwurfEditor from './entwurf-editor';
import { ReplyEditor } from './reply-editor';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiMagicIcon, MailEdit01Icon } from '@hugeicons/core-free-icons';

/**
 * Antwort-Bereich mit Toggle „KI-Entwurf nutzen" ↔ „Selbst schreiben".
 *
 * Hintergrund (STRATEGIE A2): Reply-Editor war bisher nur Fallback wenn
 * kein Entwurf da war. Owner ohne KI-Vertrauen hatte keine sichtbare
 * Alternative – Tool wirkte als Zwang. Mit dem Toggle stehen beide
 * Pfade gleichwertig nebeneinander: „KI-Entwurf nimmt dir Tippen ab,
 * aber du kannst genauso gut selbst schreiben."
 *
 * Default = KI-Entwurf (weil schon fertig). Toggle wechselt zum leeren
 * ReplyEditor. Der KI-Entwurf bleibt in der DB liegen, beim Zurück-
 * toggeln ist alles wieder da. Wenn Owner über „Selbst schreiben"
 * sendet, geht's über /api/versand/manuell – KI-Entwurf wird nicht
 * versendet, bleibt aber als historische Spur.
 */
export function AntwortBereich({
  entwurf,
  anfrageId,
  empfaenger,
  empfaengerName,
  urspruenglicherBetreff,
  kiBildAnzahl,
  kiPdfAnzahl,
}: {
  entwurf: {
    id: string;
    betreff_vorschlag: string;
    body_text: string;
    interne_notiz: string | null;
    status: string;
    modell: string | null;
  };
  anfrageId: string;
  empfaenger: string;
  empfaengerName: string | null;
  urspruenglicherBetreff: string;
  kiBildAnzahl?: number;
  kiPdfAnzahl?: number;
}) {
  const [modus, setModus] = useState<'ki' | 'selbst'>('ki');

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Antwort-Modus wählen"
        className="grid grid-cols-2 gap-1 rounded-md border border-input bg-muted/40 p-1 text-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={modus === 'ki'}
          onClick={() => setModus('ki')}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-colors',
            modus === 'ki'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <HugeiconsIcon
            icon={AiMagicIcon}
            size={14}
            strokeWidth={1.5}
            className="hidden sm:inline"
          />
          KI-Entwurf nutzen
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modus === 'selbst'}
          onClick={() => setModus('selbst')}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-colors',
            modus === 'selbst'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <HugeiconsIcon
            icon={MailEdit01Icon}
            size={14}
            strokeWidth={1.5}
            className="hidden sm:inline"
          />
          Selbst schreiben
        </button>
      </div>

      {modus === 'ki' ? (
        <EntwurfEditor
          entwurf={entwurf}
          anfrageId={anfrageId}
          empfaenger={empfaenger}
          kiBildAnzahl={kiBildAnzahl}
          kiPdfAnzahl={kiPdfAnzahl}
        />
      ) : (
        <ReplyEditor
          anfrageId={anfrageId}
          empfaenger={empfaenger}
          empfaengerName={empfaengerName}
          urspruenglicherBetreff={urspruenglicherBetreff}
        />
      )}
    </div>
  );
}
