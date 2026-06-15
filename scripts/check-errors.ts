/**
 * Bug-Hunt: processing_errors-Tabelle durchforsten.
 * Wo gehen Sachen still kaputt die wir noch nicht kennen?
 *
 * Lauf: npx tsx --env-file=.env.local scripts/check-errors.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type ErrorRow = {
  id: string;
  betrieb_id: string | null;
  anfrage_id: string | null;
  schritt: string;
  fehler_text: string;
  fehler_details: unknown;
  created_at?: string;
  erstellt_am?: string;
};

async function main() {
  const supabase = createClient(url, key);

  // Erst Schema-Sniff: welche Timestamp-Spalte gibt's wirklich?
  const probeCreated = await supabase
    .from('processing_errors')
    .select('id, created_at')
    .limit(1);
  const useCreated = !probeCreated.error;
  const timestampCol = useCreated ? 'created_at' : 'erstellt_am';
  console.log(`Timestamp-Spalte: ${timestampCol}\n`);

  const { data, error } = await supabase
    .from('processing_errors')
    .select(`id, betrieb_id, anfrage_id, schritt, fehler_text, fehler_details, ${timestampCol}`)
    .order(timestampCol, { ascending: false })
    .limit(500);

  if (error) {
    console.error('Query-Fehler:', error.message);
    process.exit(1);
  }

  const all = (data ?? []) as ErrorRow[];
  const getTs = (e: ErrorRow): string =>
    (useCreated ? e.created_at : e.erstellt_am) ?? '';

  console.log(`=== Processing-Errors gesamt (max 500) ===`);
  console.log(`Total: ${all.length}\n`);

  const proSchritt = new Map<string, ErrorRow[]>();
  for (const e of all) {
    const arr = proSchritt.get(e.schritt) ?? [];
    arr.push(e);
    proSchritt.set(e.schritt, arr);
  }

  console.log(`=== Pro Schritt (sortiert nach Häufigkeit) ===`);
  const sorted = [...proSchritt.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [schritt, rows] of sorted) {
    console.log(`\n  [${rows.length}x] ${schritt}`);
    const texte = new Map<string, number>();
    for (const r of rows) {
      const key = r.fehler_text.slice(0, 100);
      texte.set(key, (texte.get(key) ?? 0) + 1);
    }
    const topTexte = [...texte.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    for (const [text, count] of topTexte) {
      console.log(`    ${count}x: ${text}${text.length === 100 ? '…' : ''}`);
    }
  }

  const tag = 24 * 60 * 60 * 1000;
  const letzte24h = all.filter((e) => Date.now() - new Date(getTs(e)).getTime() < tag);
  console.log(`\n=== Letzte 24h ===`);
  console.log(`${letzte24h.length} Fehler\n`);
  for (const e of letzte24h.slice(0, 10)) {
    console.log(`  [${getTs(e).slice(0, 19)}] ${e.schritt}`);
    console.log(`    → ${e.fehler_text.slice(0, 150)}`);
  }

  if (all.length > 0) {
    console.log(`\nZeitraum: ${getTs(all.at(-1)!)} … ${getTs(all[0])}`);
  }
}

main();
