/**
 * Anhang-Upload-Helper – wird sowohl vom Inbound-Webhook
 * (Postmark-Attachments) als auch von den Versand-Routes
 * (vom Owner hochgeladene Dateien) benutzt.
 *
 * Storage-Layout: <betrieb_id>/<anfrage_id>/<uuid>_<safe_filename>
 * Privater Bucket 'anhaenge' – Lesen + Schreiben nur über service-role.
 */

import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from './supabase';

/**
 * Supabase-Storage-konformer Filename. Storage akzeptiert nur
 * [A-Za-z0-9._-] sauber – Leerzeichen, Umlaute, Kommata führen zu
 * "Invalid key"-Upload-Errors. Spiegelt die Sanitize-Logik aus
 * supabase/functions/inbound-proxy/index.ts (Edge-Funktion in Deno,
 * eigene Copy weil kein Cross-Import möglich).
 */
function sanitizeFilenameForStorage(name: string | null | undefined): string {
  const raw = name || 'datei';
  const transliteriert = raw
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss');
  const lastDot = transliteriert.lastIndexOf('.');
  const stamm = lastDot > 0 ? transliteriert.slice(0, lastDot) : transliteriert;
  const ext = lastDot > 0 ? transliteriert.slice(lastDot) : '';
  const cleanStamm = stamm.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_');
  const cleanExt = ext.replace(/[^A-Za-z0-9.]/g, '');
  const result = (cleanStamm + cleanExt).slice(0, 200);
  return result.length > 0 ? result : 'datei';
}

export type AnhangInput = {
  name: string;
  contentBase64: string;
  contentType: string;
  /** Optional. Wenn nicht gesetzt, wird die dekodierte Buffer-Größe genommen. */
  contentLengthHint?: number;
};

export type SpeichereAnhangResult = {
  success: boolean;
  storage_path?: string;
  error?: string;
};

/**
 * Lädt einen Anhang aus base64-Daten in Storage hoch und legt die
 * `anhaenge`-Zeile an. Für Outbound-Versand sowie Legacy-Inbound
 * (wenn die Mail klein genug für Vercels Body-Limit war).
 *
 * Wirft keine Exception – Caller entscheidet, was bei Fehlern zu tun ist.
 */
export async function speichereAnhang(
  att: AnhangInput,
  ctx: { nachrichtId: string; anfrageId: string; betriebId: string }
): Promise<SpeichereAnhangResult> {
  try {
    const safeName = sanitizeFilenameForStorage(att.name);
    const path = `${ctx.betriebId}/${ctx.anfrageId}/${randomUUID()}_${safeName}`;
    const buffer = Buffer.from(att.contentBase64, 'base64');

    const { error: uploadError } = await supabaseAdmin.storage
      .from('anhaenge')
      .upload(path, buffer, { contentType: att.contentType, upsert: false });

    if (uploadError) {
      return { success: false, error: `storage-upload: ${uploadError.message}` };
    }

    const { error: insertError } = await supabaseAdmin.from('anhaenge').insert({
      nachricht_id: ctx.nachrichtId,
      betrieb_id: ctx.betriebId,
      dateiname: att.name,
      content_type: att.contentType,
      groesse_bytes: att.contentLengthHint ?? buffer.length,
      storage_path: path,
    });

    if (insertError) {
      // Storage hat die Datei – aber wir haben keine DB-Referenz mehr.
      // Best-effort cleanup, damit der Bucket nicht mit Orphans volläuft.
      // Fehler beim Remove ignorieren wir, das ist nur Hygiene.
      const { error: removeError } = await supabaseAdmin.storage
        .from('anhaenge')
        .remove([path]);
      if (removeError) {
        console.warn(
          `Orphan-Cleanup für ${path} fehlgeschlagen (nicht-blockend): ${removeError.message}`
        );
      }
      return { success: false, error: `metadata-insert: ${insertError.message}` };
    }

    return { success: true, storage_path: path };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'unbekannt' };
  }
}

/**
 * Verlinkt einen Anhang, der bereits durch den Supabase-Edge-Proxy
 * (supabase/functions/inbound-proxy) hochgeladen wurde – wir machen
 * keinen Re-Upload, nur die anhaenge-Zeile mit dem schon vorhandenen
 * Storage-Pfad anlegen.
 */
export async function verlinkeAnhang(
  att: {
    name: string;
    contentType: string;
    storagePath: string;
    contentLengthHint?: number;
  },
  ctx: { nachrichtId: string; betriebId: string }
): Promise<SpeichereAnhangResult> {
  try {
    const { error } = await supabaseAdmin.from('anhaenge').insert({
      nachricht_id: ctx.nachrichtId,
      betrieb_id: ctx.betriebId,
      dateiname: att.name,
      content_type: att.contentType,
      groesse_bytes: att.contentLengthHint ?? 0,
      storage_path: att.storagePath,
    });
    if (error) return { success: false, error: `metadata-insert: ${error.message}` };
    return { success: true, storage_path: att.storagePath };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'unbekannt' };
  }
}
