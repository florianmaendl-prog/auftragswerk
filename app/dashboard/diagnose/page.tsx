import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { Card, CardContent } from '@/components/ui/card';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';

type ProcessingError = {
  id: string;
  erstellt_am: string;
  schritt: string;
  fehler_text: string;
  anfrage_id: string | null;
  fehler_details: unknown;
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
  // Farbcode nach Schritt – grob nach "wer war's"
  const color = schritt.includes('klassifikation')
    ? 'bg-amber-100 text-amber-800 border-amber-200'
    : schritt.includes('entwurf')
    ? 'bg-blue-100 text-blue-800 border-blue-200'
    : schritt.includes('versand')
    ? 'bg-purple-100 text-purple-800 border-purple-200'
    : schritt.includes('attachment')
    ? 'bg-cyan-100 text-cyan-800 border-cyan-200'
    : schritt.includes('mail') || schritt.includes('nachricht')
    ? 'bg-slate-100 text-slate-800 border-slate-200'
    : 'bg-gray-100 text-gray-800 border-gray-200';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-mono ${color}`}
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
  if (betriebId) {
    const { data } = await supabase
      .from('processing_errors')
      .select('id, erstellt_am, schritt, fehler_text, anfrage_id, fehler_details')
      .eq('betrieb_id', betriebId)
      .order('erstellt_am', { ascending: false })
      .limit(200);
    errors = (data as ProcessingError[]) || [];
  }

  const now = Date.now();
  const recent = errors.filter(
    (e) => now - new Date(e.erstellt_am).getTime() < 24 * 3600 * 1000
  );

  return (
    <div className="container mx-auto py-8 px-6 max-w-5xl">
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

      {errors.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="rounded-full bg-green-100 p-4">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={28}
                strokeWidth={1.5}
                className="text-green-700"
              />
            </div>
            <p className="text-sm font-medium text-foreground">Alles läuft sauber</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Keine Verarbeitungs-Fehler gespeichert. Sobald hier etwas auftaucht,
              kannst du nachsehen, was schiefgegangen ist.
            </p>
          </CardContent>
        </Card>
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
