/**
 * Gmail-API-Versand für Auftragswerk (Welle C).
 *
 * Premium-Pivot: Mail kommt aus dem echten Gmail-Account des Kunden
 * (Scope gmail.send), kein DKIM/Sender-Signature-Setup nötig. Inbound
 * bleibt weiter Postmark-Forward — wir senden hier NUR.
 *
 * Signatur kompatibel zu lib/postmark.ts → drop-in-Fallback möglich.
 *
 * Iron Rules:
 * - Tokens nie plain loggen oder in processing_errors schreiben
 * - Eigene UUID-Message-ID generieren (Threading-Konsistenz mit Postmark)
 * - References-Cap auf 10 (wie lib/postmark.ts) damit SMTP nicht abweist
 * - Bei 401 → einmal Refresh + Retry, dann Fehler
 * - Bei dauerhaftem 4xx → gmail_connections.status='fehler' + Aufrufer
 *   fällt auf Postmark zurück
 */

import { randomUUID } from 'node:crypto';
import { decryptToken, encryptToken } from './crypto';
import { supabaseAdmin } from './supabase';

export type GmailSendOptions = {
  to: string;
  toName?: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  replyToName?: string;
  subject: string;
  bodyText: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: Array<{
    name: string;
    contentBase64: string;
    contentType: string;
  }>;
};

export type GmailSendResult = {
  success: boolean;
  messageId?: string;   // unsere eigene UUID-Message-ID (Threading)
  gmailMessageId?: string;
  threadId?: string;
  error?: string;
  // Wenn 'fehler-permanent', soll der Aufrufer auf Postmark fallback
  shouldFallback?: boolean;
};

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

/**
 * Holt ein gültiges access_token für den Betrieb. Wenn das gespeicherte
 * abgelaufen ist (oder kurz davor), refreshen wir mit refresh_token,
 * speichern das neue verschlüsselt zurück.
 *
 * Wirft, wenn keine Connection da ist oder der Refresh dauerhaft fehlschlägt.
 */
export async function getValidAccessToken(betriebId: string): Promise<{
  accessToken: string;
  googleEmail: string;
}> {
  const { data: conn, error: connError } = await supabaseAdmin
    .from('gmail_connections')
    .select(
      'id, access_token_encrypted, refresh_token_encrypted, token_expiry, google_email, status'
    )
    .eq('betrieb_id', betriebId)
    .maybeSingle();

  if (connError || !conn) {
    throw new Error('gmail_connections nicht gefunden für betrieb');
  }
  if (conn.status !== 'aktiv') {
    throw new Error(`gmail_connection-Status: ${conn.status}`);
  }

  const expiry = new Date(conn.token_expiry).getTime();
  const jetzt = Date.now();
  // 60 Sekunden Puffer – wenn weniger Restlaufzeit, refreshen
  if (expiry - jetzt > 60_000) {
    return {
      accessToken: decryptToken(conn.access_token_encrypted),
      googleEmail: conn.google_email,
    };
  }

  // Refresh
  const refreshToken = decryptToken(conn.refresh_token_encrypted);
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH-Env-Vars fehlen');
  }

  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);
  params.set('refresh_token', refreshToken);
  params.set('grant_type', 'refresh_token');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const txt = await res.text();
    // 400/401 vom Refresh = Token widerrufen → Connection auf 'widerrufen'
    if (res.status === 400 || res.status === 401) {
      await supabaseAdmin
        .from('gmail_connections')
        .update({
          status: 'widerrufen',
          letzter_fehler: `refresh-${res.status}: ${txt.slice(0, 200)}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id);
    }
    throw new Error(
      `Token-Refresh fehlgeschlagen (${res.status}): ${txt.slice(0, 200)}`
    );
  }

  const refreshData = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
  };

  const neuesExpiry = new Date(
    Date.now() + (refreshData.expires_in - 60) * 1000
  ).toISOString();

  await supabaseAdmin
    .from('gmail_connections')
    .update({
      access_token_encrypted: encryptToken(refreshData.access_token),
      token_expiry: neuesExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conn.id);

  return {
    accessToken: refreshData.access_token,
    googleEmail: conn.google_email,
  };
}

/**
 * Versendet eine Mail über die Gmail API im Namen des verbundenen Accounts.
 *
 * Returns:
 *  - success: true + messageId (unsere UUID) + gmailMessageId
 *  - success: false + shouldFallback: true → Aufrufer soll Postmark probieren
 */
export async function sendeViaGmail(
  betriebId: string,
  opts: GmailSendOptions
): Promise<GmailSendResult> {
  const ownMessageId = `<${randomUUID()}@auftragswerk.app>`;

  let tokenInfo: { accessToken: string; googleEmail: string };
  try {
    tokenInfo = await getValidAccessToken(betriebId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token-Holen fehlgeschlagen';
    return {
      success: false,
      error: msg,
      shouldFallback: true,
    };
  }

  // RFC822-Message bauen (Threading-Header + optional Anhänge via multipart/mixed)
  const raw = buildRfc822({
    ...opts,
    fromEmail: opts.fromEmail || tokenInfo.googleEmail,
    ownMessageId,
  });
  const rawBase64Url = Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Send + bei 401 einmal refresh+retry
  let res = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenInfo.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: rawBase64Url }),
  });

  if (res.status === 401) {
    // Token ist evtl. revoked oder gerade abgelaufen → zwingen-refresh
    try {
      // getValidAccessToken refresht wenn Expiry zu knapp ist, aber wir setzen
      // hier nochmal hart, indem wir das Expiry zurückdrehen und neu holen
      await supabaseAdmin
        .from('gmail_connections')
        .update({ token_expiry: new Date(0).toISOString() })
        .eq('betrieb_id', betriebId);
      tokenInfo = await getValidAccessToken(betriebId);
      res = await fetch(GMAIL_SEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenInfo.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: rawBase64Url }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '401-Retry failed';
      return { success: false, error: msg, shouldFallback: true };
    }
  }

  if (!res.ok) {
    const txt = await res.text();
    const isPermanent = res.status >= 400 && res.status < 500;
    if (isPermanent) {
      // Auf 'fehler' markieren – Profil-UI zeigt es, Aufrufer fällt zurück
      await supabaseAdmin
        .from('gmail_connections')
        .update({
          status: 'fehler',
          letzter_fehler: `send-${res.status}: ${txt.slice(0, 200)}`,
          updated_at: new Date().toISOString(),
        })
        .eq('betrieb_id', betriebId);
    }
    return {
      success: false,
      error: `Gmail-API ${res.status}: ${txt.slice(0, 200)}`,
      shouldFallback: isPermanent,
    };
  }

  const data = (await res.json()) as { id?: string; threadId?: string };
  return {
    success: true,
    messageId: ownMessageId,
    gmailMessageId: data.id,
    threadId: data.threadId,
  };
}

/**
 * Baut eine RFC822-Mail-Quellzeichenfolge. Mit Anhängen via multipart/mixed,
 * ohne Anhänge als einfache text/plain. Threading-Header (In-Reply-To,
 * References) werden gesetzt wenn vorhanden.
 *
 * References werden auf max 10 IDs gekappt (wie lib/postmark.ts), damit SMTP-
 * Server lange Header nicht ablehnen.
 */
function buildRfc822(opts: GmailSendOptions & {
  ownMessageId: string;
}): string {
  const fromHeader = opts.fromName
    ? `${encodeHeaderValue(opts.fromName)} <${opts.fromEmail}>`
    : opts.fromEmail;
  const toHeader = opts.toName
    ? `${encodeHeaderValue(opts.toName)} <${opts.to}>`
    : opts.to;

  const headers: string[] = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${encodeHeaderValue(opts.subject)}`,
    `Message-ID: ${opts.ownMessageId}`,
    'MIME-Version: 1.0',
  ];

  if (opts.replyTo) {
    const replyHeader = opts.replyToName
      ? `${encodeHeaderValue(opts.replyToName)} <${opts.replyTo}>`
      : opts.replyTo;
    headers.push(`Reply-To: ${replyHeader}`);
  }

  if (opts.inReplyTo) {
    headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  }
  if (opts.references && opts.references.length > 0) {
    const capped =
      opts.references.length > 10
        ? [opts.references[0], ...opts.references.slice(-9)]
        : opts.references;
    headers.push(`References: ${capped.join(' ')}`);
  }

  const hasAttachments = opts.attachments && opts.attachments.length > 0;

  if (!hasAttachments) {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    headers.push('Content-Transfer-Encoding: 7bit');
    return `${headers.join('\r\n')}\r\n\r\n${opts.bodyText}`;
  }

  // multipart/mixed mit eindeutiger Boundary
  const boundary = `--auftragswerk-${randomUUID()}`;
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  const parts: string[] = [];
  // 1) Text-Body
  parts.push(
    [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      opts.bodyText,
    ].join('\r\n')
  );

  // 2) Anhänge
  for (const att of opts.attachments!) {
    const safeName = encodeHeaderValue(att.name || 'datei');
    parts.push(
      [
        `--${boundary}`,
        `Content-Type: ${att.contentType || 'application/octet-stream'}; name="${safeName}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${safeName}"`,
        '',
        // base64 in 76-Zeichen-Zeilen splitten (RFC 2045)
        att.contentBase64.replace(/(.{76})/g, '$1\r\n'),
      ].join('\r\n')
    );
  }
  parts.push(`--${boundary}--`);

  return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
}

/**
 * Encoded einen Header-Value als RFC2047 Q-Encoded UTF-8, wenn Nicht-ASCII
 * drin ist (z.B. Umlaute im Betreff oder Absender-Namen). Sonst raw.
 */
function encodeHeaderValue(s: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  const b64 = Buffer.from(s, 'utf8').toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}
