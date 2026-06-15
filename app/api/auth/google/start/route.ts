import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/auth/google/start
 *
 * Schritt 1 des OAuth-Flows. User klickt "Mit Gmail verbinden" im Profil,
 * wir leiten zu Google Consent. Wichtig:
 * - access_type=offline + prompt=consent → garantiert refresh_token
 *   (sonst gibt's nur access_token mit 1h Lebensdauer)
 * - state = CSRF-Token in HttpOnly-Cookie, prüfen wir im Callback
 * - scope: nur gmail.send (nicht modify/readonly – wir lesen NICHT)
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', getBaseUrl()));
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Gmail-OAuth nicht konfiguriert (Env-Vars fehlen)' },
      { status: 500 }
    );
  }

  const state = randomBytes(32).toString('base64url');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  // Scope erweitert um calendar.readonly (Welle P6 – Auto-Verfügbarkeit).
  // Bewusst nur readonly: wir lesen Free/Busy-Slots, schreiben aber NIE
  // in den Google-Calendar des Owners (Iron Rule).
  authUrl.searchParams.set(
    'scope',
    'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.readonly openid email'
  );
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('include_granted_scopes', 'true');

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60, // 10 Min – mehr als genug für den Consent-Flow
  });
  return response;
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://auftragswerk.app';
}
