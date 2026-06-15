/**
 * Microsoft Graph Mail-Versand für Auftragswerk.
 *
 * Premium-Pivot Outlook-Pfad: Mail kommt aus dem echten Microsoft-365/
 * Outlook.com-Account des Owners (Scope Mail.Send + offline_access).
 * Inbound bleibt Postmark-Forward — wir senden hier NUR.
 *
 * Spiegelt die API-Form von `lib/gmail.ts` damit die Versand-Routes
 * symmetrisch beide Provider ansprechen können (drop-in).
 *
 * Iron Rules:
 * - Tokens nie plain loggen oder in processing_errors schreiben
 * - Microsoft rotiert refresh_token bei jedem Refresh → neu speichern
 * - Eigene UUID-Message-ID intern (Threading-Konsistenz mit DB), echte
 *   Message-ID im Header setzt Microsoft selbst (Graph API erlaubt
 *   Standard-Header nicht via internetMessageHeaders)
 * - Bei 401 → einmal Refresh + Retry, dann Fehler
 * - Bei dauerhaftem 4xx → microsoft_connections.status='fehler' +
 *   Aufrufer fällt auf Postmark zurück
 */

import { randomUUID } from 'node:crypto';
import { decryptToken, encryptToken } from './crypto';
import { supabaseAdmin } from './supabase';

export type MicrosoftSendOptions = {
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

export type MicrosoftSendResult = {
  success: boolean;
  messageId?: string; // unsere eigene UUID-Message-ID (Threading-Konsistenz)
  error?: string;
  // Wenn 'fehler-permanent', soll der Aufrufer auf Postmark fallback
  shouldFallback?: boolean;
};

// `/common` lässt sowohl Consumer-Outlook.com als auch Org-Tenants zu.
// Falls später Org-only-Setups nötig sind (z.B. ein Tenant erlaubt nur
// internen Multi-Tenant-Modus), kann hier auf `/organizations` oder
// die konkrete tenant_id umgestellt werden.
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const SEND_URL = 'https://graph.microsoft.com/v1.0/me/sendMail';

export async function getValidAccessToken(betriebId: string): Promise<{
  accessToken: string;
  microsoftEmail: string;
}> {
  const { data: conn, error: connError } = await supabaseAdmin
    .from('microsoft_connections')
    .select(
      'id, access_token_encrypted, refresh_token_encrypted, token_expiry, microsoft_email, status'
    )
    .eq('betrieb_id', betriebId)
    .maybeSingle();

  if (connError || !conn) {
    throw new Error('microsoft_connections nicht gefunden für betrieb');
  }
  if (conn.status !== 'aktiv') {
    throw new Error(`microsoft_connection-Status: ${conn.status}`);
  }

  const expiry = new Date(conn.token_expiry).getTime();
  const jetzt = Date.now();
  if (expiry - jetzt > 60_000) {
    return {
      accessToken: decryptToken(conn.access_token_encrypted),
      microsoftEmail: conn.microsoft_email,
    };
  }

  const refreshToken = decryptToken(conn.refresh_token_encrypted);
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('MICROSOFT_OAUTH-Env-Vars fehlen');
  }

  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);
  params.set('refresh_token', refreshToken);
  params.set('grant_type', 'refresh_token');
  // Scope MUSS bei Refresh wieder mitgeschickt werden, sonst kommt
  // ein Token mit reduziertem Scope zurück.
  params.set('scope', 'https://graph.microsoft.com/Mail.Send offline_access openid email');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 400 || res.status === 401) {
      await supabaseAdmin
        .from('microsoft_connections')
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
    refresh_token?: string; // Microsoft rotiert refresh_token!
    expires_in: number;
    scope?: string;
    token_type?: string;
  };

  const neuesExpiry = new Date(
    Date.now() + (refreshData.expires_in - 60) * 1000
  ).toISOString();

  const update: Record<string, string> = {
    access_token_encrypted: encryptToken(refreshData.access_token),
    token_expiry: neuesExpiry,
    updated_at: new Date().toISOString(),
  };
  // Bei Microsoft kann pro Refresh ein neuer refresh_token kommen
  // (Rotation). Wenn ja: ersetzen, sonst alten behalten.
  if (refreshData.refresh_token) {
    update.refresh_token_encrypted = encryptToken(refreshData.refresh_token);
  }

  await supabaseAdmin.from('microsoft_connections').update(update).eq('id', conn.id);

  return {
    accessToken: refreshData.access_token,
    microsoftEmail: conn.microsoft_email,
  };
}

export async function sendeViaMicrosoft(
  betriebId: string,
  opts: MicrosoftSendOptions
): Promise<MicrosoftSendResult> {
  const ownMessageId = `<${randomUUID()}@auftragswerk.app>`;

  let tokenInfo: { accessToken: string; microsoftEmail: string };
  try {
    tokenInfo = await getValidAccessToken(betriebId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token-Holen fehlgeschlagen';
    return { success: false, error: msg, shouldFallback: true };
  }

  const payload = buildGraphSendPayload({
    ...opts,
    fromEmail: opts.fromEmail || tokenInfo.microsoftEmail,
    ownMessageId,
  });

  let res = await fetch(SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenInfo.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    try {
      await supabaseAdmin
        .from('microsoft_connections')
        .update({ token_expiry: new Date(0).toISOString() })
        .eq('betrieb_id', betriebId);
      tokenInfo = await getValidAccessToken(betriebId);
      res = await fetch(SEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenInfo.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '401-Retry failed';
      return { success: false, error: msg, shouldFallback: true };
    }
  }

  // Graph API antwortet auf sendMail mit 202 Accepted (kein Body)
  if (!res.ok) {
    const txt = await res.text();
    const isPermanent = res.status >= 400 && res.status < 500;
    if (isPermanent) {
      await supabaseAdmin
        .from('microsoft_connections')
        .update({
          status: 'fehler',
          letzter_fehler: `send-${res.status}: ${txt.slice(0, 200)}`,
          updated_at: new Date().toISOString(),
        })
        .eq('betrieb_id', betriebId);
    }
    return {
      success: false,
      error: `Microsoft-Graph ${res.status}: ${txt.slice(0, 200)}`,
      shouldFallback: isPermanent,
    };
  }

  return {
    success: true,
    messageId: ownMessageId,
  };
}

/**
 * Baut den Microsoft-Graph-sendMail-Payload (JSON statt RFC822).
 *
 * Wichtig: Graph API erlaubt KEINE Standard-Threading-Header
 * (Message-ID, In-Reply-To, References) via `internetMessageHeaders` —
 * dort sind nur `x-*`-Custom-Header zugelassen, der Rest wird ignoriert.
 * Microsoft setzt selbst eine Message-ID. Threading-Konsistenz machen
 * wir über Subject-Prefix ("AW:") + den Reply-To-Mechanismus
 * (Empfänger antwortet an unsere inbound_email-Subdomain, von dort
 * wieder via Postmark-Webhook in unseren Thread).
 *
 * Custom-Header `x-auftragswerk-id` setzen wir trotzdem für Debug-
 * Zwecke (Mail-Header sind im Quelltext lesbar).
 */
function buildGraphSendPayload(
  opts: MicrosoftSendOptions & { ownMessageId: string }
) {
  const headers: Array<{ name: string; value: string }> = [
    { name: 'x-auftragswerk-id', value: opts.ownMessageId },
  ];
  if (opts.inReplyTo) {
    headers.push({ name: 'x-auftragswerk-in-reply-to', value: opts.inReplyTo });
  }
  if (opts.references && opts.references.length > 0) {
    const capped =
      opts.references.length > 10
        ? [opts.references[0], ...opts.references.slice(-9)]
        : opts.references;
    headers.push({
      name: 'x-auftragswerk-references',
      value: capped.join(' '),
    });
  }

  type AttachmentJson = {
    '@odata.type': string;
    name: string;
    contentType: string;
    contentBytes: string;
  };

  const attachments: AttachmentJson[] =
    opts.attachments?.map((att) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.name || 'datei',
      contentType: att.contentType || 'application/octet-stream',
      contentBytes: att.contentBase64,
    })) ?? [];

  const message: Record<string, unknown> = {
    subject: opts.subject,
    body: {
      contentType: 'Text',
      content: opts.bodyText,
    },
    toRecipients: [
      {
        emailAddress: opts.toName
          ? { address: opts.to, name: opts.toName }
          : { address: opts.to },
      },
    ],
    from: {
      emailAddress: opts.fromName
        ? { address: opts.fromEmail, name: opts.fromName }
        : { address: opts.fromEmail },
    },
    internetMessageHeaders: headers,
  };

  if (opts.replyTo) {
    message.replyTo = [
      {
        emailAddress: opts.replyToName
          ? { address: opts.replyTo, name: opts.replyToName }
          : { address: opts.replyTo },
      },
    ];
  }

  if (attachments.length > 0) {
    message.attachments = attachments;
  }

  return {
    message,
    saveToSentItems: true,
  };
}
