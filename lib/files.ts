/**
 * Client-side File-Helpers für Editor-Uploads.
 * Liest eine File-API-Datei in das Wire-Format ein, das die Versand-Routes
 * im body.anhaenge[] erwarten.
 */

export type AnhangPayload = {
  name: string;
  contentBase64: string;
  contentType: string;
};

export async function fileToBase64Payload(file: File): Promise<AnhangPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Data-URL hat das Format "data:<mime>;base64,XXXXX..." – wir wollen nur die XXXXX
      const base64 = result.includes(',') ? result.split(',', 2)[1] : '';
      resolve({
        name: file.name,
        contentBase64: base64,
        contentType: file.type || 'application/octet-stream',
      });
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader-Fehler'));
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Maximale Dateigröße pro Anhang. Postmark akzeptiert ~25 MB Total-Payload,
 * wir cappen pro Datei bei 20 MB damit der Spielraum für mehrere Anhänge
 * + Mail-Body + Threading-Headers reicht.
 */
export const MAX_DATEIGROESSE_BYTES = 20 * 1024 * 1024;

/**
 * Maximale Gesamtgröße aller Anhänge in einer Mail.
 */
export const MAX_GESAMTGROESSE_BYTES = 25 * 1024 * 1024;

/**
 * Was Handwerker realistischerweise an Kunden senden:
 * Fotos (Maßaufnahmen, Skizzen), PDFs (Angebote, Auftragsbestätigungen),
 * Office-Dokumente. Ausgeschlossen sind ausführbare Dateien + exotische Types.
 */
const ERLAUBTE_MIME_PREFIXES = ['image/'];
const ERLAUBTE_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

export function istErlaubterDateityp(mimeType: string): boolean {
  if (!mimeType) return false;
  if (ERLAUBTE_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) return true;
  return ERLAUBTE_MIME_TYPES.has(mimeType);
}

/**
 * Validiert eine Liste von Files. Gibt entweder ok-Result mit gültigen Files
 * oder einen Fehlertext zurück. Caller zeigt den Fehler an und filtert die
 * ungültigen Dateien raus.
 */
export function validateAttachments(
  neueFiles: File[],
  bisherigeFiles: File[]
): { ok: true; files: File[] } | { ok: false; fehler: string } {
  for (const f of neueFiles) {
    if (f.size > MAX_DATEIGROESSE_BYTES) {
      return {
        ok: false,
        fehler: `Datei "${f.name}" ist zu groß (${formatBytes(f.size)}). Max ${formatBytes(MAX_DATEIGROESSE_BYTES)} pro Datei.`,
      };
    }
    if (!istErlaubterDateityp(f.type)) {
      return {
        ok: false,
        fehler: `Dateityp von "${f.name}" wird nicht unterstützt. Erlaubt: Bilder, PDF, Word, Excel, Text.`,
      };
    }
  }

  const gesamt =
    [...bisherigeFiles, ...neueFiles].reduce((sum, f) => sum + f.size, 0);
  if (gesamt > MAX_GESAMTGROESSE_BYTES) {
    return {
      ok: false,
      fehler: `Anhänge insgesamt zu groß (${formatBytes(gesamt)}). Max ${formatBytes(MAX_GESAMTGROESSE_BYTES)} pro Mail.`,
    };
  }

  return { ok: true, files: neueFiles };
}
