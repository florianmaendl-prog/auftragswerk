/**
 * Quick-Check: die 4 JSON-Parse-Fehler ausgraben und die Roh-Response
 * von Haiku anschauen.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data } = await supabase
    .from('processing_errors')
    .select('id, created_at, anfrage_id, fehler_text, fehler_details')
    .eq('schritt', 'klassifikation')
    .ilike('fehler_text', '%JSON%')
    .order('created_at', { ascending: false });

  for (const e of data ?? []) {
    const details = e.fehler_details as { claude_response?: string } | null;
    const resp = details?.claude_response ?? '<keine response gespeichert>';
    console.log(`\n=== ${e.created_at?.slice(0, 19)} (anfrage ${e.anfrage_id?.slice(0, 8)}…) ===`);
    console.log(`Error: ${e.fehler_text}`);
    console.log(`\nHaiku-Response (erste 800 Zeichen):`);
    console.log(resp.slice(0, 800));
    console.log(`\n--- Position 240-280 (um Fehler herum):`);
    console.log(JSON.stringify(resp.slice(220, 290)));
  }
}

main();
