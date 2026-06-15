import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { encryptToken } from '@/lib/crypto';

/**
 * GET /api/auth/microsoft/callback?code=...&state=...
 *
 * Schritt 2 des Microsoft-OAuth-Flows. Microsoft Identity leitet hierher
 * nach Consent. Spiegelt die Google-Callback-Logik:
 * 1. State-Cookie prüfen (CSRF-Schutz)
 * 2. code → tokens tauschen (gegen `/common`-Endpoint)
 * 3. id_token decoden → microsoft_email + tenant_id
 * 4. tokens verschlüsseln, in microsoft_connections UPSERT
 * 5. Redirect zu /dashboard/profil?outlook=connected
 */
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auftragswerk.app';
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const errorDesc = url.searchParams.get('error_description');

  if (errorParam) {
    // error_description hat oft den verständlicheren Text
    return redirectToProfile(baseUrl, 'error', errorDesc || errorParam);
  }

  if (!code || !state) {
    return redirectToProfile(baseUrl, 'error', 'missing_params');
  }

  const cookieState = req.cookies.get('microsoft_oauth_state')?.value;
  if (!cookieState || cookieState !== state) {
    return redirectToProfile(baseUrl, 'error', 'invalid_state');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', baseUrl));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('betrieb_id')
    .eq('id', user.id)
    .single();
  const betriebId = profile?.betrieb_id as string | null | undefined;
  if (!betriebId) {
    return redirectToProfile(baseUrl, 'error', 'no_betrieb');
  }

  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return redirectToProfile(baseUrl, 'error', 'config_missing');
  }

  let tokenResponse: TokenExchangeResult;
  try {
    tokenResponse = await tauscheCodeGegenTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });
  } catch (err) {
    console.error('Microsoft Token Exchange fehlgeschlagen:', err);
    return redirectToProfile(baseUrl, 'error', 'token_exchange_failed');
  }

  const idClaims = decodeIdTokenClaims(tokenResponse.id_token);
  // Microsoft-Email kann in `email`, `preferred_username` oder `upn` stehen
  const microsoftEmail =
    idClaims?.email || idClaims?.preferred_username || idClaims?.upn || null;
  if (!microsoftEmail) {
    return redirectToProfile(baseUrl, 'error', 'email_extract_failed');
  }
  const tenantId = idClaims?.tid ?? null;

  let accessEncrypted: string;
  let refreshEncrypted: string;
  try {
    accessEncrypted = encryptToken(tokenResponse.access_token);
    if (!tokenResponse.refresh_token) {
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

  const { error: upsertError } = await supabaseAdmin
    .from('microsoft_connections')
    .upsert(
      {
        betrieb_id: betriebId,
        microsoft_email: microsoftEmail,
        tenant_id: tenantId,
        access_token_encrypted: accessEncrypted,
        refresh_token_encrypted: refreshEncrypted,
        token_expiry: expiry,
        scope: tokenResponse.scope,
        status: 'aktiv',
        letzter_fehler: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'betrieb_id' }
    );

  if (upsertError) {
    console.error('microsoft_connections UPSERT failed:', upsertError);
    return redirectToProfile(baseUrl, 'error', 'db_upsert_failed');
  }

  const response = redirectToProfile(baseUrl, 'connected', microsoftEmail);
  response.cookies.set('microsoft_oauth_state', '', { path: '/', maxAge: 0 });
  return response;
}

function redirectToProfile(
  baseUrl: string,
  status: 'connected' | 'error',
  detail: string
) {
  const target = new URL('/dashboard/profil', baseUrl);
  target.searchParams.set('outlook', status);
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
  // Scope nochmal mitschicken – Microsoft erwartet das auch im Code-Exchange
  params.set(
    'scope',
    'https://graph.microsoft.com/Mail.Send offline_access openid email'
  );

  const res = await fetch(
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Microsoft token-endpoint ${res.status}: ${txt.slice(0, 200)}`);
  }

  return (await res.json()) as TokenExchangeResult;
}

type IdClaims = {
  email?: string;
  preferred_username?: string;
  upn?: string;
  tid?: string;
};

function decodeIdTokenClaims(idToken: string): IdClaims | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    );
    return payload as IdClaims;
  } catch {
    return null;
  }
}
