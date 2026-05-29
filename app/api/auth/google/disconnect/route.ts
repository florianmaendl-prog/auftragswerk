import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptToken } from '@/lib/crypto';

/**
 * POST /api/auth/google/disconnect
 *
 * User klickt "Verbindung trennen" im Profil. Wir:
 * 1. Token bei Google revoken (best-effort, ignoriert Fehler)
 * 2. gmail_connections-Zeile für diesen Betrieb löschen
 *
 * Reconnect ist jederzeit möglich via /api/auth/google/start.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('betrieb_id')
    .eq('id', user.id)
    .single();
  const betriebId = profile?.betrieb_id as string | null | undefined;
  if (!betriebId) {
    return NextResponse.json({ error: 'Kein Betrieb verknüpft' }, { status: 404 });
  }

  // Aktuelle Connection holen (für Token-Revoke bei Google)
  const { data: conn } = await supabaseAdmin
    .from('gmail_connections')
    .select('refresh_token_encrypted, google_email')
    .eq('betrieb_id', betriebId)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ success: true, info: 'Keine Verbindung vorhanden' });
  }

  // Best-effort Revoke bei Google. Fehler ignorieren – Hauptsache lokal weg.
  try {
    const refreshToken = decryptToken(conn.refresh_token_encrypted);
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `token=${encodeURIComponent(refreshToken)}`,
    });
  } catch (err) {
    console.warn('Google-Revoke fehlgeschlagen (nicht-blockend):', err);
  }

  const { error: deleteError } = await supabaseAdmin
    .from('gmail_connections')
    .delete()
    .eq('betrieb_id', betriebId);

  if (deleteError) {
    return NextResponse.json(
      { error: 'Löschen fehlgeschlagen', details: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, google_email: conn.google_email });
}
