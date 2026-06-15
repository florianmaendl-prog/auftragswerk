import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/auth/microsoft/disconnect
 *
 * User klickt "Verbindung trennen" im Profil. Wir löschen die Connection
 * lokal. Microsoft hat (anders als Google) keinen Token-Revoke-Endpoint,
 * den wir aus der App aufrufen könnten – Owner muss für vollständiges
 * Revoke selbst in `https://myaccount.microsoft.com/` → "Apps und Dienste"
 * → Auftragswerk entfernen. UI-Hinweis dafür ist in der Profil-Card.
 *
 * Reconnect ist jederzeit möglich via /api/auth/microsoft/start.
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

  const { data: conn } = await supabaseAdmin
    .from('microsoft_connections')
    .select('microsoft_email')
    .eq('betrieb_id', betriebId)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ success: true, info: 'Keine Verbindung vorhanden' });
  }

  const { error: deleteError } = await supabaseAdmin
    .from('microsoft_connections')
    .delete()
    .eq('betrieb_id', betriebId);

  if (deleteError) {
    return NextResponse.json(
      { error: 'Löschen fehlgeschlagen', details: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, microsoft_email: conn.microsoft_email });
}
