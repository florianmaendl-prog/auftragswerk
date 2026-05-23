-- ============================================
-- Verfügbarkeit (Modul 5)
-- ============================================
-- Tag 12 abends (23.5.2026) – Modul 5 "Verfügbarkeits-Modul"
--
-- Zwei Tabellen:
--   verfuegbarkeit_regel   – wöchentlich wiederkehrende Verfügbarkeit
--                            (z.B. Mo-Mi 8-12 Uhr Aufmaß-Slots)
--   verfuegbarkeit_sperre  – einmalige Ausnahmen / Sperren
--                            (z.B. Urlaub, fester Termin)
--
-- KI bekommt die nächsten freien Slots beim Erst-Entwurf und schlägt
-- konkrete Termine vor statt vage "Anfang nächster Woche".

-- --------------------------------------------
-- Wöchentlich wiederkehrende Verfügbarkeit
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS verfuegbarkeit_regel (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id    UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  wochentag     INTEGER NOT NULL CHECK (wochentag BETWEEN 1 AND 7),
  start_uhrzeit TIME NOT NULL,
  ende_uhrzeit  TIME NOT NULL,
  aktiv         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_uhrzeit < ende_uhrzeit)
);

COMMENT ON TABLE  verfuegbarkeit_regel IS 'Wöchentlich wiederkehrende Aufmaß-Verfügbarkeit pro Betrieb';
COMMENT ON COLUMN verfuegbarkeit_regel.wochentag IS '1=Montag ... 7=Sonntag (ISO 8601)';

CREATE INDEX IF NOT EXISTS idx_verfuegbarkeit_regel_betrieb
  ON verfuegbarkeit_regel(betrieb_id);

-- --------------------------------------------
-- Einmalige Sperren (Urlaub, fester Termin, krank)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS verfuegbarkeit_sperre (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id  UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  datum_von   TIMESTAMPTZ NOT NULL,
  datum_bis   TIMESTAMPTZ NOT NULL,
  grund       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (datum_von < datum_bis)
);

COMMENT ON TABLE  verfuegbarkeit_sperre IS 'Einmalige Sperren – überschreiben die Regel im jeweiligen Zeitraum';

CREATE INDEX IF NOT EXISTS idx_verfuegbarkeit_sperre_betrieb
  ON verfuegbarkeit_sperre(betrieb_id, datum_von);

-- --------------------------------------------
-- updated_at-Trigger für regel (sperre braucht keinen – einmalig)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verfuegbarkeit_regel_updated_at
  BEFORE UPDATE ON verfuegbarkeit_regel
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------
-- RLS – Betrieb-scoped wie alle anderen Tabellen
-- --------------------------------------------
ALTER TABLE verfuegbarkeit_regel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verfuegbarkeit_regel_select_own_betrieb" ON verfuegbarkeit_regel
  FOR SELECT USING (betrieb_id = current_betrieb_id());

CREATE POLICY "verfuegbarkeit_regel_modify_own_betrieb" ON verfuegbarkeit_regel
  FOR ALL
  USING (betrieb_id = current_betrieb_id())
  WITH CHECK (betrieb_id = current_betrieb_id());

ALTER TABLE verfuegbarkeit_sperre ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verfuegbarkeit_sperre_select_own_betrieb" ON verfuegbarkeit_sperre
  FOR SELECT USING (betrieb_id = current_betrieb_id());

CREATE POLICY "verfuegbarkeit_sperre_modify_own_betrieb" ON verfuegbarkeit_sperre
  FOR ALL
  USING (betrieb_id = current_betrieb_id())
  WITH CHECK (betrieb_id = current_betrieb_id());
