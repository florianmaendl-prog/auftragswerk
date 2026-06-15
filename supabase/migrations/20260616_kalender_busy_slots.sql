-- ============================================
-- Welle P6 – Google-Calendar-Sync (Auto-Verfügbarkeit)
-- ============================================
-- Owner musste bisher Verfügbarkeit manuell in der verfuegbarkeit_regel-
-- Tabelle pflegen. Mit Sync liest Auftragswerk den Google Calendar des
-- Owners (read-only) und blockt automatisch alle dort markierten Slots.
--
-- Iron Rule beibehalten: NUR readonly-Scope. Wir schreiben NIE in den
-- Google Calendar des Owners (kein "Termin von Auftragswerk erstellt").
-- Sync läuft periodisch via Vercel-Cron alle 15 Minuten.

CREATE TABLE IF NOT EXISTS kalender_busy_slots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id       UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  quelle           TEXT NOT NULL CHECK (quelle IN ('google')),
  source_event_id  TEXT,
  von              TIMESTAMPTZ NOT NULL,
  bis              TIMESTAMPTZ NOT NULL,
  betreff          TEXT,
  geladen_am       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE kalender_busy_slots IS
  'Aus externen Kalendern (Google) gespiegelte Busy-Zeiten. Sync-Cron löscht alle Rows pro Betrieb + Quelle und inserted die aktuellen frisch (KISS, keine Diff-Logik). Verfügbarkeits-Berechnung subtrahiert diese Slots von den manuellen Regeln.';

CREATE INDEX IF NOT EXISTS idx_busy_slots_betrieb_zeit
  ON kalender_busy_slots(betrieb_id, von, bis);

ALTER TABLE kalender_busy_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "busy_slots_select_own_betrieb" ON kalender_busy_slots
  FOR SELECT USING (betrieb_id = current_betrieb_id());

-- Insert/Update/Delete läuft nur über Service-Role (Cron) → keine Owner-Policy

-- Gmail-Connection bekommt ein Flag das anzeigt ob auch Calendar-Scope
-- vorhanden ist. Owner muss bei Bestandsverbindung neu-zustimmen
-- (Re-Consent), wir merken hier ob das durch ist.
ALTER TABLE gmail_connections
  ADD COLUMN IF NOT EXISTS calendar_sync_aktiv BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calendar_letzter_sync TIMESTAMPTZ;

COMMENT ON COLUMN gmail_connections.calendar_sync_aktiv IS
  'Hat die Verbindung auch calendar.readonly-Scope? Wird beim OAuth-Callback gesetzt wenn der Scope-Claim im Token den Calendar enthält.';
COMMENT ON COLUMN gmail_connections.calendar_letzter_sync IS
  'Wann der letzte erfolgreiche Calendar-Free/Busy-Sync gelaufen ist. NULL = noch nie. Cron-Job updated bei jedem Erfolg.';
