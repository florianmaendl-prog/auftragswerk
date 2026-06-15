import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { syncGoogleCalendarBusySlots } from '@/lib/google-calendar';

/**
 * GET /api/cron/calendar-sync
 *
 * Vercel-Cron, schedule "*\/15 * * * *" (alle 15 Min). Iteriert über
 * alle gmail_connections mit calendar_sync_aktiv=true und syncronisiert
 * deren primären Google-Calendar in kalender_busy_slots.
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
