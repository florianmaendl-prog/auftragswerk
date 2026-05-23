-- ============================================
-- Termine (Aufmaß- / Vor-Ort-Termine)
-- ============================================
-- Tag 13 (23.5.2026) – Modul 3 "Fehlende Mitte"
--
-- Termine hängen an Anfragen. Status-Lebenszyklus:
--   vorgeschlagen → bestaetigt → absolviert
-- (jederzeit: abgesagt)
--
-- v1: keine Google-Calendar-Integration – nur eigene Daten + UI.

CREATE TABLE IF NOT EXISTS termine (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anfrage_id  UUID NOT NULL REFERENCES anfragen(id) ON DELETE CASCADE,
  betrieb_id  UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  datum       TIMESTAMPTZ NOT NULL,
  dauer_min   INTEGER NOT NULL DEFAULT 60,
  ort         TEXT,
  notiz       TEXT,
  status      TEXT NOT NULL DEFAULT 'vorgeschlagen'
                CHECK (status IN ('vorgeschlagen', 'bestaetigt', 'absolviert', 'abgesagt')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  termine IS 'Aufmaß- und Vor-Ort-Termine, an Anfragen gehängt';
COMMENT ON COLUMN termine.status IS 'vorgeschlagen → bestaetigt → absolviert; abgesagt jederzeit';

CREATE INDEX IF NOT EXISTS idx_termine_anfrage ON termine(anfrage_id);
CREATE INDEX IF NOT EXISTS idx_termine_betrieb ON termine(betrieb_id);
CREATE INDEX IF NOT EXISTS idx_termine_datum   ON termine(betrieb_id, datum);

-- updated_at-Trigger – idempotente Function-Definition, falls aus früherer
-- Migration noch nicht vorhanden.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_termine_updated_at
  BEFORE UPDATE ON termine
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS – Betrieb-scoped wie alle anderen Tabellen
ALTER TABLE termine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "termine_select_own_betrieb" ON termine
  FOR SELECT USING (betrieb_id = current_betrieb_id());

CREATE POLICY "termine_modify_own_betrieb" ON termine
  FOR ALL
  USING (betrieb_id = current_betrieb_id())
  WITH CHECK (betrieb_id = current_betrieb_id());
