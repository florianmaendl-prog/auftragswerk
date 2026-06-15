/**
 * Signatur-Helper (Welle P2): aus Plain-Text-Signatur + optionalem Logo
 * eine HTML-Variante bauen, die im Mail-Client als Premium-Signatur
 * ankommt (Logo unter dem Namen, ähnlich Outlook-Standard).
 *
 * Aufrufer übergibt Plain-Text-Body + Plain-Text-Signatur + Logo-Info.
 * Wir liefern zurück:
 *   - bodyHtml: kompletter HTML-Body mit Signatur (und CID-Logo wenn da)
 *   - inlineAttachment: nur gesetzt wenn Logo da. Send-Pfad muss das
 *     als multipart/related Inline-Attachment mit ContentID einbetten.
 *
 * Bewusst kein Rich-Text-Editor im Profil (V1, Praktiker-tauglich) –
 * System bastelt das HTML automatisch aus den Plain-Text-Feldern.
 */

import { supabaseAdmin } from './supabase';

export type SignaturLogo = {
  contentBase64: string;
  contentType: string;
  contentId: string; // ohne Klammern, z.B. "logo"
};

export type SignaturRenderResult = {
  bodyHtml: string;
  inlineAttachment: SignaturLogo | null;
};

/**
 * Lädt das Logo (falls vorhanden) für den Betrieb und baut den
 * HTML-Body inkl. Signatur + CID-Logo zusammen.
 *
 * Logo-Loading darf fail-safe sein: bei Storage-Fehler senden wir die
 * HTML-Variante ohne Logo statt komplett zu blocken.
 */
export async function buildSignaturHtml(opts: {
  betriebId: string;
  bodyText: string;
  signaturPlain: string | null | undefined;
}): Promise<SignaturRenderResult> {
  const bodyTextEscaped = escapeHtml(opts.bodyText);
  const signaturEscaped = opts.signaturPlain
    ? escapeHtml(opts.signaturPlain)
    : null;

  // Logo-Info aus DB
  const { data: betrieb } = await supabaseAdmin
    .from('betriebe')
    .select('logo_storage_path, logo_content_type')
    .eq('id', opts.betriebId)
    .single();

  let inlineAttachment: SignaturLogo | null = null;
  let logoImgTag = '';

  if (betrieb?.logo_storage_path && betrieb?.logo_content_type) {
    try {
      const { data: file } = await supabaseAdmin.storage
        .from('logos')
        .download(betrieb.logo_storage_path);
      if (file) {
        const buf = Buffer.from(await file.arrayBuffer()).toString('base64');
        const contentId = 'auftragswerk-logo';
        inlineAttachment = {
          contentBase64: buf,
          contentType: betrieb.logo_content_type,
          contentId,
        };
        logoImgTag = `<div style="margin-top:8px;"><img src="cid:${contentId}" alt="" style="max-height:60px;max-width:240px;border:0;outline:none;text-decoration:none;display:block;" /></div>`;
      }
    } catch (err) {
      console.warn(
        `Signatur: Logo-Download fehlgeschlagen (betrieb=${opts.betriebId}): ${err instanceof Error ? err.message : 'unbekannt'} – sende ohne Logo`
      );
    }
  }

  const signaturBlock = signaturEscaped
    ? `<div style="margin-top:24px;color:#444;white-space:pre-wrap;">${signaturEscaped}</div>${logoImgTag}`
    : logoImgTag;

  // Bewusst sparsames Styling – Outlook-Desktop unterstützt nur einen
  // begrenzten CSS-Subset, viele Properties werden ignoriert. white-space:
  // pre-wrap erhält die Zeilenumbrüche aus der Plain-Text-Quelle, ohne
  // dass wir <br> einbauen müssen.
  const bodyHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:#111;white-space:pre-wrap;">${bodyTextEscaped}</div>
${signaturBlock}
</body></html>`;

  return { bodyHtml, inlineAttachment };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
