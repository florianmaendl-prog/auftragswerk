import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { generiereEntwurf, type ThreadNachricht } from '@/lib/entwurf';

/**
 * Nachfass-Entwurf (Sprint 7, Tag 20).
 *
 * Wenn eine versendete Anfrage >7 Tage ohne Reply ist (Stale-Indikator
 * im Inbox-UI), kann Owner mit 1 Klick einen Nachfass-Entwurf
 * generieren lassen. Die KI baut keine neue Erst-Antwort sondern eine
 * SEHR KURZE, höfliche Erinnerung an die vorherige Mail.
 *
 * Architektur:
 *   1. Lade die komplette Konversation (alle nachrichten chronologisch)
 *   2. Lade Betriebs-Profil für Stil/Vermeiden/Signatur
 *   3. Rufe generiereEntwurf mit nachfassModus=true – das triggert
 *      einen komplett anderen User-Prompt-Branch in lib/entwurf.ts
 *   4. Entwurf landet in entwuerfe als 'wartet_auf_freigabe', Status der
 *      Anfrage geht zurück auf 'entwurf_bereit'
 *
 * Owner kann den Entwurf wie immer editieren oder direkt senden.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: anfrageId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
  }

  // Anfrage holen – RLS prüft Ownership
  const { data: anfrage, error: anfrageError } = await supabase
    .from('anfragen')
    .select(
      'id, betrieb_id, von_email, von_name, betreff, body_text, body_text_clean, status'
    )
    .eq('id', anfrageId)
    .single();

  if (anfrageError || !anfrage) {
    return NextResponse.json(
      { error: 'Anfrage nicht gefunden' },
      { status: 404 }
    );
  }

  // Aktuelle Analyse holen – wird als Klassifikation an generiereEntwurf gegeben
  const { data: klassifikation } = await supabaseAdmin
    .from('analysen')
    .select('*')
    .eq('anfrage_id', anfrageId)
    .order('analysiert_am', { ascending: false })
    .limit(1)
    .single();

  if (!klassifikation) {
    return NextResponse.json(
      { error: 'Keine Klassifikation gefunden' },
      { status: 400 }
    );
  }

  // Betrieb laden
  const { data: betrieb } = await supabaseAdmin
    .from('betriebe')
    .select(
      'id, name, inhaber, branche, was_wir_machen, was_wir_nicht_machen, region, mindestauftragswert, ton_beispiele, vermeiden, signatur, gebiete'
    )
    .eq('id', anfrage.betrieb_id)
    .single();

  if (!betrieb) {
    return NextResponse.json({ error: 'Betrieb nicht gefunden' }, { status: 500 });
  }

  // Komplette Konversation laden – ohne die wäre der Nachfass blind
  const { data: thread } = await supabaseAdmin
    .from('nachrichten')
    .select('typ, von_name, von_email, body_text, erstellt_am')
    .eq('anfrage_id', anfrageId)
    .order('erstellt_am', { ascending: true });

  const konversation = (thread as ThreadNachricht[] | null) || [];

  if (konversation.length === 0) {
    return NextResponse.json(
      { error: 'Kein Konversations-Verlauf vorhanden – Nachfass nicht möglich' },
      { status: 400 }
    );
  }

  // Nachfass generieren – nachfassModus=true triggert speziellen Prompt-Branch
  const entwurfRes = await generiereEntwurf(
    {
      id: anfrage.id,
      von_email: anfrage.von_email,
      von_name: anfrage.von_name,
      betreff: anfrage.betreff,
      body_text: anfrage.body_text,
      body_text_clean: anfrage.body_text_clean,
    },
    klassifikation,
    betrieb,
    konversation,
    undefined, // keine freien Slots im Nachfass – nicht aufdrängen
    undefined, // keine Bilder im Nachfass – wir wiederholen die Erst-Anfrage nicht
    undefined, // keine Kunden-Historie – Nachfass ist im aktuellen Faden
    false, // kein Owner-Override
    true // NACHFASS-MODUS
  );

  if (!entwurfRes.success) {
    return NextResponse.json(
      { error: `Nachfass-Entwurf fehlgeschlagen: ${entwurfRes.error}` },
      { status: 500 }
    );
  }

  // Anfrage-Status auf entwurf_bereit – damit es in Inbox als „Freigabe" landet
  await supabaseAdmin
    .from('anfragen')
    .update({ status: 'entwurf_bereit' })
    .eq('id', anfrageId);

  return NextResponse.json({ success: true });
}
