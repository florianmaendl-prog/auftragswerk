import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Sender sperren – aus Kunden-Liste oder Inbox.
 *
 * 1. Email in gesperrte_sender eintragen (ON CONFLICT: no-op)
 * 2. Alle vorhandenen Anfragen dieses Absenders im Betrieb auf
 *    'aussortiert' setzen (außer schon aussortiert/erledigt)
 *
 * Inbound-Route prüft beim Mail-Empfang gegen die Tabelle und legt
 * gesperrte Sender direkt als 'aussortiert' an – keine KI-Klassifikation,
 * keine Anthropic-Kosten.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
  }

  let body: { email?: string; grund?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalides JSON' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json(
      { error: 'Gültige email erforderlich' },
      { status: 400 }
    );
  }

  // Betrieb-ID des aktuellen Users holen
  const { data: profile } = await supabase
    .from('profiles')
    .select('betrieb_id')
    .eq('id', user.id)
    .single();

  const betriebId = profile?.betrieb_id as string | undefined;
  if (!betriebId) {
    return NextResponse.json({ error: 'Kein Betrieb verknüpft' }, { status: 400 });
  }

  // 1. Sperreintrag anlegen (idempotent)
  const { error: insertError } = await supabaseAdmin
    .from('gesperrte_sender')
    .upsert(
      {
        betrieb_id: betriebId,
        email,
        grund: body.grund?.trim() || null,
      },
      { onConflict: 'betrieb_id,email' }
    );

  if (insertError) {
    return NextResponse.json(
      { error: `Sperreintrag fehlgeschlagen: ${insertError.message}` },
      { status: 500 }
    );
  }

  // 2. Alle bestehenden Anfragen dieses Absenders aussortieren – außer
  //    bereits erledigte oder schon aussortierte (kein unnötiges Update).
  //    select('id') liefert die geupdateten Rows zurück → .length zählt.
  const { data: aussortierteRows } = await supabaseAdmin
    .from('anfragen')
    .update({ status: 'aussortiert' })
    .eq('betrieb_id', betriebId)
    .ilike('von_email', email)
    .not('status', 'in', '(aussortiert,erledigt)')
    .select('id');

  return NextResponse.json({
    success: true,
    email,
    aussortierte_anfragen: aussortierteRows?.length ?? 0,
  });
}
