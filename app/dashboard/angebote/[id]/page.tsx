import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { AngebotEditor } from './angebot-editor';
import type { AngebotPosition } from '@/lib/angebot';

type AngebotRow = {
  id: string;
  anfrage_id: string | null;
  titel: string | null;
  einleitung: string | null;
  positionen: AngebotPosition[] | null;
  schlusstext: string | null;
  summe_netto: number;
  mwst_satz: number;
  summe_brutto: number;
  status: 'entwurf' | 'versendet' | 'angenommen' | 'abgelehnt';
  angebotsnummer: string | null;
  gueltig_bis: string | null;
  notiz_intern: string | null;
  variante: string;
  empfaenger_name: string | null;
  empfaenger_firma: string | null;
  empfaenger_email: string | null;
  empfaenger_adresse: string | null;
  empfaenger_plz: string | null;
  anfragen: { von_name: string | null; von_email: string; betreff: string | null } | null;
};

export default async function AngebotDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('angebote')
    .select(
      `id, anfrage_id, titel, einleitung, positionen, schlusstext,
       summe_netto, mwst_satz, summe_brutto, status, angebotsnummer,
       gueltig_bis, notiz_intern, variante,
       empfaenger_name, empfaenger_firma, empfaenger_email,
       empfaenger_adresse, empfaenger_plz,
       anfragen (von_name, von_email, betreff)`
    )
    .eq('id', id)
    .single();

  if (!data) notFound();
  const angebot = data as unknown as AngebotRow;

  return (
    <div className="container mx-auto py-6 sm:py-8 px-4 sm:px-6 max-w-4xl">
      <Link
        href="/dashboard/angebote"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
      >
        ← Zur Angebots-Liste
      </Link>

      {angebot.anfrage_id && angebot.anfragen && (
        <p className="text-xs text-muted-foreground mb-4">
          Aus Anfrage von{' '}
          <Link
            href={`/dashboard/anfragen/${angebot.anfrage_id}`}
            className="hover:text-foreground underline-offset-2 hover:underline"
          >
            {angebot.anfragen.von_name || angebot.anfragen.von_email}
            {angebot.anfragen.betreff ? ` – ${angebot.anfragen.betreff}` : ''}
          </Link>
        </p>
      )}

      <AngebotEditor
        id={angebot.id}
        initial={{
          titel: angebot.titel ?? '',
          einleitung: angebot.einleitung ?? '',
          positionen: angebot.positionen ?? [],
          schlusstext: angebot.schlusstext ?? '',
          mwst_satz: Number(angebot.mwst_satz) || 19,
          summe_netto: Number(angebot.summe_netto) || 0,
          summe_brutto: Number(angebot.summe_brutto) || 0,
          status: angebot.status,
          angebotsnummer: angebot.angebotsnummer ?? '',
          gueltig_bis: angebot.gueltig_bis ?? '',
          notiz_intern: angebot.notiz_intern ?? '',
          empfaenger_name: angebot.empfaenger_name ?? '',
          empfaenger_firma: angebot.empfaenger_firma ?? '',
          empfaenger_email: angebot.empfaenger_email ?? '',
          empfaenger_adresse: angebot.empfaenger_adresse ?? '',
          empfaenger_plz: angebot.empfaenger_plz ?? '',
        }}
      />
    </div>
  );
}
