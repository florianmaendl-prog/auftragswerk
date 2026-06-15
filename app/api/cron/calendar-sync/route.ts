import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { syncGoogleCalendarBusySlots } from '@/lib/google-calendar';

/**
 * GET /api/cron/calendar-sync
 *
 * STATUS: DEAKTIVIERT (vercel.json hat keinen Cron-Eintrag mehr).
 *
 * Calendar-Sync wurde auf "warten bis Owner-Bedarf" gesetzt – wir hatten
 * das Feature gebaut bevor ein echter Pilot „Verfügbarkeit pflegen ist
 * nervig" gesagt hat (Eisschrank-Trigger nicht gefallen). Plus: Google
 * verlangt für calendar.readonly App-Verification (Demo-Video + Privacy-
 * Policy), das ist Wochen-Prozess und für ein ungetestetes Feature zu
 * teuer.
 *
 * Reaktivieren wenn:
 *   1. mindestens ein Pilot explizit "Verfügbarkeit nervt" sagt, UND
 *   2. Google-Verification beantragt + durch ist.
 * Dann hier in vercel.json wieder eintragen, scope in start-Route
 * erweitern, banner in kalender/page.tsx aktivieren.
 *
 * Lib-Code (lib/google-calendar.ts) + Migration kalender_busy_slots
 * bleiben drin als Reserve.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const { data: connections, error } = await supabaseAdmin
    .from('gmail_connections')
    .select('betrieb_id, google_email')
    .eq('status', 'aktiv')
    .eq('calendar_sync_aktiv', true);

  if (error) {
    return NextResponse.json(
      { error: 'Connections-Query fehlgeschlagen', details: error.message },
      { status: 500 }
    );
  }

  let ok = 0;
  let fail = 0;
  let totalSlots = 0;

  for (const c of connections ?? []) {
    const result = await syncGoogleCalendarBusySlots({
      betriebId: c.betrieb_id,
    });
    if (result.ok) {
      ok++;
      totalSlots += result.count;
    } else {
      fail++;
      console.warn(
        `calendar-sync fehlgeschlagen (betrieb=${c.betrieb_id}, email=${c.google_email}): ${result.error}`
      );
    }
  }

  console.log(
    `calendar-sync: ${ok} ok, ${fail} fail, ${totalSlots} busy-slots gesamt`
  );
  return NextResponse.json({
    success: true,
    ok,
    fail,
    total_busy_slots: totalSlots,
    connections: connections?.length ?? 0,
  });
}
