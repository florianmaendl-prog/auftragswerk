/**
 * Postmark Outbound Wrapper
 *
 * Versendet Mails über Postmark API.
 * Liefert Message-ID + Postmark-ID zurück für Threading + Tracking.
 */

const POSTMARK_API_URL = 'https://api.postmarkapp.com/email';

export type SendMailOptions = {
  to: string;
  toName?: string;
  replyTo?: string;
  replyToName?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  // Threading: wenn wir auf eine vorherige Mail antworten
  inReplyTo?: string;        // Message-ID der Vorgänger-Mail
  references?: string[];     // Komplette Thread-Kette
  // Postmark-spezifisch
  tag?: string;
  metadata?: Record<string, string>;
};

export type SendMailResult = {
  success: boolean;
  postmarkMessageId?: string;  // Postmark eigene ID
  messageId?: string;          // Mail-Standard Message-ID (für Threading)
  error?: string;
  errorCode?: number;
  rawResponse?: unknown;
};

export async function sendMail(opts: SendMailOptions): Promise<SendMailResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const fromEmail = process.env.POSTMARK_FROM_EMAIL;
  const fromName = process.env.POSTMARK_FROM_NAME || 'Auftragswerk';

  if (!token || !fromEmail) {
    return {
      success: false,
      error: 'POSTMARK_SERVER_TOKEN oder POSTMARK_FROM_EMAIL fehlen in .env',
    };
  }

  const fromHeader = `${fromName} <${fromEmail}>`;
  const toHeader = opts.toName ? `${opts.toName} <${opts.to}>` : opts.to;
  const replyToHeader = opts.replyTo
    ? opts.replyToName
      ? `${opts.replyToName} <${opts.replyTo}>`
      : opts.replyTo
    : undefined;

  // HTML-Fallback aus Plaintext
  const htmlBody =
    opts.bodyHtml ||
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; color: #111111; white-space: pre-wrap;">${escapeHtml(opts.bodyText)}</div>`;

  // Headers für Threading
  const headers: Array<{ Name: string; Value: string }> = [];
  if (opts.inReplyTo) {
    headers.push({ Name: 'In-Reply-To', Value: opts.inReplyTo });
  }
  if (opts.references && opts.references.length > 0) {
    headers.push({ Name: 'References', Value: opts.references.join(' ') });
  }

  const payload: Record<string, unknown> = {
    From: fromHeader,
    To: toHeader,
    Subject: opts.subject,
    TextBody: opts.bodyText,
    HtmlBody: htmlBody,
    MessageStream: 'outbound',
  };

  if (replyToHeader) payload.ReplyTo = replyToHeader;
  if (opts.tag) payload.Tag = opts.tag;
  if (opts.metadata) payload.Metadata = opts.metadata;
  if (headers.length > 0) payload.Headers = headers;

  try {
    const response = await fetch(POSTMARK_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.Message || `HTTP ${response.status}`,
        errorCode: data.ErrorCode,
        rawResponse: data,
      };
    }

    // Postmark gibt uns MessageID zurück die wir als Message-ID-Header nutzen
    // Format: <abc123@pm-bounces.auftragswerk.app>
    const messageId = `<${data.MessageID}@pm-bounces.auftragswerk.app>`;

    return {
      success: true,
      postmarkMessageId: data.MessageID,
      messageId,
      rawResponse: data,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unbekannter Fehler beim Postmark-Call',
    };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}