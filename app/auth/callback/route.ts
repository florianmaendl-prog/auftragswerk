import { createServerClient } from '@supabase/ssr';
import { type EmailOtpType } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  // Response vorbauen — Cookies werden direkt darauf gesetzt
  const response = NextResponse.redirect(`${origin}${next}`);

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Auf BEIDES schreiben: cookieStore (für diesen Request) + response (für den Browser)
            cookieStore.set(name, value, options);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Neuer Flow: Token-Hash (Mail-Wrapper-resistent)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return response;
    }
    console.error('verifyOtp error:', error.message);
  }

  // Fallback: alter PKCE-Flow
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    console.error('exchangeCodeForSession error:', error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}