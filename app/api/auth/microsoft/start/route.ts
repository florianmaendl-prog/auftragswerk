import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/auth/microsoft/start
 *
 * Schritt 1 des Microsoft-OAuth-Flows (Outlook / Microsoft 365). Owner
 * klickt "Mit Outlook verbinden" im Profil, wir leiten zu Microsoft
 * Identity Platform. Wichtig:
 * - `/common` als Authority: lässt Consumer-Outlook.com UND Org-Tenants zu
 * - scope `offline_access` → garantiert refresh_token (Microsoft rotiert!)
 * - state = CSRF-Token in HttpOnly-Cookie, prüfen wir im Callback
 * - scope: nur Mail.Send (nicht Mail.Read – wir lesen NICHT, Inbound
 *   bleibt Postmark-Forward)
 * - prompt=consent erzwingt frische Zustimmung (Owner sieht klar was
 *   gewährt wird)
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', getBaseUrl()));
  }

  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Outlook-OAuth nicht konfiguriert (Env-Vars fehlen)' },
      { status: 500 }
    );
  }

  const state = randomBytes(32).toString('base64url');

  const authUrl = new URL(
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
  );
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set(
    'scope',
    'https://graph.microsoft.com/Mail.Send offline_access openid email'
  );
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set('microsoft_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });
  return response;
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://auftragswerk.app';
}
