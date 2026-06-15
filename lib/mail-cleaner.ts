/**
 * Mail-Cleaner für Auftragswerk
 */

export interface CleanedMail {
  cleaned_text: string;
  original_length: number;
  cleaned_length: number;
  reduction_percent: number;
  has_quoted_content: boolean;
  has_signature: boolean;
  detected_language: 'de' | 'en' | 'unknown';
}

export function cleanMail(
  textBody: string | null | undefined,
  htmlBody: string | null | undefined
): CleanedMail {
  let raw = (textBody && textBody.trim().length > 0)
    ? textBody
    : htmlToText(htmlBody || '');

  raw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const originalLength = raw.length;

  let cleaned = raw;
  let hasQuotedContent = false;
  let hasSignature = false;

  const beforeQuoteRemoval = cleaned.length;
  cleaned = removeQuotedHeaders(cleaned);
  if (cleaned.length < beforeQuoteRemoval) hasQuotedContent = true;

  const beforeLineQuotes = cleaned.length;
  cleaned = removeLineQuotes(cleaned);
  if (cleaned.length < beforeLineQuotes) hasQuotedContent = true;

  const beforeSignature = cleaned.length;
  cleaned = removeSignature(cleaned);
  if (cleaned.length < beforeSignature) hasSignature = true;

  cleaned = removeDisclaimer(cleaned);
  cleaned = normalizeWhitespace(cleaned);

  const language = detectLanguage(cleaned);
  const cleanedLength = cleaned.length;
  const reduction = originalLength > 0
    ? Math.round(((originalLength - cleanedLength) / originalLength) * 100)
    : 0;

  return {
    cleaned_text: cleaned,
    original_length: originalLength,
    cleaned_length: cleanedLength,
    reduction_percent: reduction,
    has_quoted_content: hasQuotedContent,
    has_signature: hasSignature,
    detected_language: language,
  };
}

function removeQuotedHeaders(text: string): string {
  const markers = [
    /\bOn\s[^\n]{0,200}wrote:/im,
    /^-+\s*Original Message\s*-+/im,
    /^Begin forwarded message:/im,
    /^From:\s[^\n]+\nSent:\s/im,
    /\bAm\s[^\n]{0,200}schrieb\s/im,
    /\bAm\s[^\n]{0,200}um\s[^\n]{0,200}schrieb:/im,
    /^-+\s*Urspr[üu]ngliche Nachricht\s*-+/im,
    /^Weitergeleitete Nachricht/im,
    /^Von:\s[^\n]+\nGesendet:\s/im,
    /^Von:\s[^\n]+\nDatum:\s/im,
  ];

  let earliestMatch = -1;
  for (const pattern of markers) {
    const match = text.search(pattern);
    if (match > -1 && (earliestMatch === -1 || match < earliestMatch)) {
      earliestMatch = match;
    }
  }

  if (earliestMatch > -1) {
    return text.substring(0, earliestMatch).trimEnd();
  }
  return text;
}

function removeLineQuotes(text: string): string {
  const lines = text.split('\n');
  const cleaned: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('>') || trimmed.startsWith('|')) continue;
    cleaned.push(line);
  }

  return cleaned.join('\n');
}

function removeSignature(text: string): string {
  const signatureMarkers = [
    /\n\s*Mit freundlichen Gr[üu][ßs]en/i,
    /\n\s*Freundliche Gr[üu][ßs]e/i,
    /\n\s*Viele Gr[üu][ßs]e/i,
    /\n\s*Beste Gr[üu][ßs]e/i,
    /\n\s*MfG\b/i,
    /\n\s*LG\b/i,
    /\n\s*VG\b/i,
    /\n\s*Gru[ßs]\b/i,
    /\n\s*Best regards/i,
    /\n\s*Kind regards/i,
    /\n\s*Sincerely/i,
    /\n\s*Cheers/i,
    /\n\s*Thanks(?:[,!]|\n)/i,
    /\n--\s*\n/,
    /\n__+\n/,
    /\n\s*Sent from my /i,
    /\n\s*Von meinem (iPhone|iPad|Android|Samsung)/i,
    /\n\s*Gesendet von meinem /i,
  ];

  let result = text;
  let earliestMatch = -1;

  for (const pattern of signatureMarkers) {
    const match = result.search(pattern);
    if (match > -1 && (earliestMatch === -1 || match < earliestMatch)) {
      earliestMatch = match;
    }
  }

  if (earliestMatch > -1) {
    result = result.substring(0, earliestMatch).trimEnd();
  }

  return result;
}

function removeDisclaimer(text: string): string {
  const disclaimerMarkers = [
    /\n\s*Diese E-Mail enth[äa]lt vertrauliche/i,
    /\n\s*This email contains confidential/i,
    /\n\s*The information contained in this/i,
    /\n\s*Vertraulichkeitshinweis/i,
    /\n\s*Confidentiality notice/i,
    /\n\s*Hinweis zum Datenschutz/i,
    /\n\s*Privacy notice/i,
  ];

  let result = text;
  let earliestMatch = -1;

  for (const pattern of disclaimerMarkers) {
    const match = result.search(pattern);
    if (match > -1 && (earliestMatch === -1 || match < earliestMatch)) {
      earliestMatch = match;
    }
  }

  if (earliestMatch > -1) {
    result = result.substring(0, earliestMatch).trimEnd();
  }

  return result;
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Body-Extraktion mit Fallback-Kette für Postmark-Inbound-Payloads.
 *
 * Hintergrund: viele Mail-Provider (firemail.de, Newsletter-Tools, manche
 * Webmail-Clients) senden Mails NUR mit HtmlBody und leerem TextBody.
 * Wenn wir naiv `TextBody || ''` lesen, landet ein leerer String in der DB
 * → KI hat nichts zu lesen → klassifiziert nur auf Betreff + Anhang-Namen.
 *
 * Reihenfolge:
 *   1. TextBody (wenn nicht leer) — von Mail-Client sauber gesetzt, beste Quelle
 *   2. HtmlBody (wenn nicht leer) — durch htmlToText() konvertiert
 *   3. '' — echte Header-only-Mail, sehr selten
 */
export function extractBody(payload: {
  TextBody?: string | null;
  HtmlBody?: string | null;
}): string {
  const text = (payload.TextBody ?? '').trim();
  if (text.length > 0) return text;

  const html = (payload.HtmlBody ?? '').trim();
  if (html.length > 0) return normalizeWhitespace(htmlToText(html));

  return '';
}

function htmlToText(html: string): string {
  if (!html) return '';

  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(div|p|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß')
    .replace(/&euro;/g, '€')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"');
}

function detectLanguage(text: string): 'de' | 'en' | 'unknown' {
  if (text.length < 20) return 'unknown';

  const lower = text.toLowerCase();

  const germanWords = ['und', 'der', 'die', 'das', 'ich', 'sie', 'wir', 'für', 'mit', 'nicht', 'ein', 'eine', 'bitte'];
  const englishWords = ['and', 'the', 'is', 'are', 'you', 'we', 'for', 'with', 'not', 'please', 'would'];

  let deScore = 0;
  let enScore = 0;

  for (const word of germanWords) {
    if (new RegExp(`\\b${word}\\b`, 'gi').test(lower)) deScore++;
  }
  for (const word of englishWords) {
    if (new RegExp(`\\b${word}\\b`, 'gi').test(lower)) enScore++;
  }

  if (deScore > enScore && deScore >= 2) return 'de';
  if (enScore > deScore && enScore >= 2) return 'en';
  return 'unknown';
}