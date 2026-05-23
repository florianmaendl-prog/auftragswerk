import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { Card, CardContent } from '@/components/ui/card';

type AnalyseRow = {
  kategorie: string | null;
  extrahierter_name: string | null;
  extrahierte_firma: string | null;
  gewerk_match: string | null;
  kunde_typ: string | null;
};

type AnfrageRow = {
  id: string;
  von_email: string;
  von_name: string | null;
  created_at: string;
  status: string;
  analysen: AnalyseRow[] | null;
};

type KundeAggregat = {
  email: string;
  name: string | null;
  firma: string | null;
  anzahl: number;
  letzter_kontakt: string;
  kunde_typ: string | null;
  gewerk_match: string | null;
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

export default async function KundenPage() {
  const supabase = await createClient();

  // Alle Anfragen + ihre Analysen holen. RLS filtert auf den eigenen Betrieb.
  // Aggregation in JS (für eine Pilot-Größe < 10k Anfragen unproblematisch).
  const { data } = await supabase
    .from('anfragen')
    .select(
      `id, von_email, von_name, created_at, status,
       analysen (kategorie, extrahierter_name, extrahierte_firma, gewerk_match, kunde_typ)`
    )
    .is('geloescht_am', null)
    .order('created_at', { ascending: false })
    .limit(2000);

  const rows = (data as AnfrageRow[]) || [];

  // Aggregieren – Email = Schlüssel. NUR Kundenanfragen zählen:
  // Werbung/Rechnung/Innung-Mails desselben Absenders fließen weder
  // in die Anzahl noch in die Stammdaten (Name/Firma) ein.
  const kundenMap = new Map<string, KundeAggregat>();
  for (const a of rows) {
    const kundenAnalyse = (a.analysen || []).find(
      (an) => an.kategorie === 'kundenanfrage'
    );
    if (!kundenAnalyse) continue; // Sender hatte zu dieser Anfrage keine Kundenanfrage-Klassifikation

    const existing = kundenMap.get(a.von_email);
    if (existing) {
      existing.anzahl++;
    } else {
      kundenMap.set(a.von_email, {
        email: a.von_email,
        name: kundenAnalyse.extrahierter_name || a.von_name,
        firma: kundenAnalyse.extrahierte_firma || null,
        anzahl: 1,
        letzter_kontakt: a.created_at,
        kunde_typ: kundenAnalyse.kunde_typ || null,
        gewerk_match: kundenAnalyse.gewerk_match || null,
      });
    }
  }

  const kunden = Array.from(kundenMap.values()).sort((a, b) =>
    b.letzter_kontakt.localeCompare(a.letzter_kontakt)
  );

  return (
    <div className="container mx-auto py-8 px-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Kunden</h1>
        <p className="text-muted-foreground text-sm">
          {kunden.length} {kunden.length === 1 ? 'Kunde' : 'Kunden'} insgesamt
        </p>
      </div>

      {kunden.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Noch keine Kunden – sobald Anfragen eingehen, erscheinen die Absender hier.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {kunden.map((k) => (
            <Link
              key={k.email}
              href={`/dashboard/kunden/${encodeURIComponent(k.email)}`}
              className="block"
            >
              <Card className="hover:bg-accent/40 transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{k.name || k.email}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {k.firma && <span>{k.firma} · </span>}
                        {k.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {k.kunde_typ && (
                        <span className="text-xs rounded-full border px-2 py-0.5 bg-muted text-muted-foreground">
                          {k.kunde_typ}
                        </span>
                      )}
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {k.anzahl} {k.anzahl === 1 ? 'Anfrage' : 'Anfragen'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {timeAgo(k.letzter_kontakt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
