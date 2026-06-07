/**
 * Quick-Check: wie viele Edit-Daten haben wir in der DB?
 * Lauf: pnpm tsx scripts/check-edits.ts
 *
 * Zweck: vor Ton Phase 2 (Auto-Stilbeispiele) prüfen ob genug Daten
 * da sind. Trigger laut STRATEGIE: 30+ Real-Edits.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local');
  process.exit(1);
}

async function main() {
  const supabase = createClient(url!, key!);

  const { data, error } = await supabase
    .from('entwuerfe')
    .select('id, betrieb_id, was_edited, text_original, body_text, versendet_am')
    .not('versendet_am', 'is', null)
    .order('versendet_am', { ascending: true })
    .limit(500);

  if (error) {
    console.error('Query-Fehler:', error.message);
    process.exit(1);
  }

  const all = data ?? [];
  const total = all.length;
  const edited = all.filter((e) => e.was_edited).length;
  const withOriginal = all.filter((e) => e.was_edited && e.text_original).length;

  const perBetrieb = new Map<string, { total: number; edited: number }>();
  for (const e of all) {
    const slot = perBetrieb.get(e.betrieb_id) ?? { total: 0, edited: 0 };
    slot.total++;
    if (e.was_edited) slot.edited++;
    perBetrieb.set(e.betrieb_id, slot);
  }

  console.log(`\n=== Edit-Stand (versendete Entwürfe) ===`);
  console.log(`Total versendet:       ${total}`);
  console.log(`davon was_edited:      ${edited}  (${total > 0 ? Math.round((edited / total) * 100) : 0}%)`);
  console.log(`mit text_original:     ${withOriginal}`);
  console.log(`Zeitraum:              ${all[0]?.versendet_am ?? '?'} … ${all.at(-1)?.versendet_am ?? '?'}`);
  const nachTracking = all.filter((e) => (e.versendet_am ?? '') >= '2026-06-02');
  const nachTrackingEdited = nachTracking.filter((e) => e.was_edited).length;
  console.log(`Nach 2.6. (Tracking-Start): ${nachTracking.length} versendet, ${nachTrackingEdited} editiert`);
  console.log(`\nPer Betrieb:`);
  for (const [bid, slot] of perBetrieb) {
    console.log(`  ${bid.slice(0, 8)}…  versendet=${slot.total}  editiert=${slot.edited}`);
  }
  console.log(`\nTon-Phase-2-Trigger: 30+ Real-Edits  →  Status: ${edited >= 30 ? 'ERREICHT ✓' : `${edited}/30, noch ${30 - edited} fehlen`}`);
}

main();
