import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendMail } from '@/lib/postmark';

/**
 * GET /api/cron/fehler-digest
 *
 * Vercel-Cron, schedule "0 8 * * *" (täglich 8 Uhr UTC = 10 Uhr Berlin).
 *
 * Aus Sprint-2-Review: 21 stille processing_errors + 29 offene
 * manuell_pruefen-Anfragen. Niemand hat die Diagnose-Seite angeschaut,
 * weil sie Pull statt Push ist. Dieser Cron dreht das um: sobald in
 * den letzten 24h Fehler auftraten, kommt EINE Mail an den Owner mit
 * kurzer Auflistung + Link zur Diagnose-Seite.
 *
 * Prinzip aus STRATEGIE.md: "stille Erfolge, laute Fehler". Kein Mail
 * an einen Betrieb ohne Fehler – der Digest soll Signal sein, nicht
 * Rauschen.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const fensterAb = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: fehler, error } = await supabaseAdmin
    .from('processing_errors')
    .select('id, betrieb_id, anfrage_id, schritt, fehler_text, created_at')
    .gte('created_at', fensterAb)
    .not('betrieb_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: 'Query fehlgeschlagen', details: error.message },
      { status: 500 }
    );
  }

  type Row = {
    id: string;
    betrieb_id: string;
    anfrage_id: string | null;
    schritt: string;
    fehler_text: string;
    created_at: string;
  };
  const alle = (fehler ?? []) as Row[];

  // Pro Betrieb gruppieren – eine Mail pro Betrieb, nicht pro Fehler
  const proBetrieb = new Map<string, Row[]>();
  for (const f of alle) {
    const slot = proBetrieb.get(f.betrieb_id) ?? [];
    slot.push(f);
    proBetrieb.set(f.betrieb_id, slot);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auftragswerk.app';
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const [betriebId, items] of proBetrieb) {
    // Owner-Email via profiles → auth.users
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('betrieb_id', betriebId)
      .limit(1)
      .single();
    if (!profile?.id) {
      skipped++;
      continue;
    }
    const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(
      profile.id
    );
    const ownerEmail = userInfo?.user?.email;
    if (!ownerEmail) {
      skipped++;
      continue;
    }

    // Aufschlüsselung nach schritt
    const proSchritt = new Map<string, number>();
    for (const f of items) {
      proSchritt.set(f.schritt, (proSchritt.get(f.schritt) ?? 0) + 1);
    }
    const schrittZeilen = [...proSchritt.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([schritt, count]) => `  ${count}× ${schritt}`);

    const body = [
      `Hallo,`,
      ``,
      `in den letzten 24 Stunden ${
        items.length === 1
          ? 'ist ein Fehler'
          : `sind ${items.length} Fehler`
      } aufgetreten. Kurzübersicht:`,
      ``,
      ...schrittZeilen,
      ``,
      `Details + Absender im Dashboard:`,
      `${baseUrl}/dashboard/diagnose`,
      ``,
      `Meistens Timing-Aussetzer beim KI-Aufruf, die sich beim Neuladen der Anfrage von selbst erledigen. Wenn ein Muster auffällt (z.B. immer dieselbe Fehler-Zeile), lohnt sich ein Blick.`,
      ``,
      `– Auftragswerk`,
    ].join('\n');

    const res = await sendMail({
      to: ownerEmail,
      subject: `${items.length} ${
        items.length === 1
          ? 'Fehler in 24h'
          : 'Fehler in den letzten 24h'
      } – Diagnose ansehen`,
      bodyText: body,
      tag: 'fehler-digest',
      metadata: { betrieb_id: betriebId, fehler_anzahl: String(items.length) },
    });
    if (res.success) sent++;
    else failed++;
  }

  console.log(
    `fehler-digest: ${sent} verschickt, ${failed} fail, ${skipped} skipped, ${alle.length} fehler in 24h`
  );
  return NextResponse.json({
    success: true,
    sent,
    failed,
    skipped,
    total_fehler_24h: alle.length,
    total_betriebe: proBetrieb.size,
  });
}
