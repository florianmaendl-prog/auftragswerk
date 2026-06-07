/**
 * Kunden-Historie für den KI-Entwurfs-Prompt (Sprint 5, Tag 19).
 *
 * Wenn der Absender schon einmal angefragt hat, lädt diese Funktion die
 * letzten N Kundenanfragen desselben Senders (aktuelle ausgeschlossen)
 * mit kurzer KI-Zusammenfassung. Der Entwurf-Prompt nutzt das um
 * persönlicher zu formulieren – Stammkunden-Premium-Moment.
 *
 * Bewusst minimal:
 * - Nur kategorie='kundenanfrage' (Werbung/Rechnung desselben Absenders
 *   raus, gleiche Logik wie /dashboard/kunden)
 * - Max 5 vergangene Anfragen (mehr verwässert nur den Prompt)
 * - Nur Felder die im Prompt sinnvoll sind: Datum, Zusammenfassung,
 *   gewerk_match
 * - Aktuelle Anfrage immer ausschließen (sonst sieht KI sich selbst)
 */

import { supabaseAdmin } from './supabase';

export type KundenHistorieEintrag = {
  datum: string; // YYYY-MM-DD
  zusammenfassung: string;
  gewerk_match: 'passt' | 'unklar' | 'passt_nicht' | null;
};

const MAX_HISTORIE = 5;

export async function ladeKundenHistorie(
  betriebId: string,
  vonEmail: string,
  aktuelleAnfrageId: string
): Promise<KundenHistorieEintrag[]> {
  if (!vonEmail) return [];

  const { data, error } = await supabaseAdmin
    .from('anfragen')
    .select(
      `id, created_at,
       analysen!inner (kategorie, gewerk_match, zusammenfassung)`
    )
    .eq('betrieb_id', betriebId)
    .eq('von_email', vonEmail)
    .neq('id', aktuelleAnfrageId)
    .is('geloescht_am', null)
    .eq('analysen.kategorie', 'kundenanfrage')
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORIE);

  if (error) {
    console.warn('Kunden-Historie Query fehlgeschlagen:', error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const historie: KundenHistorieEintrag[] = [];
  for (const row of data) {
    const analysen = Array.isArray(row.analysen) ? row.analysen : [];
    const ana = analysen[0] as
      | {
          gewerk_match: 'passt' | 'unklar' | 'passt_nicht' | null;
          zusammenfassung: string | null;
        }
      | undefined;
    if (!ana?.zusammenfassung) continue;

    historie.push({
      datum: (row.created_at as string).slice(0, 10),
      zusammenfassung: ana.zusammenfassung,
      gewerk_match: ana.gewerk_match ?? null,
    });
  }

  return historie;
}
