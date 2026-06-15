import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { encryptToken } from '@/lib/crypto';

/**
 * GET /api/auth/google/callback?code=...&state=...
 *
 * Schritt 2 des OAuth-Flows. Google leitet hierher nach Consent.
 * 1. State-Cookie prüfen (CSRF-Schutz)
 * 2. code → tokens tauschen
 * 3. id_token decoden → google_email
 * 4. tokens verschlüsseln, in gmail_connections UPSERT
 * 5. Redirect zu /dashboard/profil?gmail=connected
 *
 * Fehler-Flow: Redirect mit ?gmail=error&reason=... als Query-Param,
 * Profil-Page zeigt dann Toast.
 */
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auftragswerk.app';
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  // Google selbst meldet einen Fehler (z.B. User hat abgebrochen)
  if (errorParam) {
    return redirectToProfile(baseUrl, 'error', errorParam);
  }

  if (!code || !state) {
    return redirectToProfile(baseUrl, 'error', 'missing_params');
  }

  // CSRF-Check
  const cookieState = req.cookies.get('google_oauth_state')?.value;
  if (!cookieState || cookieState !== state) {
    return redirectToProfile(baseUrl, 'error', 'invalid_state');
  }

  // User holen (eingeloggt sein zum Verbinden zwingend)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', baseUrl));
  }

  // Betrieb-ID holen (für UPSERT-Scope)
  const { data: profile } = await supabase
    .from('profiles')
    .select('betrieb_id')
    .eq('id', user.id)
    .single();
  const betriebId = profile?.betrieb_id as string | null | undefined;
  if (!betriebId) {
    return redirectToProfile(baseUrl, 'error', 'no_betrieb');
  }

  // Env-Vars
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return redirectToProfile(baseUrl, 'error', 'config_missing');
  }

  // Code gegen Tokens tauschen
  let tokenResponse: TokenExchangeResult;
  try {
    tokenResponse = await tauscheCodeGegenTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });
  } catch (err) {
    console.error('Google Token Exchange fehlgeschlagen:', err);
    return redirectToProfile(baseUrl, 'error', 'token_exchange_failed');
  }

  // id_token decoden → google_email
  const googleEmail = extractEmailFromIdToken(tokenResponse.id_token);
  if (!googleEmail) {
    return redirectToProfile(baseUrl, 'error', 'email_extract_failed');
  }

  // Tokens verschlüsseln
  let accessEncrypted: string;
  let refreshEncrypted: string;
  try {
    accessEncrypted = encryptToken(tokenResponse.access_token);
    if (!tokenResponse.refresh_token) {
      // Sollte mit prompt=consent immer kommen – sonst können wir später
      // nicht refreshen, also abbrechen.
      return redirectToProfile(baseUrl, 'error', 'no_refresh_token');
    }
    refreshEncrypted = encryptToken(tokenResponse.refresh_token);
  } catch (err) {
    console.error('Token-Verschlüsselung fehlgeschlagen:', err);
    return redirectToProfile(baseUrl, 'error', 'encryption_failed');
  }

  const expiry = new Date(
    Date.now() + (tokenResponse.expires_in - 60) * 1000
  ).toISOString();

  // Wenn calendar.readonly im Scope-String steht, aktivieren wir den
  // Auto-Verfügbarkeits-Sync für diese Verbindung (Welle P6).
  const calendarSyncAktiv = (tokenResponse.scope ?? '').includes(
    'calendar.readonly'
  );

  // UPSERT in gmail_connections (UNIQUE betrieb_id → reconnect überschreibt)
  const { error: upsertError } = await supabaseAdmin
    .from('gmail_connections')
    .upsert(
      {
        betrieb_id: betriebId,
        google_email: googleEmail,
        access_token_encrypted: accessEncrypted,
        refresh_token_encrypted: refreshEncrypted,
        token_expiry: expiry,
        scope: tokenResponse.scope,
        status: 'aktiv',
        letzter_fehler: null,
        calendar_sync_aktiv: calendarSyncAktiv,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'betrieb_id' }
    );

  if (upsertError) {
    console.error('gmail_connections UPSERT failed:', upsertError);
    return redirectToProfile(baseUrl, 'error', 'db_upsert_failed');
  }

  // Erfolg – State-Cookie löschen, Toast-Param setzen
  const response = redirectToProfile(baseUrl, 'connected', googleEmail);
  response.cookies.set('google_oauth_state', '', { path: '/', maxAge: 0 });
  return response;
}

function redirectToProfile(
  baseUrl: string,
  status: 'connected' | 'error',
  detail: string
) {
  const target = new URL('/dashboard/profil', baseUrl);
  target.searchParams.set('gmail', status);
  if (detail) target.searchParams.set('detail', detail);
  return NextResponse.redirect(target);
}

type TokenExchangeResult = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  id_token: string;
  token_type: string;
};

async function tauscheCodeGegenTokens(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenExchangeResult> {
  const params = new URLSearchParams();
  params.set('code', opts.code);
  params.set('client_id', opts.clientId);
  params.set('client_secret', opts.clientSecret);
  params.set('redirect_uri', opts.redirectUri);
  params.set('grant_type', 'authorization_code');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google token-endpoint ${res.status}: ${txt.slice(0, 200)}`);
  }

  return (await res.json()) as TokenExchangeResult;
}

/**
 * Dekodiert das id_token (JWT) ohne Signatur-Verifikation – wir brauchen
 * nur die Email-Claim. Da das Token direkt von Google über TLS kommt
 * (kein User-Input dazwischen), ist Signatur-Check hier nicht kritisch.
 */
function extractEmailFromIdToken(idToken: string): string | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    );
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}
