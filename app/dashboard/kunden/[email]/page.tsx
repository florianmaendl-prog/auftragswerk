import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type AnalyseRow = {
  kategorie: string | null;
  zusammenfassung: string | null;
  gewerk_match: string | null;
  extrahierter_name: string | null;
  extrahierte_firma: string | null;
  extrahierte_telefon: string | null;
  kunde_typ: string | null;
};

type AnfrageRow = {
  id: string;
  betreff: string | null;
  von_name: string | null;
  status: string;
  created_at: string;
  analysen: AnalyseRow[] | null;
};

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

function gewerkBadge(gewerk: string | null) {
  if (!gewerk) return null;
  const color =
    gewerk === 'passt'
      ? 'bg-green-100 text-green-800 border-green-200'
      : gewerk === 'passt_nicht'
      ? 'bg-red-100 text-red-800 border-red-200'
      : 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        color
      )}
    >
      {gewerk}
    </span>
  );
}

export default async function KundeDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email: emailParam } = await params;
  const email = decodeURIComponent(emailParam);

  const supabase = await createClient();
  const { data } = await supabase
    .from('anfragen')
    .select(
      `id, betreff, von_name, status, created_at,
       analysen (kategorie, zusammenfassung, gewerk_match, extrahierter_name, extrahierte_firma, extrahierte_telefon, kunde_typ)`
    )
    .eq('von_email', email)
    .is('geloescht_am', null)
    .order('created_at', { ascending: false });

  const alleRows = (data as AnfrageRow[]) || [];

  // Nur Anfragen mit Kundenanfrage-Klassifikation zeigen – Werbe-/Rechnungs-
  // Mails desselben Absenders gehören nicht in seine Kundenhistorie.
  const rows = alleRows.filter((a) =>
    (a.analysen || []).some((an) => an.kategorie === 'kundenanfrage')
  );

  if (rows.length === 0) {
    notFound();
  }

  // Header-Infos aus der jüngsten Kundenanfrage-Analyse
  const latestKundenAnalyse = rows[0]?.analysen?.find(
    (an) => an.kategorie === 'kundenanfrage'
  );
  const displayName = latestKundenAnalyse?.extrahierter_name || rows[0]?.von_name || email;
  const firma = latestKundenAnalyse?.extrahierte_firma;
  const telefon = latestKundenAnalyse?.extrahierte_telefon;
  const kundeTyp = latestKundenAnalyse?.kunde_typ;

  return (
    <div className="container mx-auto py-6 px-6 max-w-5xl">
      <Link
        href="/dashboard/kunden"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
      >
        ← Zur Kunden-Liste
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {firma && <span>{firma} · </span>}
          <span>{email}</span>
          {telefon && <span> · {telefon}</span>}
        </p>
        <div className="flex items-center gap-2 mt-2">
          {kundeTyp && (
            <span className="text-xs rounded-full border px-2 py-0.5 bg-muted text-muted-foreground">
              {kundeTyp}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? 'Anfrage' : 'Anfragen'} insgesamt
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((a) => {
          const analyse = a.analysen?.[0];
          return (
            <Link key={a.id} href={`/dashboard/anfragen/${a.id}`} className="block">
              <Card className="hover:bg-accent/40 transition-colors">
                <CardContent className="py-4 space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium truncate flex-1 min-w-0">
                      {a.betreff || '(kein Betreff)'}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {gewerkBadge(analyse?.gewerk_match || null)}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(a.created_at)}
                      </span>
                    </div>
                  </div>
                  {analyse?.zusammenfassung && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {analyse.zusammenfassung}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Status: <span className="font-medium">{a.status}</span>
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
