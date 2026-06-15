/**
 * Vision-Anhang-Loader für die Entwurfs-KI.
 *
 * Lädt visuell verarbeitbare Anhänge der aktuellen Nachricht aus dem
 * Storage-Bucket und gibt sie base64-kodiert zurück:
 *   - jpg/png/webp/gif → image-Blocks (Vision V1, Tag 19)
 *   - application/pdf  → document-Blocks (PDF-Vision, Welle P1).
 *     Claude liest PDFs nativ inkl. Layout/Maße/Zeichnungen, kein OCR
 *     nötig. Wow-Move bei Bauplänen + Aufmaßen.
 *
 * Limits V2 (P1):
 *   - max 5 Anhänge gesamt (Mix Bild+PDF)
 *   - Bilder: max 5 MB (Anthropic-Hard-Limit)
 *   - PDFs: max 20 MB (defensiv unter Anthropic-32MB-Limit)
 *   - Nicht-visuelle MIME-Types (Office, Text) bleiben ignoriert
 *
 * Sortierung: kleinste zuerst – Handy-Schnappschüsse + kleine Pläne
 * sicher drin, riesige Files können geskippt werden.
 */

import { supabaseAdmin } from './supabase';

const MAX_ANHAENGE_PRO_ANFRAGE = 5;
const MAX_BYTES_BILD = 5 * 1024 * 1024;
const MAX_BYTES_PDF = 20 * 1024 * 1024;

const ERLAUBTE_BILD_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const ERLAUBTE_PDF_MIMES = new Set(['application/pdf']);

export type KiBildMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif';

export type KiAnhang =
  | {
      kind: 'image';
      mediaType: KiBildMediaType;
      base64: string;
      dateiname: string;
    }
  | {
      kind: 'document';
      mediaType: 'application/pdf';
      base64: string;
      dateiname: string;
    };

/**
 * Legacy-Type-Alias – manche Aufrufer (Diagnose-View etc.) erwarten
 * noch den alten Namen. Nur image-Variante exportiert weil PDF erst
 * mit P1 dazukommt.
 */
export type KiBild = Extract<KiAnhang, { kind: 'image' }>;

function normalizeBildMime(raw: string): KiBildMediaType | null {
  const lower = raw.toLowerCase();
  if (!ERLAUBTE_BILD_MIMES.has(lower)) return null;
  if (lower === 'image/jpg') return 'image/jpeg';
  return lower as KiBildMediaType;
}

/**
 * Lädt Vision-fähige Anhänge (Bilder + PDFs) einer Nachricht und liefert
 * sie als base64-Strings zurück. Bei leer return [] – Caller muss
 * Vision-Pfad dann skippen.
 */
export async function ladeAnhaengeFuerKI(nachrichtId: string): Promise<KiAnhang[]> {
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

  const result: KiAnhang[] = [];
  for (const a of anhaenge) {
    if (result.length >= MAX_ANHAENGE_PRO_ANFRAGE) break;

    const mime = (a.content_type ?? '').toLowerCase();
    const istBild = !!normalizeBildMime(mime);
    const istPdf = ERLAUBTE_PDF_MIMES.has(mime);
    if (!istBild && !istPdf) continue;

    const limit = istPdf ? MAX_BYTES_PDF : MAX_BYTES_BILD;
    if (typeof a.groesse_bytes === 'number' && a.groesse_bytes > limit) {
      console.log(
        `Vision: Anhang zu groß (${a.dateiname}, ${a.groesse_bytes} bytes, limit ${limit}) – geskippt`
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
    if (arrayBuffer.byteLength > limit) {
      console.log(
        `Vision: Anhang zu groß nach Download (${a.dateiname}, ${arrayBuffer.byteLength}) – geskippt`
      );
      continue;
    }

    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dateiname = a.dateiname ?? 'unbenannt';

    if (istPdf) {
      result.push({
        kind: 'document',
        mediaType: 'application/pdf',
        base64,
        dateiname,
      });
    } else {
      const bildMime = normalizeBildMime(mime)!;
      result.push({
        kind: 'image',
        mediaType: bildMime,
        base64,
        dateiname,
      });
    }
  }

  if (result.length > 0) {
    const bilder = result.filter((r) => r.kind === 'image').length;
    const pdfs = result.filter((r) => r.kind === 'document').length;
    console.log(
      `Vision: ${bilder} Bild(er) + ${pdfs} PDF(s) für KI geladen (nachricht=${nachrichtId})`
    );
  }

  return result;
}

/**
 * Legacy-Wrapper für Aufrufer die noch den alten Namen + Bild-only-
 * Verhalten erwarten. Filtert PDFs raus.
 * @deprecated Nutze ladeAnhaengeFuerKI für Mix Bild+PDF.
 */
export async function ladeBilderFuerKI(nachrichtId: string): Promise<KiBild[]> {
  const alle = await ladeAnhaengeFuerKI(nachrichtId);
  return alle.filter((a): a is KiBild => a.kind === 'image');
}
