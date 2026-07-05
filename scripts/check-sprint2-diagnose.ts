/**
 * Sprint-2 Diagnose: processing_errors + manuell_pruefen aufschlüsseln.
 *
 * Ziel:
 * (a) Alle stillen Fehler der letzten 500 EinträgeGroup by schritt +
 *     fehler_text-Muster. Wo brennt es strukturell?
 * (b) Alle Anfragen mit status='manuell_pruefen' – Grund-Verteilung:
 *     Eskalation? Klassifikations-Fehler? Entwurfs-Fehler? Ganz unklar?
 *
 * Lauf: npx tsx --env-file=.env.local scripts/check-sprint2-diagnose.ts
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

type AnfrageRow = {
  id: string;
  betrieb_id: string;
  betreff: string | null;
  von_email: string | null;
  von_name: string | null;
  status: string;
  created_at: string;
};

type AnalyseRow = {
  anfrage_id: string;
  eskalation_erkannt: boolean | null;
  eskalation_grund: string | null;
  kategorie: string | null;
};

function trennlinie(titel: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(titel);
  console.log('='.repeat(60));
}

async function main() {
  const supabase = createClient(url, key);

  // -----------------------------------------------------------------
  // A) processing_errors
  // -----------------------------------------------------------------

  // Schema-Sniff für Timestamp-Spalte (siehe check-errors.ts).
  const probeCreated = await supabase
    .from('processing_errors')
    .select('id, created_at')
    .limit(1);
  const useCreated = !probeCreated.error;
  const timestampCol = useCreated ? 'created_at' : 'erstellt_am';

  const { data: errors, error: errQ } = await supabase
    .from('processing_errors')
    .select(
      `id, betrieb_id, anfrage_id, schritt, fehler_text, fehler_details, ${timestampCol}`
    )
    .order(timestampCol, { ascending: false })
    .limit(500);

  if (errQ) {
    console.error('processing_errors-Query failed:', errQ.message);
    process.exit(1);
  }
  const alleFehler = (errors ?? []) as ErrorRow[];
  const getTs = (e: ErrorRow): string =>
    (useCreated ? e.created_at : e.erstellt_am) ?? '';

  trennlinie('A) processing_errors (max 500 neueste)');
  console.log(`Total: ${alleFehler.length}`);

  const proSchritt = new Map<string, ErrorRow[]>();
  for (const e of alleFehler) {
    const arr = proSchritt.get(e.schritt) ?? [];
    arr.push(e);
    proSchritt.set(e.schritt, arr);
  }

  console.log('\nPro Schritt (nach Häufigkeit):');
  const sorted = [...proSchritt.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [schritt, rows] of sorted) {
    console.log(`\n  [${rows.length}x] ${schritt}`);
    const texte = new Map<string, number>();
    for (const r of rows) {
      const key = r.fehler_text.slice(0, 120);
      texte.set(key, (texte.get(key) ?? 0) + 1);
    }
    const topTexte = [...texte.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    for (const [text, count] of topTexte) {
      console.log(`    ${count}x: ${text}${text.length === 120 ? '…' : ''}`);
    }
  }

  const tag = 24 * 60 * 60 * 1000;
  const letzte24h = alleFehler.filter(
    (e) => Date.now() - new Date(getTs(e)).getTime() < tag
  );
  console.log(`\nLetzte 24h: ${letzte24h.length} Fehler`);
  if (alleFehler.length > 0) {
    console.log(`Zeitraum: ${getTs(alleFehler.at(-1)!)} … ${getTs(alleFehler[0])}`);
  }

  // -----------------------------------------------------------------
  // B) manuell_pruefen-Anfragen
  // -----------------------------------------------------------------

  const { data: anfragen, error: anfQ } = await supabase
    .from('anfragen')
    .select('id, betrieb_id, betreff, von_email, von_name, status, created_at')
    .eq('status', 'manuell_pruefen')
    .order('created_at', { ascending: false });

  if (anfQ) {
    console.error('anfragen-Query failed:', anfQ.message);
    process.exit(1);
  }
  const mpAnfragen = (anfragen ?? []) as AnfrageRow[];

  trennlinie('B) Anfragen mit status=manuell_pruefen');
  console.log(`Total: ${mpAnfragen.length}`);

  if (mpAnfragen.length === 0) {
    console.log('(keine offenen manuell_pruefen-Anfragen)');
  } else {
    // Analysen für diese Anfragen holen – neueste pro Anfrage
    const anfrageIds = mpAnfragen.map((a) => a.id);
    const { data: analysen, error: anaQ } = await supabase
      .from('analysen')
      .select('anfrage_id, eskalation_erkannt, eskalation_grund, kategorie')
      .in('anfrage_id', anfrageIds);

    if (anaQ) {
      console.error('analysen-Query failed:', anaQ.message);
      process.exit(1);
    }

    // Pro Anfrage neuestes Analysen-Ergebnis nehmen – hier reicht das erste,
    // weil wir nur die Klassifikations-Grund-Verteilung wollen.
    const analyseMap = new Map<string, AnalyseRow>();
    for (const a of (analysen ?? []) as AnalyseRow[]) {
      if (!analyseMap.has(a.anfrage_id)) analyseMap.set(a.anfrage_id, a);
    }

    // Anfrage-IDs mit Fehler in processing_errors
    const fehlerAnfrageIds = new Set<string>();
    const fehlerSchritteProAnfrage = new Map<string, string[]>();
    for (const e of alleFehler) {
      if (!e.anfrage_id) continue;
      if (!anfrageIds.includes(e.anfrage_id)) continue;
      fehlerAnfrageIds.add(e.anfrage_id);
      const arr = fehlerSchritteProAnfrage.get(e.anfrage_id) ?? [];
      arr.push(e.schritt);
      fehlerSchritteProAnfrage.set(e.anfrage_id, arr);
    }

    // Verteilung
    let cEskalation = 0;
    let cKlassifikationFehler = 0;
    let cEntwurfFehler = 0;
    let cAndererFehler = 0;
    let cUnklar = 0;

    for (const a of mpAnfragen) {
      const ana = analyseMap.get(a.id);
      const fehlerSchritte = fehlerSchritteProAnfrage.get(a.id) ?? [];

      if (ana?.eskalation_erkannt === true) {
        cEskalation++;
      } else if (fehlerSchritte.some((s) => s.toLowerCase().includes('klassifik'))) {
        cKlassifikationFehler++;
      } else if (fehlerSchritte.some((s) => s.toLowerCase().includes('entwurf'))) {
        cEntwurfFehler++;
      } else if (fehlerSchritte.length > 0) {
        cAndererFehler++;
      } else {
        cUnklar++;
      }
    }

    console.log('\nGrund-Verteilung:');
    console.log(`  Eskalation erkannt:         ${cEskalation}`);
    console.log(`  Klassifikations-Fehler:     ${cKlassifikationFehler}`);
    console.log(`  Entwurfs-Fehler:            ${cEntwurfFehler}`);
    console.log(`  Anderer Pipeline-Fehler:    ${cAndererFehler}`);
    console.log(`  Unklar (kein Fehler-Log):   ${cUnklar}  ← genauer schauen`);

    // Beispiele für „Unklar"
    if (cUnklar > 0) {
      console.log('\nBeispiele „Unklar" (keine Fehler-Zeile, keine Eskalation):');
      let gezeigt = 0;
      for (const a of mpAnfragen) {
        if (gezeigt >= 5) break;
        const ana = analyseMap.get(a.id);
        const fehlerSchritte = fehlerSchritteProAnfrage.get(a.id) ?? [];
        if (ana?.eskalation_erkannt === true) continue;
        if (fehlerSchritte.length > 0) continue;
        const von = a.von_name || a.von_email || '(kein Absender)';
        const betreff = (a.betreff || '(kein Betreff)').slice(0, 60);
        console.log(
          `  [${a.created_at.slice(0, 19)}] ${von} — „${betreff}"`
        );
        gezeigt++;
      }
    }

    // Beispiele für Eskalation
    if (cEskalation > 0) {
      console.log('\nBeispiele Eskalation:');
      let gezeigt = 0;
      for (const a of mpAnfragen) {
        if (gezeigt >= 5) break;
        const ana = analyseMap.get(a.id);
        if (ana?.eskalation_erkannt !== true) continue;
        const grund = (ana.eskalation_grund || '(kein Grund)').slice(0, 80);
        console.log(`  [${a.created_at.slice(0, 19)}] Grund: ${grund}`);
        gezeigt++;
      }
    }
  }

  // -----------------------------------------------------------------
  // C) Zusammenfassung als Merker
  // -----------------------------------------------------------------

  trennlinie('C) Zusammenfassung für SPRINT-2-DIAGNOSE.md');
  console.log(`processing_errors gesamt (letzte 500):  ${alleFehler.length}`);
  console.log(`processing_errors letzte 24h:           ${letzte24h.length}`);
  console.log(`manuell_pruefen offen:                  ${mpAnfragen.length}`);
  console.log('\nOffene Fragen:');
  console.log('- Sind die Top-Fehler-Muster reproduzierbar oder Race/Netz-Flakes?');
  console.log('- Wie viele „Unklar" gibt es und wo sind die Anfragen jetzt?');
  console.log('- Kann Eskalations-Erkennung schärfer werden ohne falsche Positive?');
}

main();
