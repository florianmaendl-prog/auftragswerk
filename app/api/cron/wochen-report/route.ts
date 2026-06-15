import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendMail } from '@/lib/postmark';

/**
 * GET /api/cron/wochen-report
 *
 * Vercel-Cron, schedule "0 8 * * 1" (Montags 8 Uhr UTC). Schickt jedem
 * Owner einen kurzen Wochen-Report über die vorige Woche mit ehrlichen
 * Counts – KEINE erfundenen "X Stunden gespart"-Zahlen (gleiches Prinzip
 * wie die Aktivitäts-Karte: smarte Handwerker durchschauen Bullshit-
 * Kalkulation sofort, wir bauen Stolz-Trigger statt Hersteller-Story).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    console.warn('⛔ wochen-report: nicht autorisiert');
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  // Voriger Mo 00:00 bis So 23:59 UTC – Cron läuft Mo morgens, wir
  // reporten die voll abgeschlossene Vorwoche.
  const heute = new Date();
  const heuteUtc = new Date(
    Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate(), 0, 0, 0)
  );
  // Wenn heute Montag ist (getUTCDay=1), gehen wir 7 Tage zurück → letzter Montag.
  const offsetToMonday = (heuteUtc.getUTCDay() + 6) % 7;
  const dieserMo = new Date(
    heuteUtc.getTime() - offsetToMonday * 24 * 60 * 60 * 1000
  );
  const vorigerMo = new Date(dieserMo.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { data: betriebe, error: betriebeErr } = await supabaseAdmin
    .from('betriebe')
    .select('id, name');
  if (betriebeErr || !betriebe) {
    return NextResponse.json(
      { error: 'Betrieb-Query fehlgeschlagen', details: betriebeErr?.message },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auftragswerk.app';
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const b of betriebe) {
    // Counts für diesen Betrieb in der Vorwoche
    const [anfragen, nachrichten, termine, entwuerfe] = await Promise.all([
      supabaseAdmin
        .from('anfragen')
        .select('id', { count: 'exact', head: true })
        .eq('betrieb_id', b.id)
        .gte('created_at', vorigerMo.toISOString())
        .lt('created_at', dieserMo.toISOString()),
      supabaseAdmin
        .from('nachrichten')
        .select('id', { count: 'exact', head: true })
        .eq('betrieb_id', b.id)
        .eq('typ', 'ausgang')
        .gte('versendet_am', vorigerMo.toISOString())
        .lt('versendet_am', dieserMo.toISOString()),
      supabaseAdmin
        .from('termine')
        .select('id', { count: 'exact', head: true })
        .eq('betrieb_id', b.id)
        .eq('status', 'bestaetigt')
        .gte('updated_at', vorigerMo.toISOString())
        .lt('updated_at', dieserMo.toISOString()),
      supabaseAdmin
        .from('entwuerfe')
        .select('was_edited')
        .eq('betrieb_id', b.id)
        .gte('versendet_am', vorigerMo.toISOString())
        .lt('versendet_am', dieserMo.toISOString()),
    ]);

    const anfragenCount = anfragen.count ?? 0;
    const antwortenCount = nachrichten.count ?? 0;
    const termineCount = termine.count ?? 0;
    const entwuerfeRows = (entwuerfe.data ?? []) as Array<{ was_edited: boolean | null }>;
    const ungeaendert = entwuerfeRows.filter((e) => e.was_edited === false).length;

    // Wenn nichts passiert ist, gar nicht mailen (kein Spam)
    if (anfragenCount === 0 && antwortenCount === 0 && termineCount === 0) {
      skipped++;
      continue;
    }

    // Owner-Email
    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('betrieb_id', b.id)
      .limit(1)
      .single();
    if (!ownerProfile?.id) {
      skipped++;
      continue;
    }
    const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(
      ownerProfile.id
    );
    const ownerEmail = userInfo?.user?.email;
    if (!ownerEmail) {
      skipped++;
      continue;
    }

    const vorwocheLabel = `${vorigerMo.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Europe/Berlin',
    })} – ${new Date(dieserMo.getTime() - 1).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Europe/Berlin',
    })}`;

    const body = [
      `Deine Woche im Überblick (${vorwocheLabel})`,
      ``,
      `${anfragenCount} ${anfragenCount === 1 ? 'Anfrage' : 'Anfragen'} reingekommen`,
      `${antwortenCount} ${antwortenCount === 1 ? 'Antwort' : 'Antworten'} versendet`,
      `${termineCount} ${termineCount === 1 ? 'Termin' : 'Termine'} fest`,
      antwortenCount > 0
        ? `${ungeaendert} ${ungeaendert === 1 ? 'Entwurf' : 'Entwürfe'} ohne Anpassung versendet (KI-Treffer)`
        : null,
      ``,
      `Dashboard:`,
      `${baseUrl}/dashboard`,
      ``,
      `– Auftragswerk Wochen-Report`,
    ]
      .filter((l) => l !== null)
      .join('\n');

    const res = await sendMail({
      to: ownerEmail,
      subject: `Auftragswerk – deine Woche (${vorwocheLabel})`,
      bodyText: body,
      tag: 'wochen-report',
      metadata: { betrieb_id: b.id },
    });
    if (res.success) sent++;
    else {
      failed++;
      console.error(`wochen-report Versand fehlgeschlagen (betrieb=${b.id}):`, res.error);
    }
  }

  console.log(`📊 wochen-report: ${sent} verschickt, ${skipped} geskippt, ${failed} fail`);
  return NextResponse.json({
    success: true,
    sent,
    skipped,
    failed,
    total: betriebe.length,
  });
}
