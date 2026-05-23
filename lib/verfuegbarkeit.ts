/**
 * Verfügbarkeits-Logik – berechnet freie Termin-Slots aus:
 *   - verfuegbarkeit_regel  (wöchentlich wiederkehrende Slots)
 *   - verfuegbarkeit_sperre (einmalige Ausnahmen)
 *   - termine               (bereits bestätigte Termine)
 *
 * Wird vom Inbound-Webhook beim Erst-Entwurf aufgerufen, damit die KI
 * konkrete freie Slots vorschlagen kann statt vager "Anfang nächster Woche".
 */

import { supabaseAdmin } from './supabase';

export type FreierSlot = {
  /** ISO-8601, lokale Zeit (Server läuft in UTC, JS-Date konvertiert) */
  datum_iso: string;
  /** "Mo, 26.05. 10:00" – fertig für KI-Prompt */
  label: string;
};

type Regel = {
  wochentag: number;
  start_uhrzeit: string; // "HH:MM:SS"
  ende_uhrzeit: string;
};

type Sperre = {
  datum_von: string;
  datum_bis: string;
};

type BestaetigterTermin = {
  datum: string;
  dauer_min: number;
};

const WOCHENTAG_KURZ = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/**
 * Liefert bis zu `maxSlots` freie Slots aus der Verfügbarkeit eines Betriebs.
 *
 * @param betriebId       UUID des Betriebs
 * @param fromDate        Startdatum (default: jetzt)
 * @param days            Wie viele Tage in die Zukunft schauen (default 14)
 * @param slotDauerMin    Slot-Länge in Minuten (default 60)
 * @param maxSlots        Maximale Slot-Anzahl in der Rückgabe (default 20)
 */
export async function getFreieSlots(
  betriebId: string,
  fromDate: Date = new Date(),
  days: number = 14,
  slotDauerMin: number = 60,
  maxSlots: number = 20
): Promise<FreierSlot[]> {
  const startMs = fromDate.getTime();
  const endMs = startMs + days * 24 * 60 * 60 * 1000;
  const endIso = new Date(endMs).toISOString();
  const fromIso = new Date(startMs).toISOString();

  // 1. Regeln laden
  const { data: regelnData } = await supabaseAdmin
    .from('verfuegbarkeit_regel')
    .select('wochentag, start_uhrzeit, ende_uhrzeit')
    .eq('betrieb_id', betriebId)
    .eq('aktiv', true);
  const regeln = (regelnData as Regel[]) || [];
  if (regeln.length === 0) return [];

  // 2. Sperren im Zeitraum
  const { data: sperrenData } = await supabaseAdmin
    .from('verfuegbarkeit_sperre')
    .select('datum_von, datum_bis')
    .eq('betrieb_id', betriebId)
    .lte('datum_von', endIso)
    .gte('datum_bis', fromIso);
  const sperren = (sperrenData as Sperre[]) || [];

  // 3. Bestätigte Termine im Zeitraum
  const { data: termineData } = await supabaseAdmin
    .from('termine')
    .select('datum, dauer_min')
    .eq('betrieb_id', betriebId)
    .eq('status', 'bestaetigt')
    .gte('datum', fromIso)
    .lte('datum', endIso);
  const termine = (termineData as BestaetigterTermin[]) || [];

  const slots: FreierSlot[] = [];

  // 4. Pro Tag im Range: Slots aus den Regeln generieren
  for (let d = 0; d < days; d++) {
    const tag = new Date(startMs + d * 24 * 60 * 60 * 1000);
    const wochentag = ((tag.getDay() + 6) % 7) + 1; // JS 0=So → ISO 1=Mo..7=So
    const regelnTag = regeln.filter((r) => r.wochentag === wochentag);
    if (regelnTag.length === 0) continue;

    for (const regel of regelnTag) {
      const [startH, startM] = regel.start_uhrzeit.split(':').map(Number);
      const [endeH, endeM] = regel.ende_uhrzeit.split(':').map(Number);
      const slotStart = new Date(tag);
      slotStart.setHours(startH, startM, 0, 0);
      const fensterEnde = new Date(tag);
      fensterEnde.setHours(endeH, endeM, 0, 0);

      while (slotStart.getTime() + slotDauerMin * 60 * 1000 <= fensterEnde.getTime()) {
        const slotMs = slotStart.getTime();
        // In Vergangenheit liegt? Skip.
        if (slotMs < startMs) {
          slotStart.setTime(slotMs + slotDauerMin * 60 * 1000);
          continue;
        }
        const slotEnde = slotMs + slotDauerMin * 60 * 1000;

        // Mit Sperre kollidiert?
        const istGesperrt = sperren.some((s) => {
          const sVon = new Date(s.datum_von).getTime();
          const sBis = new Date(s.datum_bis).getTime();
          return slotMs < sBis && slotEnde > sVon;
        });

        // Mit bestätigtem Termin kollidiert?
        const istBelegt = termine.some((t) => {
          const tStart = new Date(t.datum).getTime();
          const tEnde = tStart + (t.dauer_min || 60) * 60 * 1000;
          return slotMs < tEnde && slotEnde > tStart;
        });

        if (!istGesperrt && !istBelegt) {
          slots.push({
            datum_iso: new Date(slotMs).toISOString(),
            label: formatLabel(new Date(slotMs)),
          });
          if (slots.length >= maxSlots) return slots;
        }

        slotStart.setTime(slotMs + slotDauerMin * 60 * 1000);
      }
    }
  }

  return slots;
}

function formatLabel(d: Date): string {
  const wochentag = WOCHENTAG_KURZ[((d.getDay() + 6) % 7) + 1];
  const tag = String(d.getDate()).padStart(2, '0');
  const monat = String(d.getMonth() + 1).padStart(2, '0');
  const stunde = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${wochentag}, ${tag}.${monat}. ${stunde}:${minute}`;
}
