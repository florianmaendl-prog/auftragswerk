/**
 * Custom-Tags-Helper (Welle P3).
 *
 * Tag-Regeln sind Sender-Pattern → Tag-Auto-Set. Wenn ein Pattern als
 * Substring in der Absender-Email vorkommt (case-insensitive), wird der
 * zugeordnete Tag automatisch nach der Klassifikation gesetzt.
 *
 * Beispiel-Regel: pattern "obi.de" → tag "Lieferanten"
 *   Mail von info@obi.de  → bekommt Tag "Lieferanten"
 *   Mail von max@obi.de   → bekommt Tag "Lieferanten"
 *   Mail von max@obi.com  → bekommt NICHT (anderes TLD)
 */

import { supabaseAdmin } from './supabase';

/**
 * Lädt alle Tag-Regeln für den Betrieb und liefert die Tags zurück die
 * für diesen Sender gelten. Dedupliziert + sortiert für stabiles Insert-
 * Verhalten.
 */
export async function getTagsForSender(
  betriebId: string,
  vonEmail: string
): Promise<string[]> {
  const { data: regeln, error } = await supabaseAdmin
    .from('tag_regeln')
    .select('sender_pattern, tag')
    .eq('betrieb_id', betriebId);

  if (error || !regeln) {
    if (error) {
      console.warn(`tag_regeln Query fehlgeschlagen: ${error.message}`);
    }
    return [];
  }

  const senderLower = vonEmail.toLowerCase();
  const matched = new Set<string>();
  for (const r of regeln) {
    const pattern = (r.sender_pattern ?? '').trim().toLowerCase();
    if (pattern.length === 0) continue;
    if (senderLower.includes(pattern)) {
      matched.add(r.tag);
    }
  }
  return [...matched].sort();
}
