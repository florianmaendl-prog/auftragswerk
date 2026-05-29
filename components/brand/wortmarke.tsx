import { cn } from '@/lib/utils';

/**
 * "AUFTRAGSWERK"-Wortmarke im Display-Stil (Saira Condensed, uppercased,
 * letter-spacing). Wird in Sidebar-Header, Login-Screen und Empty-States
 * verwendet, um die Brand klar zu setzen.
 *
 * Drei Größen:
 *   - sm: kompakt für Sidebar-Header
 *   - md: Default für Karten-Header / Onboarding
 *   - lg: Hero-Display für Login / Willkommen-Page
 */
export function Wortmarke({
  size = 'md',
  withTagline = false,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  withTagline?: boolean;
  className?: string;
}) {
  const titleSize = {
    sm: 'text-lg tracking-wider',
    md: 'text-2xl tracking-widest',
    lg: 'text-5xl tracking-[0.18em]',
  }[size];

  const taglineSize = {
    sm: 'text-[0.6rem]',
    md: 'text-xs',
    lg: 'text-sm',
  }[size];

  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      <span
        className={cn(
          'font-heading font-bold uppercase leading-none text-foreground',
          titleSize
        )}
      >
        Auftragswerk
      </span>
      {withTagline && (
        <span
          className={cn(
            'uppercase tracking-widest text-muted-foreground font-medium',
            taglineSize
          )}
        >
          Assistenz, die mitdenkt.
        </span>
      )}
    </div>
  );
}
