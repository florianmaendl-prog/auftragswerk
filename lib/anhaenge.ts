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
