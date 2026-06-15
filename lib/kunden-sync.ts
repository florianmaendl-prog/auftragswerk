/**
 * Mini-CRM-Sync (Welle P5).
 *
 * Nach Inbound + Klassifikation einer Kundenanfrage:
 *   1. Kunde in der kunden-Tabelle anlegen oder vorhandene Felder ergänzen
 *      (Owner-Edits gewinnen – wir überschreiben Vorhandenes nie).
 *   2. Anhänge der Anfrage in kunden_dateien verlinken (kein Re-Upload,
 *      storage_path aus anhaenge-Tabelle zeigt direkt zum anhaenge-Bucket).
 *
 * Fail-safe: bei Fehler nur loggen, NICHT die Inbound-Pipeline blocken.
 */

import { supabaseAdmin } from './supabase';

type AnalyseFelder = {
  extrahierter_name?: string | null;
  extrahierte_firma?: string | null;
  extrahierte_position?: string | null;
  extrahierte_telefon?: string | null;
  extrahierte_adresse?: string | null;
  extrahierte_plz?: string | null;
  kunde_typ?: string | null;
};

/**
 * Legt den Kunden an oder ergänzt fehlende Felder. Returnt die kunde_id.
 * Owner-Edits (manuelle Änderungen in der Kunden-Detail-Page) gewinnen –
 * wir überschreiben nur Felder die in der DB NULL/leer sind.
 */
export async function syncKundeFromAnalyse(opts: {
  betriebId: string;
  vonEmail: string;
  vonName?: string | null;
  analyse: AnalyseFelder;
}): Promise<string | null> {
  const email = opts.vonEmail.trim().toLowerCase();
  if (!email) return null;

  const { data: existing } = await supabaseAdmin
    .from('kunden')
    .select('id, name, firma, position, telefon, adresse, plz, kunde_typ')
    .eq('betrieb_id', opts.betriebId)
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    // Ergänze nur leere Felder
    const patch: Record<string, string> = {};
    const cand: Record<string, string | null | undefined> = {
      name: opts.analyse.extrahierter_name ?? opts.vonName ?? null,
      firma: opts.analyse.extrahierte_firma ?? null,
      position: opts.analyse.extrahierte_position ?? null,
      telefon: opts.analyse.extrahierte_telefon ?? null,
      adresse: opts.analyse.extrahierte_adresse ?? null,
      plz: opts.analyse.extrahierte_plz ?? null,
      kunde_typ: opts.analyse.kunde_typ ?? null,
    };
    for (const [feld, neu] of Object.entries(cand)) {
      const alt = (existing as Record<string, string | null>)[feld];
      if ((!alt || alt.length === 0) && typeof neu === 'string' && neu.length > 0) {
        patch[feld] = neu;
      }
    }
    if (Object.keys(patch).length > 0) {
      await supabaseAdmin
        .from('kunden')
        .update(patch)
        .eq('id', existing.id);
    }
    return existing.id;
  }

  // Neu anlegen
  const { data: created, error } = await supabaseAdmin
    .from('kunden')
    .insert({
      betrieb_id: opts.betriebId,
      email,
      name: opts.analyse.extrahierter_name ?? opts.vonName ?? null,
      firma: opts.analyse.extrahierte_firma ?? null,
      position: opts.analyse.extrahierte_position ?? null,
      telefon: opts.analyse.extrahierte_telefon ?? null,
      adresse: opts.analyse.extrahierte_adresse ?? null,
      plz: opts.analyse.extrahierte_plz ?? null,
      kunde_typ: opts.analyse.kunde_typ ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.warn(`syncKunde: insert fehlgeschlagen: ${error.message}`);
    return null;
  }
  return created.id;
}

/**
 * Verlinkt alle Anhänge einer Nachricht in die kunden_dateien-Tabelle.
 * Kein Re-Upload – wir zeigen mit storage_bucket='anhaenge' auf die
 * Original-Datei im anhaenge-Bucket.
 *
 * Idempotent: wenn ein Anhang schon verlinkt ist (gleicher storage_path
 * für diesen Kunden) wird er nicht doppelt eingetragen.
 */
export async function verlinkeAnhaengeZuKunde(opts: {
  betriebId: string;
  kundeId: string;
  nachrichtId: string;
  anfrageId: string;
}): Promise<void> {
  const { data: anhaenge } = await supabaseAdmin
    .from('anhaenge')
    .select('id, dateiname, content_type, groesse_bytes, storage_path')
    .eq('nachricht_id', opts.nachrichtId);

  if (!anhaenge || anhaenge.length === 0) return;

  // Schon verlinkte storage_paths skippen (Re-Run-Sicherheit bei Inbound-
  // Retries oder manuellen Re-Klassifikationen).
  const { data: existing } = await supabaseAdmin
    .from('kunden_dateien')
    .select('storage_path')
    .eq('kunde_id', opts.kundeId);
  const existingPaths = new Set(
    (existing ?? []).map((e: { storage_path: string }) => e.storage_path)
  );

  const inserts = anhaenge
    .filter((a) => !existingPaths.has(a.storage_path))
    .map((a) => ({
      kunde_id: opts.kundeId,
      betrieb_id: opts.betriebId,
      dateiname: a.dateiname ?? 'datei',
      content_type: a.content_type,
      groesse_bytes: a.groesse_bytes,
      storage_path: a.storage_path,
      storage_bucket: 'anhaenge',
      quelle: 'inbound_anhang' as const,
      anfrage_id: opts.anfrageId,
    }));

  if (inserts.length === 0) return;

  const { error } = await supabaseAdmin.from('kunden_dateien').insert(inserts);
  if (error) {
    console.warn(`verlinkeAnhaengeZuKunde: insert fehlgeschlagen: ${error.message}`);
  }
}
