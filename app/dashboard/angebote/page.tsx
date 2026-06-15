import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/brand/empty-state';
import { File02Icon } from '@hugeicons/core-free-icons';
import { NeuesAngebotButton } from './neues-angebot-button';

type AngebotRow = {
  id: string;
  titel: string | null;
  status: string;
  summe_netto: number;
  summe_brutto: number;
  angebotsnummer: string | null;
  versendet_am: string | null;
  gueltig_bis: string | null;
  updated_at: string;
  anfrage_id: string | null;
  empfaenger_name: string | null;
  empfaenger_email: string | null;
  empfaenger_firma: string | null;
  anfragen: { von_name: string | null; von_email: string; betreff: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  entwurf: 'Entwurf',
  versendet: 'Versendet',
  angenommen: 'Angenommen',
  abgelehnt: 'Abgelehnt',
};

const STATUS_FARBE: Record<string, string> = {
  entwurf: 'bg-muted text-foreground/70 ring-1 ring-border',
  versendet: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200',
  angenommen: 'bg-green-100 text-green-900 ring-1 ring-green-200',
  abgelehnt: 'bg-rose-100 text-rose-900 ring-1 ring-rose-200',
};

function formatEuro(n: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(n);
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'gerade eben';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
  return new Date(date).toLocaleDateString('de-DE');
}

export default async function AngeboteListe() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('angebote')
    .select(
      `id, titel, status, summe_netto, summe_brutto, angebotsnummer,
       versendet_am, gueltig_bis, updated_at, anfrage_id,
       empfaenger_name, empfaenger_email, empfaenger_firma,
       anfragen (von_name, von_email, betreff)`
    )
    .order('updated_at', { ascending: false })
    .limit(200);

  const rows = (data as unknown as AngebotRow[]) || [];

  return (
    <div className="container mx-auto py-6 sm:py-8 px-4 sm:px-6 max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-wide mb-1">
            Angebote
          </h1>
          <p className="text-muted-foreground text-sm">
            Aus Anfragen automatisch erstellte Entwürfe – oder frei aus dem
            Stand. Jeden Preis setzt du selbst.
          </p>
        </div>
        <NeuesAngebotButton />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={File02Icon}
          tone="default"
          title="Noch keine Angebote"
          description={'Klick oben rechts auf „Neues Angebot" für ein leeres Angebot – oder öffne eine Anfrage und nutz „Angebot erstellen" für einen KI-Vorschlag.'}
        />
      ) : (
        <div className="space-y-2">
          {rows.map((a) => {
            const kunde =
              a.empfaenger_name ||
              a.empfaenger_firma ||
              a.empfaenger_email ||
              a.anfragen?.von_name ||
              a.anfragen?.von_email ||
              '(noch kein Empfänger)';
            return (
              <Link
                key={a.id}
                href={`/dashboard/angebote/${a.id}`}
                className="block"
              >
                <Card className="p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {a.titel || '(ohne Titel)'}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                        <span className="truncate">{kunde}</span>
                        {a.angebotsnummer && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-xs">
                              {a.angebotsnummer}
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span className="flex-shrink-0">
                          {timeAgo(a.updated_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_FARBE[a.status] ?? STATUS_FARBE.entwurf}`}
                      >
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                      <span className="text-sm font-medium">
                        {formatEuro(Number(a.summe_brutto))}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
