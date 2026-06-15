import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { Card, CardContent } from '@/components/ui/card';
import { KategorieBadge } from '@/components/brand/kategorie-badge';

type AnalyseRow = {
  kategorie: string | null;
  zusammenfassung: string | null;
  gewerk_match: string | null;
  extrahierter_name: string | null;
  extrahierte_firma: string | null;
  extrahierte_telefon: string | null;
  extrahierte_adresse: string | null;
  extrahierte_plz: string | null;
  extrahierte_position: string | null;
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
       analysen (kategorie, zusammenfassung, gewerk_match, extrahierter_name, extrahierte_firma, extrahierte_telefon, extrahierte_adresse, extrahierte_plz, extrahierte_position, kunde_typ)`
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

  // Kontaktdaten "best-of" sammeln: pro Feld den jüngsten nicht-leeren Wert
  // aus allen Kundenanfrage-Analysen. Sonst würde eine jüngere Mail ohne
  // Signatur ältere, vollständigere Daten überschreiben.
  const kundenAnalysen = rows
    .flatMap((a) => a.analysen ?? [])
    .filter((an) => an.kategorie === 'kundenanfrage');
  const erstesNichtLeer = <K extends keyof AnalyseRow>(feld: K) =>
    kundenAnalysen.find((an) => an[feld] && String(an[feld]).trim().length > 0)?.[feld] ?? null;

  const displayName =
    (erstesNichtLeer('extrahierter_name') as string | null) ||
    rows[0]?.von_name ||
    email;
  const firma = erstesNichtLeer('extrahierte_firma') as string | null;
  const telefon = erstesNichtLeer('extrahierte_telefon') as string | null;
  const adresse = erstesNichtLeer('extrahierte_adresse') as string | null;
  const plz = erstesNichtLeer('extrahierte_plz') as string | null;
  const position = erstesNichtLeer('extrahierte_position') as string | null;
  const kundeTyp = erstesNichtLeer('kunde_typ') as string | null;

  const adresseFull = [adresse, plz].filter(Boolean).join(', ');
  const mapsHref = adresseFull
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresseFull)}`
    : null;

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 max-w-5xl">
      <Link
        href="/dashboard/kunden"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
      >
        ← Zur Kunden-Liste
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
        {(firma || position) && (
          <p className="text-sm text-muted-foreground mt-1">
            {position && <span>{position}</span>}
            {position && firma && <span> bei </span>}
            {firma && <span>{firma}</span>}
          </p>
        )}
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

      {/* Kontaktdaten-Block – klickbar damit Owner direkt anrufen / Maps öffnen kann.
          Alle Felder kommen aus der KI-Extraktion (jüngster nicht-leerer Wert pro
          Feld). Mailto immer da (=Absender), Rest nur wenn vorhanden. */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KontaktZeile label="E-Mail" value={email} href={`mailto:${email}`} />
        {telefon && (
          <KontaktZeile
            label="Telefon"
            value={telefon}
            href={`tel:${telefon.replace(/\s+/g, '')}`}
          />
        )}
        {adresseFull && mapsHref && (
          <KontaktZeile
            label="Adresse"
            value={adresseFull}
            href={mapsHref}
            externalHint="In Maps öffnen"
          />
        )}
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
                      <KategorieBadge
                        kategorie={analyse?.kategorie as Parameters<typeof KategorieBadge>[0]['kategorie']}
                        gewerkMatch={analyse?.gewerk_match as Parameters<typeof KategorieBadge>[0]['gewerkMatch']}
                      />
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

function KontaktZeile({
  label,
  value,
  href,
  externalHint,
}: {
  label: string;
  value: string;
  href: string;
  externalHint?: string;
}) {
  const istExtern = href.startsWith('http');
  return (
    <a
      href={href}
      target={istExtern ? '_blank' : undefined}
      rel={istExtern ? 'noopener noreferrer' : undefined}
      className="flex flex-col gap-0.5 rounded-md border border-input bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted/40 hover:border-foreground/20"
    >
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <span className="text-foreground break-all">{value}</span>
      {externalHint && (
        <span className="text-[11px] text-muted-foreground">{externalHint} →</span>
      )}
    </a>
  );
}
