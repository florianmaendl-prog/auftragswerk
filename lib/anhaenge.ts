/**
 * Anhang-Upload-Helper – wird sowohl vom Inbound-Webhook
 * (Postmark-Attachments) als auch von den Versand-Routes
 * (von Max hochgeladene Dateien) benutzt.
 *
 * Storage-Layout: <betrieb_id>/<anfrage_id>/<uuid>_<safe_filename>
 * Privater Bucket 'anhaenge' – Lesen + Schreiben nur über service-role.
 */

import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from './supabase';

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
 * Lädt einen einzelnen Anhang in Storage hoch und legt die `anhaenge`-Zeile an.
 * Wirft keine Exception – Caller entscheidet, was bei Fehlern zu tun ist
 * (log in processing_errors / Console / Response).
 */
export async function speichereAnhang(
  att: AnhangInput,
  ctx: { nachrichtId: string; anfrageId: string; betriebId: string }
): Promise<SpeichereAnhangResult> {
  try {
    // Dateiname sanieren: keine Pfad-Trenner / Steuerzeichen, max 200 Zeichen
    const safeName = (att.name || 'datei').replace(/[/\\:*?"<>|]/g, '_').slice(0, 200);
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
      return { success: false, error: `metadata-insert: ${insertError.message}` };
    }

    return { success: true, storage_path: path };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'unbekannt' };
  }
}
