import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PapierkorbItemActions } from './papierkorb-item-actions';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon } from '@hugeicons/core-free-icons';

type AnfrageWithJoins = {
  id: string;
  betreff: string;
  von_name: string | null;
  von_email: string;
  status: string;
  created_at: string;
  geloescht_am: string;
  analysen: Array<{
    kategorie: string;
    gewerk_match: string | null;
    confidence: number | null;
  }> | null;
};

function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

const STATUS_LABEL: Record<string, string> = {
  neu: 'Eingang',
  entwurf_bereit: 'Freigabe',
  manuell_pruefen: 'Manuell prüfen',
  info: 'Info',
  versendet: 'Versendet',
  reply_eingegangen: 'Im Gespräch',
  erledigt: 'Erledigt',
  aussortiert: 'Aussortiert',
};

export default async function PapierkorbPage() {
  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from('anfragen')
    .select(
      `
      id,
      betreff,
      von_name,
      von_email,
      status,
      created_at,
      geloescht_am,
      analysen (kategorie, gewerk_match, confidence)
    `
    )
    .not('geloescht_am', 'is', null)
    .order('geloescht_am', { ascending: false })
    .limit(500);

  const anfragen = (items as AnfrageWithJoins[]) || [];

  return (
    <div className="container mx-auto py-8 px-6 max-w-5xl">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
        >
          ← Zurück zur Inbox
        </Link>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-wide mb-1 flex items-center gap-3">
          <HugeiconsIcon icon={Delete02Icon} size={28} strokeWidth={1.5} />
          Papierkorb
        </h1>
        <p className="text-muted-foreground text-sm">
          {anfragen.length}{' '}
          {anfragen.length === 1 ? 'Anfrage' : 'Anfragen'} im Papierkorb. Werden
          nach 30 Tagen automatisch endgültig gelöscht.
        </p>
      </div>

      {error && (
        <Card className="p-4 mb-4 border-destructive">
          <p className="text-sm text-destructive">Fehler beim Laden: {error.message}</p>
        </Card>
      )}

      {anfragen.length === 0 && !error && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground text-sm">Papierkorb ist leer.</p>
        </Card>
      )}

      <div className="space-y-2">
        {anfragen.map((anfrage) => {
          const klass = anfrage.analysen?.[0];
          const daysGone = daysSince(anfrage.geloescht_am);
          const daysLeft = Math.max(0, 30 - daysGone);

          return (
            <Card key={anfrage.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{anfrage.betreff}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="truncate">
                      von {anfrage.von_name || anfrage.von_email}
                    </span>
                    <span>·</span>
                    <span className="flex-shrink-0">
                      vorher: {STATUS_LABEL[anfrage.status] || anfrage.status}
                    </span>
                    {klass && (
                      <>
                        <span>·</span>
                        <span className="flex-shrink-0">{klass.kategorie}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gelöscht am {formatDateTime(anfrage.geloescht_am)}
                    {' · '}
                    <span
                      className={cn(
                        daysLeft <= 7
                          ? 'text-amber-600 font-medium'
                          : 'text-muted-foreground'
                      )}
                    >
                      noch {daysLeft} {daysLeft === 1 ? 'Tag' : 'Tage'}
                    </span>
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <PapierkorbItemActions anfrageId={anfrage.id} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}