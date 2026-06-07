import { cn } from '@/lib/utils';

/**
 * Visualisiert die KI-Klassifikation als Pill-Badge.
 * Bewusst eine *Handlungsanweisung* statt einer Prio-Skala (HOCH/MITTEL/NIEDRIG
 * überfordert Handwerker, sagt nicht was zu tun ist). Owner sieht auf einen
 * Blick: "Anfrage = entwerfen lassen, Prüfen = selbst draufschauen, Info =
 * zur Kenntnis, Aussortiert = ignorieren, Passt nicht = Absage schreiben".
 *
 * Combined-Logik: bei kategorie='kundenanfrage' entscheidet zusätzlich
 * gewerk_match (passt vs. unklar vs. passt_nicht), weil das die eigentliche
 * Handlungsanweisung für den Owner ist.
 */

type Kategorie =
  | 'kundenanfrage'
  | 'unklar'
  | 'rechnung'
  | 'bestellung_versand'
  | 'innung_behoerde'
  | 'sonstiges'
  | 'werbung'
  | null
  | undefined;

type GewerkMatch = 'passt' | 'unklar' | 'passt_nicht' | null | undefined;

type Variant = 'anfrage' | 'pruefen' | 'info' | 'aussortiert' | 'passt_nicht';

const variantStyles: Record<Variant, { label: string; klass: string }> = {
  anfrage: {
    label: 'Anfrage',
    klass: 'bg-primary text-primary-foreground',
  },
  pruefen: {
    label: 'Prüfen',
    klass: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200',
  },
  info: {
    label: 'Info',
    klass: 'bg-secondary text-foreground/80',
  },
  aussortiert: {
    label: 'Aussortiert',
    klass: 'bg-muted text-muted-foreground',
  },
  passt_nicht: {
    label: 'Passt nicht',
    klass: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200',
  },
};

function resolveVariant(
  kategorie: Kategorie,
  gewerkMatch: GewerkMatch
): Variant | null {
  if (!kategorie) return null;

  if (kategorie === 'kundenanfrage') {
    if (gewerkMatch === 'passt_nicht') return 'passt_nicht';
    if (gewerkMatch === 'unklar') return 'pruefen';
    return 'anfrage'; // 'passt' oder null → echte Anfrage
  }

  if (kategorie === 'unklar' || kategorie === 'sonstiges') return 'pruefen';
  if (
    kategorie === 'rechnung' ||
    kategorie === 'bestellung_versand' ||
    kategorie === 'innung_behoerde'
  )
    return 'info';
  if (kategorie === 'werbung') return 'aussortiert';

  return null;
}

export function KategorieBadge({
  kategorie,
  gewerkMatch,
  className,
}: {
  kategorie: Kategorie;
  gewerkMatch?: GewerkMatch;
  className?: string;
}) {
  const variant = resolveVariant(kategorie, gewerkMatch);
  if (!variant) return null;
  const style = variantStyles[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide whitespace-nowrap',
        style.klass,
        className
      )}
    >
      {style.label}
    </span>
  );
}
