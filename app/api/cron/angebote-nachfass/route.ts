import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendMail } from '@/lib/postmark';

/**
 * GET /api/cron/angebote-nachfass
 *
 * Vercel-Cron, schedule "0 10 * * 1" (Mo 10 Uhr UTC). Suchst nach
 * Angeboten die seit 14 Tagen status='versendet' sind ohne weitere
 * Status-Änderung – Owner kriegt eine Mail-Erinnerung „Da liegt
 * Angebot X bei Kunde Y, vielleicht nachfassen".
 *
 * Bewusst nur OWNER-Reminder, kein automatischer Nachfass an den
 * Kunden – wir wissen nicht ob der Kunde nach 14 Tagen schon
 * abgesagt hat (z.B. Konkurrenz-Angebot angenommen) oder noch denkt.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const grenze = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const heute = new Date();
  const reminderFenster = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();

  // Angebote 14-21 Tage alt (versendet) – nur ein Reminder, nicht jede Woche
  const { data: angebote, error } = await supabaseAdmin
    .from('angebote')
    .select(
      `id, betrieb_id, anfrage_id, titel, angebotsnummer, versendet_am,
       summe_brutto, anfragen (von_name, von_email)`
    )
    .eq('status', 'versendet')
    .gte('versendet_am', reminderFenster)
    .lte('versendet_am', grenze);

  if (error) {
    return NextResponse.json(
      { error: 'Query fehlgeschlagen', details: error.message },
      { status: 500 }
    );
  }

  type Row = {
    id: string;
    betrieb_id: string;
    titel: string | null;
    angebotsnummer: string | null;
    versendet_am: string;
    summe_brutto: number;
    anfragen: { von_name: string | null; von_email: string } | null;
  };
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auftragswerk.app';

  let sent = 0;
  let failed = 0;

  // Pro Betrieb gruppieren damit Owner nur EINE Mail bekommt mit allen
  // offenen Angeboten – nicht 5 Einzel-Mails.
  const proBetrieb = new Map<string, Row[]>();
  for (const a of (angebote ?? []) as unknown as Row[]) {
    const slot = proBetrieb.get(a.betrieb_id) ?? [];
    slot.push(a);
    proBetrieb.set(a.betrieb_id, slot);
  }

  for (const [betriebId, items] of proBetrieb) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('betrieb_id', betriebId)
      .limit(1)
      .single();
    if (!profile?.id) {
      failed++;
      continue;
    }
    const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    const ownerEmail = userInfo?.user?.email;
    if (!ownerEmail) {
      failed++;
      continue;
    }

    const lines = items.map((a) => {
      const kunde = a.anfragen?.von_name || a.anfragen?.von_email || 'Kunde';
      const tage = Math.floor(
        (heute.getTime() - new Date(a.versendet_am).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const titel = a.angebotsnummer
        ? `${a.angebotsnummer} – ${a.titel ?? '(ohne Titel)'}`
        : a.titel ?? '(ohne Titel)';
      return `- ${titel}  ·  ${kunde}  ·  ${tage} Tage offen  ·  ${baseUrl}/dashboard/angebote/${a.id}`;
    });

    const body = [
      `Hallo,`,
      ``,
      `${items.length} ${items.length === 1 ? 'Angebot' : 'Angebote'} liegt seit ein paar Wochen beim Kunden ohne Rückmeldung. Vielleicht mal kurz nachfragen?`,
      ``,
      ...lines,
      ``,
      `Du kannst pro Angebot im Dashboard den Status auf "angenommen" oder "abgelehnt" setzen – dann verschwindet es aus der Erinnerung.`,
      ``,
      `– Auftragswerk Angebots-Reminder`,
    ].join('\n');

    const res = await sendMail({
      to: ownerEmail,
      subject: `${items.length} ${items.length === 1 ? 'offenes Angebot' : 'offene Angebote'} – vielleicht nachfassen?`,
      bodyText: body,
      tag: 'angebote-nachfass',
      metadata: { betrieb_id: betriebId },
    });
    if (res.success) sent++;
    else failed++;
  }

  console.log(`angebote-nachfass: ${sent} verschickt, ${failed} fail, ${(angebote ?? []).length} offen`);
  return NextResponse.json({
    success: true,
    sent,
    failed,
    total_angebote: (angebote ?? []).length,
  });
}
