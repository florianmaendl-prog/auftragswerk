-- ============================================
-- Säule 2 – angebote-Schema reparieren (idempotent)
-- ============================================
-- Problem: in der produktiven DB fehlen Spalten am angebote-Row
-- ("Could not find the 'einleitung' column ... in the schema cache").
-- Ursache: beim Hin-und-Her mit dem ursprünglichen Migration-Block
-- ist beim CREATE TABLE ein Subset entstanden – Soll-Schema laut
-- 20260522_saeule2_angebote.sql ist breiter.
--
-- Dieser Block zieht alle laut Soll-Schema fehlenden Spalten nach.
-- Komplett idempotent: ADD COLUMN IF NOT EXISTS auf jedes Feld,
-- bestehende Spalten werden nicht angefasst.

ALTER TABLE angebote
  ADD COLUMN IF NOT EXISTS anfrage_id      UUID REFERENCES anfragen(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS titel           TEXT,
  ADD COLUMN IF NOT EXISTS variante        TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS einleitung      TEXT,
  ADD COLUMN IF NOT EXISTS positionen      JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS schlusstext     TEXT,
  ADD COLUMN IF NOT EXISTS summe_netto     NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mwst_satz       NUMERIC(5,2)  NOT NULL DEFAULT 19.00,
  ADD COLUMN IF NOT EXISTS summe_brutto    NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'entwurf',
  ADD COLUMN IF NOT EXISTS angebotsnummer  TEXT,
  ADD COLUMN IF NOT EXISTS gueltig_bis     DATE,
  ADD COLUMN IF NOT EXISTS notiz_intern    TEXT,
  ADD COLUMN IF NOT EXISTS versendet_am    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

-- variante-CHECK absichern – nur setzen wenn noch nicht da
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'angebote_variante_check'
  ) THEN
    ALTER TABLE angebote
      ADD CONSTRAINT angebote_variante_check
      CHECK (variante IN ('standard', 'premium', 'spar'));
  END IF;
END $$;

-- status-CHECK absichern
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'angebote_status_check'
  ) THEN
    ALTER TABLE angebote
      ADD CONSTRAINT angebote_status_check
      CHECK (status IN ('entwurf', 'versendet', 'angenommen', 'abgelehnt'));
  END IF;
END $$;

-- Indizes nachziehen
CREATE INDEX IF NOT EXISTS idx_angebote_betrieb ON angebote(betrieb_id);
CREATE INDEX IF NOT EXISTS idx_angebote_anfrage ON angebote(anfrage_id);

-- updated_at-Trigger nachziehen (set_updated_at-Funktion existiert
-- aus früheren Migrations bereits)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_angebote_updated_at'
  ) THEN
    CREATE TRIGGER trg_angebote_updated_at
      BEFORE UPDATE ON angebote
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- PostgREST/Supabase Schema-Cache zwingen neu zu laden, damit der
-- "schema cache"-Fehler im Frontend sofort weg ist
NOTIFY pgrst, 'reload schema';
