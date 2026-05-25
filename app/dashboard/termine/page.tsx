import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { Card, CardContent } from '@/components/ui/card';

type TerminRow = {
  id: string;
  datum: string;
  dauer_min: number;
  ort: string | null;
  notiz: string | null;
  status: 'vorgeschlagen' | 'bestaetigt' | 'absolviert' | 'abgesagt';
  anfrage_id: string;
  // Supabase typt nested foreign-key-Selects als Array, auch wenn's
  // logisch nur eine Zeile gibt. Wir nehmen unten anfragen[0].
  anfragen: Array<{
    betreff: string | null;
    von_name: string | null;
    von_email: string;
  }> | null;
};

import { formatBerlinDatetime } from '@/lib/datetime';

function formatTermin(datum: string): string {
  // Display IMMER in Europe/Berlin
  return formatBerlinDatetime(datum, "EEEEEE, dd.MM.yyyy, HH:mm 'Uhr'");
}

function statusBadge(status: string) {
  const conf =
    status === 'bestaetigt'
      ? { color: 'bg-green-100 text-green-800 border-green-200', label: 'bestätigt' }
      : status === 'vorgeschlagen'
      ? { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'vorgeschlagen' }
      : status === 'absolviert'
      ? { color: 'bg-slate-100 text-slate-700 border-slate-200', label: 'absolviert' }
      : { color: 'bg-red-100 text-red-800 border-red-200', label: status };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${conf.color}`}
    >
      {conf.label}
    </span>
  );
}

function TerminItem({ t }: { t: TerminRow }) {
  const anfrage = Array.isArray(t.anfragen) ? t.anfragen[0] : null;
  return (
    <Link href={`/dashboard/anfragen/${t.anfrage_id}`} className="block">
      <Card className="hover:bg-accent/40 transition-colors">
        <CardContent className="py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{formatTermin(t.datum)}</p>
              <p className="text-xs text-muted-foreground truncate">
                {anfrage?.betreff || '(kein Betreff)'} –{' '}
                {anfrage?.von_name || anfrage?.von_email}
              </p>
              {t.ort && (
                <p className="text-xs text-muted-foreground mt-0.5">📍 {t.ort}</p>
              )}
            </div>
            <div className="flex-shrink-0">{statusBadge(t.status)}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function TerminePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('termine')
    .select(
      `id, datum, dauer_min, ort, notiz, status, anfrage_id,
       anfragen (betreff, von_name, von_email)`
    )
    .neq('status', 'abgesagt')
    .order('datum', { ascending: true })
    .limit(500);

  const termine = (data as TerminRow[]) || [];
  const now = Date.now();
  const kommende = termine.filter((t) => new Date(t.datum).getTime() >= now);
  const vergangen = termine
    .filter((t) => new Date(t.datum).getTime() < now)
    .reverse(); // neueste vergangene zuerst

  return (
    <div className="container mx-auto py-8 px-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Termine</h1>
        <p className="text-muted-foreground text-sm">
          {kommende.length} kommende · {vergangen.length} vergangene
          {' '}(abgesagte ausgeblendet)
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">
          Kommende ({kommende.length})
        </h2>
        {kommende.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Keine kommenden Termine.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {kommende.map((t) => (
              <TerminItem key={t.id} t={t} />
            ))}
          </div>
        )}
      </section>

      {vergangen.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">
            Vergangene ({vergangen.length})
          </h2>
          <div className="space-y-2">
            {vergangen.map((t) => (
              <TerminItem key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
