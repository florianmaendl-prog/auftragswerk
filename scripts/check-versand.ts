/**
 * Quick-Check: Versand-Pfade seit Pilot-Live (4.6.) — nachrichten-Tabelle
 * statt entwuerfe, weil manuell-Versand keinen Entwurf updatet.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from('nachrichten')
    .select('id, anfrage_id, typ, von_email, an_email, versendet_am, betreff')
    .eq('typ', 'ausgang')
    .gte('versendet_am', '2026-06-04T00:00:00Z')
    .order('versendet_am', { ascending: true });

  if (error) {
    console.error('Query-Fehler:', error.message);
    process.exit(1);
  }

  const all = data ?? [];
  console.log(`\n=== Ausgehende Nachrichten seit 4.6. (Pilot-Live) ===`);
  console.log(`Total Ausgänge:  ${all.length}\n`);
  for (const n of all) {
    console.log(`  ${n.versendet_am}  ${n.von_email} → ${n.an_email}`);
    console.log(`    ↳ ${n.betreff?.slice(0, 70)}`);
  }

  const { data: anfragenAll, error: anfragenErr } = await supabase
    .from('anfragen')
    .select('id, created_at, status, von_email, betreff')
    .gte('created_at', '2026-06-04T00:00:00Z')
    .order('created_at', { ascending: false });

  if (anfragenErr) {
    console.error('Anfragen-Fehler:', anfragenErr.message);
  } else {
    console.log(`\n=== Eingehende Anfragen seit 4.6. ===`);
    console.log(`Total:  ${anfragenAll?.length ?? 0}`);
    const byStatus = new Map<string, number>();
    for (const a of anfragenAll ?? []) {
      byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1);
    }
    for (const [st, n] of byStatus) console.log(`  ${st}: ${n}`);
  }
}

main();
