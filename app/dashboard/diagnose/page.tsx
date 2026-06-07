import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/brand/empty-state';
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';

type ProcessingError = {
  id: string;
  erstellt_am: string;
  schritt: string;
  fehler_text: string;
  anfrage_id: string | null;
  fehler_details: unknown;
};

type EntwurfEdit = {
  id: string;
  anfrage_id: string;
  betreff_vorschlag: string;
  text_original: string | null;
  body_text: string;
  was_edited: boolean;
  versendet_am: string | null;
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

function schrittBadge(schritt: string) {
  // Farbcode in 3 semantischen Gruppen statt Zufallsfarben:
  //   KI-Schritte (klassifikation/entwurf/ki) → amber (warn, "KI-Issue")
  //   Versand-Schritte → destructive-tint (rot, "Kunden-relevant")
  //   Rest (mail/nachricht/attachment/storage) → muted (neutral)
  const color = /klassifikation|entwurf|ki_/.test(schritt)
    ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
    : /versand/.test(schritt)
    ? 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'
    : 'bg-secondary text-foreground/70 ring-1 ring-border';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono ${color}`}
    >
      {schritt}
    </span>
  );
}

export default async function DiagnosePage() {
  const supabase = await createClient();

  // Per-Betrieb filtern – processing_errors hat (vermutlich) keine RLS,
  // also explizit auf die eigene betrieb_id einschränken via profile.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('betrieb_id')
    .eq('id', user?.id || '')
    .single();

  const betriebId = profile?.betrieb_id as string | null | undefined;

  let errors: ProcessingError[] = [];
  let entwurfsEdits: EntwurfEdit[] = [];
  if (betriebId) {
    const [{ data: errorRows }, { data: editRows }] = await Promise.all([
      supabase
        .from('processing_errors')
        .select('id, erstellt_am, schritt, fehler_text, anfrage_id, fehler_details')
        .eq('betrieb_id', betriebId)
        .order('erstellt_am', { ascending: false })
        .limit(200),
      // Edit-Diff-View: alle versendeten Entwürfe mit text_original holen,
      // damit wir was_edited-Rate + die letzten Edits anzeigen können.
      supabase
        .from('entwuerfe')
        .select(
          'id, anfrage_id, betreff_vorschlag, text_original, body_text, was_edited, versendet_am'
        )
        .eq('betrieb_id', betriebId)
        .not('versendet_am', 'is', null)
        .order('versendet_am', { ascending: false })
        .limit(100),
    ]);
    errors = (errorRows as ProcessingError[]) || [];
    entwurfsEdits = (editRows as EntwurfEdit[]) || [];
  }

  // Edit-Statistiken berechnen
  const totalVersendet = entwurfsEdits.length;
  const totalEditiert = entwurfsEdits.filter((e) => e.was_edited).length;
  const editRate =
    totalVersendet > 0 ? Math.round((totalEditiert / totalVersendet) * 100) : 0;
  const letzteEdits = entwurfsEdits
    .filter((e) => e.was_edited && e.text_original)
    .slice(0, 10);

  const now = Date.now();
  const recent = errors.filter(
    (e) => now - new Date(e.erstellt_am).getTime() < 24 * 3600 * 1000
  );

  return (
    <div className="container mx-auto py-6 sm:py-8 px-4 sm:px-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-wide mb-1">
          Diagnose
        </h1>
        <p className="text-muted-foreground text-sm">
          {errors.length} {errors.length === 1 ? 'Fehler' : 'Fehler'} gespeichert
          {' · '}
          <span className={recent.length > 0 ? 'text-destructive font-medium' : ''}>
            {recent.length} in den letzten 24h
          </span>
        </p>
      </div>

      {/* Edit-Diff-Statistiken: zeigt wie oft Owner KI-Entwürfe editiert. Pattern-
          Erkennung-Foundation für künftiges Stilbeispiel-Tuning. */}
      {totalVersendet > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">KI-Entwurfs-Qualität</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {totalVersendet}
                </p>
                <p className="text-xs text-muted-foreground">Entwürfe versendet</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {totalEditiert}
                </p>
                <p className="text-xs text-muted-foreground">davon editiert</p>
              </div>
              <div>
                <p
                  className={`text-2xl font-bold ${
                    editRate < 30
                      ? 'text-green-700'
                      : editRate < 60
                      ? 'text-amber-700'
                      : 'text-rose-700'
                  }`}
                >
                  {editRate}%
                </p>
                <p className="text-xs text-muted-foreground">Edit-Rate</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {editRate < 30
                ? '✓ Niedrige Edit-Rate – die KI trifft deinen Ton gut. Weiter so.'
                : editRate < 60
                ? 'Mittlere Edit-Rate – wenn bestimmte Phrasen oft geändert werden, lohnt es sich die ins Profil unter „Stilbeispiele" oder „Was die KI vermeiden soll" zu übernehmen.'
                : 'Hohe Edit-Rate – die KI trifft den Ton noch nicht richtig. Schau in „Stilbeispiele" + „Was die KI vermeiden soll" im Profil. Je mehr du pflegst, desto besser werden die Entwürfe.'}
            </p>

            {letzteEdits.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-1">
                  Letzte {letzteEdits.length} editierte Entwürfe ansehen (Original vs. Final)
                </summary>
                <div className="mt-3 space-y-3">
                  {letzteEdits.map((e) => (
                    <div key={e.id} className="rounded-md border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Link
                          href={`/dashboard/anfragen/${e.anfrage_id}`}
                          className="text-xs font-medium text-foreground hover:underline truncate"
                        >
                          {e.betreff_vorschlag}
                        </Link>
                        <span className="text-[11px] text-muted-foreground flex-shrink-0">
                          {e.versendet_am
                            ? formatDateTime(e.versendet_am)
                            : '—'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                            KI-Original
                          </p>
                          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground/85 bg-background border rounded p-2 max-h-48 overflow-auto">
                            {e.text_original}
                          </pre>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                            Final versendet
                          </p>
                          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground/85 bg-background border rounded p-2 max-h-48 overflow-auto">
                            {e.body_text}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {errors.length === 0 ? (
        <EmptyState
          icon={CheckmarkCircle02Icon}
          tone="success"
          title="Alles läuft sauber"
          description="Keine Verarbeitungs-Fehler gespeichert. Sobald hier etwas auftaucht, kannst du nachsehen, was schiefgegangen ist."
        />
      ) : (
        <div className="space-y-2">
          {errors.map((e) => (
            <Card key={e.id}>
              <CardContent className="py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  {schrittBadge(e.schritt)}
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(e.erstellt_am)}
                  </span>
                </div>
                <p className="text-sm text-destructive break-words">
                  {e.fehler_text}
                </p>
                <div className="flex items-center gap-3 text-xs">
                  {e.anfrage_id && (
                    <Link
                      href={`/dashboard/anfragen/${e.anfrage_id}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      → Zur Anfrage
                    </Link>
                  )}
                  {e.fehler_details ? (
                    <details>
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Details
                      </summary>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(e.fehler_details, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
