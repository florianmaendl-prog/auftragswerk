/**
 * Google-Calendar-Sync (Welle P6).
 *
 * Liest Free/Busy-Slots aus dem primären Kalender des Owners. Pure
 * read-only: wir schreiben nie zurück (Iron Rule – Auftragswerk bleibt
 * im Google-Account des Owners unsichtbar abgesehen vom OAuth-Eintrag).
 *
 * Sync-Strategie: alle 15 Min via Vercel-Cron. Pro Betrieb mit
 * calendar_sync_aktiv=true wird ein Free/Busy-Query für die nächsten
 * 30 Tage gefahren. Alte kalender_busy_slots werden gelöscht, die
 * frischen reinserted (KISS, keine Diff-Logik nötig).
 */

import { getValidAccessToken } from './gmail';
import { supabaseAdmin } from './supabase';

const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';

type FreeBusySlot = { start: string; end: string };

/**
 * Lädt Free/Busy-Slots für einen Betrieb aus dem primären Google-Kalender
 * und speichert sie in kalender_busy_slots. Returnt die Anzahl der
 * gespeicherten Slots.
 */
export async function syncGoogleCalendarBusySlots(opts: {
  betriebId: string;
  tageVoraus?: number;
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const tageVoraus = opts.tageVoraus ?? 30;

  let token: { accessToken: string; googleEmail: string };
  try {
    token = await getValidAccessToken(opts.betriebId);
  } catch (err) {
    return {
      ok: false,
      error: `Token-Holen fehlgeschlagen: ${err instanceof Error ? err.message : 'unbekannt'}`,
    };
  }

  const jetzt = new Date();
  const ende = new Date(jetzt.getTime() + tageVoraus * 24 * 60 * 60 * 1000);

  const res = await fetch(FREEBUSY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: jetzt.toISOString(),
      timeMax: ende.toISOString(),
      timeZone: 'Europe/Berlin',
      items: [{ id: 'primary' }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    return {
      ok: false,
      error: `FreeBusy-API ${res.status}: ${txt.slice(0, 200)}`,
    };
  }

  type FreeBusyResponse = {
    calendars?: {
      primary?: {
        busy?: FreeBusySlot[];
      };
    };
  };
  const data = (await res.json()) as FreeBusyResponse;
  const busy = data.calendars?.primary?.busy ?? [];

  // Alte Slots löschen + neue inserten in einer Transaktion-Logik
  await supabaseAdmin
    .from('kalender_busy_slots')
    .delete()
    .eq('betrieb_id', opts.betriebId)
    .eq('quelle', 'google');

  if (busy.length > 0) {
    const rows = busy.map((slot) => ({
      betrieb_id: opts.betriebId,
      quelle: 'google' as const,
      von: slot.start,
      bis: slot.end,
    }));
    const { error: insertError } = await supabaseAdmin
      .from('kalender_busy_slots')
      .insert(rows);
    if (insertError) {
      return { ok: false, error: `Insert fehlgeschlagen: ${insertError.message}` };
    }
  }

  await supabaseAdmin
    .from('gmail_connections')
    .update({ calendar_letzter_sync: new Date().toISOString() })
    .eq('betrieb_id', opts.betriebId);

  return { ok: true, count: busy.length };
}
