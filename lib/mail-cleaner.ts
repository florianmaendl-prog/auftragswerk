/**
 * Mail-Cleaner für Auftragswerk
 * 
 * Säubert eingehende Mails vor der KI-Verarbeitung:
 * - Entfernt Quoted History (> blabla, On X wrote:, etc.)
 * - Entfernt Signaturen (Mit freundlichen Grüßen + drunter)
 * - Entfernt Disclaimer-Footer
 * - Normalisiert Whitespace
 * - HTML → Plain Text Fallback
 */

export interface CleanedMail {
  cleaned_text: string;        // Der gesäuberte Haupttext
  original_length: number;     // Länge des Originals (Zeichen)
  cleaned_length: number;      // Länge nach Reinigung
  reduction_percent: number;   // Wie viel wurde entfernt (in %)
  has_quoted_content: boolean; // Gab es zitierten Text?
  has_signature: boolean;      // Wurde eine Signatur erkannt?
  detected_language: 'de' | 'en' | 'unknown';
}

/**
 * Hauptfunktion: Säubert eine Mail
 */
export function cleanMail(
  textBody: string | null | undefined,
  htmlBody: string | null | undefined
): CleanedMail {
  // 1. Input wählen: TextBody bevorzugt, sonst HTML konvertieren
  let raw = (textBody && textBody.trim().length > 0)
    ? textBody
    : htmlToText(htmlBody || '');

  const originalLength = raw.length;

  // 2. Reihenfolge ist wichtig!
  let cleaned = raw;
  let hasQuotedContent = false;
  let hasSignature = false;

  // 2a. Entferne On X wrote: / Am X schrieb: / Forwarded message Headers
  const beforeQuoteRemoval = cleaned.length;
  cleaned = removeQuotedHeaders(cleaned);
  if (cleaned.length < beforeQuoteRemoval) hasQuotedContent = true;

  // 2b. Entferne > zitierte Zeilen
  const beforeLineQuotes = cleaned.length;
  cleaned = removeLineQuotes(cleaned);
  if (cleaned.length < beforeLineQuotes) hasQuotedContent = true;

  // 2c. Entferne Signaturen
  const beforeSignature = cleaned.length;
  cleaned = removeSignature(cleaned);
  if (cleaned.length < beforeSignature) hasSignature = true;

  // 2d. Entferne Disclaimer-Footer
  cleaned = removeDisclaimer(cleaned);

  // 2e. Whitespace normalisieren
  cleaned = normalizeWhitespace(cleaned);

  // 3. Sprache erkennen (simpel)
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

/**
 * Entfernt Quote-Header wie:
 * - "On Mon, May 19, 2026 at 10:30, X wrote:"
 * - "Am 19.05.2026 um 10:30 schrieb X:"
 * - "Von: X Gesendet: ..."
 * - "-----Original Message-----"
 * - "Begin forwarded message:"
 */
function removeQuotedHeaders(text: string): string {
  const patterns = [
    // Englisch
    /^On\s.+?wrote:.*/gms,
    /^-+\s*Original Message\s*-+.*/gms,
    /^Begin forwarded message:.*/gms,
    /^From:\s.+?Sent:\s.+?$/gms,
    
    // Deutsch
    /^Am\s.+?schrieb\s.+?:.*/gms,
    /^Am\s.+?um\s.+?schrieb:.*/gms,
    /^-+\s*Urspr[üu]ngliche Nachricht\s*-+.*/gms,
    /^Weitergeleitete Nachricht.*/gms,
    /^Von:\s.+?Gesendet:\s.+?$/gms,
    /^Von:\s.+?Datum:\s.+?$/gms,
    
    // Apple Mail
    /^>\s*Am\s.+?schrieb.+?:.*/gms,
  ];

  let result = text;
  for (const pattern of patterns) {
    const match = result.search(pattern);
    if (match > -1) {
      // Alles ab diesem Punkt abschneiden
      result = result.substring(0, match).trimEnd();
    }
  }
  return result;
}

/**
 * Entfernt Zeilen, die mit > anfangen (klassische Quote-Notation)
 */
function removeLineQuotes(text: string): string {
  const lines = text.split('\n');
  const cleaned: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Quote-Zeilen überspringen
    if (trimmed.startsWith('>') || trimmed.startsWith('|')) continue;
    cleaned.push(line);
  }
  
  return cleaned.join('\n');
}

/**
 * Erkennt und entfernt Signaturen
 * Typische Marker: "Mit freundlichen Grüßen", "MfG", "Best regards", "--"
 */
function removeSignature(text: string): string {
  const signatureMarkers = [
    // Deutsch
    /\n\s*Mit freundlichen Gr[üu][ßs]en/i,
    /\n\s*Freundliche Gr[üu][ßs]e/i,
    /\n\s*Viele Gr[üu][ßs]e/i,
    /\n\s*Beste Gr[üu][ßs]e/i,
    /\n\s*MfG\b/i,
    /\n\s*LG\b/i,
    /\n\s*VG\b/i,
    /\n\s*Gru[ßs]\b/i,
    
    // Englisch
    /\n\s*Best regards/i,
    /\n\s*Kind regards/i,
    /\n\s*Sincerely/i,
    /\n\s*Cheers/i,
    /\n\s*Thanks(?:[,!]|\n)/i,
    
    // Standard-Separator (-- mit Leerzeichen ist RFC-3676)
    /\n--\s*\n/,
    /\n__+\n/, // Unterstriche als Trenner
    
    // "Sent from my iPhone/Android/etc"
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

/**
 * Entfernt Disclaimer-Footer
 * z.B. "Diese E-Mail enthält vertrauliche Informationen..."
 */
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

/**
 * Whitespace normalisieren:
 * - Mehrfache Leerzeilen → eine Leerzeile
 * - Trim am Anfang und Ende
 * - Windows Line Endings → Unix
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Simple HTML-to-Text Konvertierung
 * Wir nutzen keine Library, weil wir nur Grundsäuberung brauchen
 */
function htmlToText(html: string): string {
  if (!html) return '';
  
  return html
    // Script und Style komplett raus
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Block-Elemente → Newlines
    .replace(/<\/?(div|p|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
    // Alle anderen Tags entfernen
    .replace(/<[^>]+>/g, '')
    // HTML-Entities decoden (häufigste)
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
    .replace(/&#8220;|&#8221;/g, '"');
}

/**
 * Sprach-Erkennung (sehr simpel via Häufigkeitsanalyse)
 */
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
