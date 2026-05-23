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
