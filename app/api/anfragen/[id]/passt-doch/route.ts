import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { generiereEntwurf } from '@/lib/entwurf';
import { ladeAnhaengeFuerKI } from '@/lib/bilder';
import { ladeKundenHistorie } from '@/lib/kunden-historie';

/**
 * "Passt doch"-Aktion (Sprint 5, Tag 19, aus Pilot-Feedback).
 *
 * Owner ist im Manuell-prüfen-Tab und sieht eine Anfrage die die KI
 * als unklar/passt_nicht klassifiziert hat. Owner weiß: passt doch.
 * Statt manuell den Absage-Entwurf umzuschreiben:
 *   1. Aktuelle Analyse auf gewerk_match='passt' aktualisieren
 *   2. Alten Entwurf löschen
 *   3. generiereEntwurf neu aufrufen → KI nimmt jetzt den "passt"-Pfad
 *      und schreibt eine echte Zusage statt einer Absage
 *   4. Status zurück auf 'entwurf_bereit'
 *
 * Lernen V1: bewusst NICHT auto-generalisieren (das könnte ähnliche
 * Anfragen versehentlich auch als "passt" klassifizieren). Frontend
 * zeigt nach Erfolg einen Toast mit Vorschlag, das Profil zu ergänzen.
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
      'id, betrieb_id, von_email, von_name, betreff, body_text, body_text_clean'
    )
    .eq('id', anfrageId)
    .single();

  if (anfrageError || !anfrage) {
    return NextResponse.json(
      { error: 'Anfrage nicht gefunden' },
      { status: 404 }
    );
  }

  // Aktuelle Analyse holen
  const { data: klassifikation } = await supabaseAdmin
    .from('analysen')
    .select('*')
    .eq('anfrage_id', anfrageId)
    .order('analysiert_am', { ascending: false })
    .limit(1)
    .single();

  if (!klassifikation) {
    return NextResponse.json(
      { error: 'Keine Klassifikation gefunden – kann nicht neu generieren' },
      { status: 400 }
    );
  }

  // 1. Klassifikation auf passt korrigieren (für künftige Re-Reads)
  await supabaseAdmin
    .from('analysen')
    .update({ gewerk_match: 'passt', confidence: 1.0 })
    .eq('id', klassifikation.id);

  // 2. Bestehende Entwürfe für diese Anfrage löschen – wir bauen neu
  await supabaseAdmin.from('entwuerfe').delete().eq('anfrage_id', anfrageId);

  // 3. Betrieb laden (für Entwurfs-Prompt)
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

  // 4. Letzte eingehende Nachricht für Bilder finden
  const { data: letzteEingang } = await supabaseAdmin
    .from('nachrichten')
    .select('id')
    .eq('anfrage_id', anfrageId)
    .eq('typ', 'eingang')
    .order('erstellt_am', { ascending: false })
    .limit(1)
    .single();

  const [visionAnhaenge, kundenHistorie] = await Promise.all([
    letzteEingang
      ? ladeAnhaengeFuerKI(letzteEingang.id).catch(() => [])
      : Promise.resolve([]),
    ladeKundenHistorie(betrieb.id, anfrage.von_email, anfrageId).catch(
      () => []
    ),
  ]);

  // 5. Mit forciertem gewerk_match='passt' neu generieren
  const klassifikationFuerEntwurf = {
    ...klassifikation,
    gewerk_match: 'passt' as const,
  };

  const entwurfRes = await generiereEntwurf(
    {
      id: anfrage.id,
      von_email: anfrage.von_email,
      von_name: anfrage.von_name,
      betreff: anfrage.betreff,
      body_text: anfrage.body_text,
      body_text_clean: anfrage.body_text_clean,
    },
    klassifikationFuerEntwurf,
    betrieb,
    undefined, // Konversation: bei "passt doch" wollen wir frischen Entwurf, keinen Reply-Pfad
    undefined, // freie Slots optional – nicht jetzt nachladen
    visionAnhaenge,
    kundenHistorie,
    true // ownerBestaetigtPassend – Override für Sonnet damit eine echte Zusage rauskommt
  );

  if (!entwurfRes.success) {
    return NextResponse.json(
      { error: `Entwurf neu generieren fehlgeschlagen: ${entwurfRes.error}` },
      { status: 500 }
    );
  }

  // 6. Status auf entwurf_bereit (KI hat in lib/entwurf.ts schon Entwurf
  //    eingefügt, Status muss aber von 'manuell_pruefen' weg)
  await supabaseAdmin
    .from('anfragen')
    .update({ status: 'entwurf_bereit' })
    .eq('id', anfrageId);

  return NextResponse.json({ success: true });
}
