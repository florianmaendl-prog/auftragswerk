import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendMail } from '@/lib/postmark';
import { buildIcsForTermin } from '@/lib/ical';

/**
 * GET /api/cron/termine-reminder
 *
 * Vercel-Cron, schedule "0 7 * * *" (täglich 7 Uhr UTC = 9 Uhr Berlin
 * Sommer / 8 Uhr Winter). Lädt alle bestätigten Termine die HEUTE
 * stattfinden und verschickt eine Erinnerung an den Owner mit:
 *   - Subject "Heute 14:00 – Aufmaß Familie Schmidt"
 *   - Body mit Termin-Daten + Kunde + Direktlink zur Anfrage
 *   - iCal-Anhang damit Owner direkt in seinen Kalender importieren kann
 *
 * Vercel-Cron setzt `Authorization: Bearer <CRON_SECRET>` aus den
 * Vercel-Env-Vars. Wir prüfen das, damit niemand die Route von außen
 * anschießen kann (sonst Spam-Risk an Owner-Postfach).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    console.warn('⛔ termine-reminder: nicht autorisiert');
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  // Heute in UTC bestimmen (Vercel-Cron läuft in UTC, Termin-Datum ist TIMESTAMPTZ)
  const heute = new Date();
  const startHeute = new Date(
    Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate(), 0, 0, 0)
  );
  const startMorgen = new Date(startHeute.getTime() + 24 * 60 * 60 * 1000);

  const { data: termine, error } = await supabaseAdmin
    .from('termine')
    .select(
      `id, anfrage_id, betrieb_id, datum, dauer_min, ort, notiz, status,
       anfragen (von_name, von_email, betreff),
       betriebe (id, name)`
    )
    .eq('status', 'bestaetigt')
    .gte('datum', startHeute.toISOString())
    .lt('datum', startMorgen.toISOString());

  if (error) {
    console.error('termine-reminder Query-Fehler:', error.message);
    return NextResponse.json(
      { error: 'Query fehlgeschlagen', details: error.message },
      { status: 500 }
    );
  }

  type TerminRow = {
    id: string;
    anfrage_id: string;
    betrieb_id: string;
    datum: string;
    dauer_min: number;
    ort: string | null;
    notiz: string | null;
    anfragen: { von_name: string | null; von_email: string; betreff: string | null } | null;
    betriebe: { id: string; name: string | null } | null;
  };

  const rows = (termine ?? []) as unknown as TerminRow[];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auftragswerk.app';

  let sent = 0;
  let failed = 0;

  for (const t of rows) {
    // Owner-Email finden: profiles.id → auth.users.email via Admin-API
    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('betrieb_id', t.betrieb_id)
      .limit(1)
      .single();

    if (!ownerProfile?.id) {
      console.warn(`termine-reminder: kein Owner-Profil für betrieb=${t.betrieb_id}`);
      failed++;
      continue;
    }
    const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(
      ownerProfile.id
    );
    const ownerEmail = userInfo?.user?.email;
    if (!ownerEmail) {
      console.warn(`termine-reminder: keine Owner-Email für user=${ownerProfile.id}`);
      failed++;
      continue;
    }

    const datum = new Date(t.datum);
    const zeit = datum.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Berlin',
    });
    const datumStr = datum.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Europe/Berlin',
    });

    const kunde = t.anfragen?.von_name || t.anfragen?.von_email || 'Kunde';
    const subject = `Heute ${zeit} – Termin mit ${kunde}`;
    const link = `${baseUrl}/dashboard/anfragen/${t.anfrage_id}`;

    const bodyText = [
      `Heute Termin um ${zeit} Uhr (${datumStr})`,
      ``,
      `Kunde: ${kunde}`,
      `Mail:  ${t.anfragen?.von_email ?? '–'}`,
      t.ort ? `Ort:   ${t.ort}` : null,
      t.notiz ? `Notiz: ${t.notiz}` : null,
      ``,
      `Anfrage öffnen:`,
      link,
      ``,
      `– Auftragswerk Termin-Erinnerung`,
    ]
      .filter((l) => l !== null)
      .join('\n');

    const end = new Date(datum.getTime() + (t.dauer_min ?? 60) * 60 * 1000);
    const ics = buildIcsForTermin({
      uid: `${t.id}@auftragswerk.app`,
      start: datum,
      end,
      summary: subject,
      location: t.ort,
      description: `Anfrage: ${t.anfragen?.betreff ?? ''}\n${link}`,
      organizerName: t.betriebe?.name ?? undefined,
    });
    const icsBase64 = Buffer.from(ics, 'utf8').toString('base64');

    const res = await sendMail({
      to: ownerEmail,
      subject,
      bodyText,
      tag: 'termine-reminder',
      metadata: {
        termin_id: t.id,
        anfrage_id: t.anfrage_id,
        betrieb_id: t.betrieb_id,
      },
      attachments: [
        {
          name: 'termin.ics',
          contentBase64: icsBase64,
          contentType: 'text/calendar',
        },
      ],
    });

    if (res.success) sent++;
    else {
      failed++;
      console.error(`termine-reminder Versand fehlgeschlagen (termin=${t.id}):`, res.error);
    }
  }

  console.log(`📅 termine-reminder: ${sent} verschickt, ${failed} fehlgeschlagen, ${rows.length} gesamt`);
  return NextResponse.json({ success: true, sent, failed, total: rows.length });
}
