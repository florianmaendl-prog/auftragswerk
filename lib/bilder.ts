/**
 * Bilder-Loader für die Entwurfs-KI (Vision V1, Tag 19).
 *
 * Lädt jpg/png/webp/gif-Anhänge der aktuellen Nachricht aus dem Storage-
 * Bucket und gibt sie base64-kodiert zurück, damit der lib/entwurf.ts
 * sie als image-Blocks an Claude Sonnet 4.6 weiterreichen kann.
 *
 * Limits in V1 (defensiv, später nachschärfbar wenn Real-Daten zeigen
 * dass mehr gebraucht wird):
 *   - max 5 Bilder pro Anfrage – mehr ergibt selten neuen Erkenntnis-Wert
 *     und kostet Tokens (~1.6k pro Megapixel nach Anthropic-internem
 *     Resizing auf 1568×1568)
 *   - max 5 MB pro Bild – Anthropic-Hard-Limit; größere skippen wir
 *   - Nicht-Bild-MIME-Types (PDF, Office, Text) werden ignoriert –
 *     die landen weiter im Text-Body via Mail-Cleaner
 *
 * Sortierung: kleinste zuerst – falls wir an die 5er-Schranke stoßen,
 * landen die kleinsten (typisch: schnell vom Handy gemachten Schnapp-
 * schüsse) sicher drin, riesige Studio-Fotos werden ggf. geskippt.
 */

import { supabaseAdmin } from './supabase';

const MAX_BILDER_PRO_ANFRAGE = 5;
const MAX_BYTES_PRO_BILD = 5 * 1024 * 1024;

const ERLAUBTE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export type KiBildMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif';

export type KiBild = {
  mediaType: KiBildMediaType;
  base64: string;
  dateiname: string;
};

function normalizeMime(raw: string): KiBildMediaType | null {
  const lower = raw.toLowerCase();
  if (!ERLAUBTE_MIME_TYPES.has(lower)) return null;
  if (lower === 'image/jpg') return 'image/jpeg';
  return lower as KiBildMediaType;
}

/**
 * Lädt Bild-Anhänge einer Nachricht und liefert sie als base64-Strings
 * zurück. Wenn keine Bilder vorhanden sind, return [] – Caller muss
 * Vision-Pfad dann skippen.
 */
export async function ladeBilderFuerKI(nachrichtId: string): Promise<KiBild[]> {
  const { data: anhaenge, error } = await supabaseAdmin
    .from('anhaenge')
    .select('storage_path, dateiname, content_type, groesse_bytes')
    .eq('nachricht_id', nachrichtId)
    .order('groesse_bytes', { ascending: true, nullsFirst: false });

  if (error) {
    console.warn(`Vision: anhaenge-Query fehlgeschlagen: ${error.message}`);
    return [];
  }
  if (!anhaenge || anhaenge.length === 0) return [];

  const bilder: KiBild[] = [];
  for (const a of anhaenge) {
    if (bilder.length >= MAX_BILDER_PRO_ANFRAGE) break;

    const mime = normalizeMime(a.content_type ?? '');
    if (!mime) continue;

    if (typeof a.groesse_bytes === 'number' && a.groesse_bytes > MAX_BYTES_PRO_BILD) {
      console.log(
        `Vision: Bild zu groß (${a.dateiname}, ${a.groesse_bytes} bytes) – geskippt`
      );
      continue;
    }

    const { data: file, error: downloadError } = await supabaseAdmin.storage
      .from('anhaenge')
      .download(a.storage_path);

    if (downloadError || !file) {
      console.warn(
        `Vision: Download fehlgeschlagen (${a.dateiname}): ${downloadError?.message ?? 'unbekannt'}`
      );
      continue;
    }

    const arrayBuffer = await file.arrayBuffer();

    // Doppel-Check Größe nach Download (groesse_bytes kann NULL sein bei
    // Edge-Proxy-importierten Anhängen)
    if (arrayBuffer.byteLength > MAX_BYTES_PRO_BILD) {
      console.log(
        `Vision: Bild zu groß nach Download (${a.dateiname}, ${arrayBuffer.byteLength}) – geskippt`
      );
      continue;
    }

    const base64 = Buffer.from(arrayBuffer).toString('base64');
    bilder.push({
      mediaType: mime,
      base64,
      dateiname: a.dateiname ?? 'unbenannt',
    });
  }

  if (bilder.length > 0) {
    console.log(
      `Vision: ${bilder.length} Bild(er) für KI geladen (nachricht=${nachrichtId})`
    );
  }

  return bilder;
}
