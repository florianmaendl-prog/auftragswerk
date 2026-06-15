-- ============================================
-- Welle P5 – Mini-CRM-V1 (Datei-Ablage am Kunden)
-- ============================================
-- Heute: "Kunden" ist eine dynamische Aggregation aus analysen-Tabelle
-- pro Email-Adresse. Funktioniert, aber begrenzt – Owner kann am Kunden
-- nichts pflegen (Notizen, manuelle Anhänge).
--
-- Welle P5 macht aus dem Aggregat ein echtes Kunden-Profil:
--   kunden            → dedizierte Tabelle pro (betrieb_id, email)
--   kunden_dateien    → Anhänge (aus Inbound oder manuell) am Kunden
--
-- Sync-Pfad bei Inbound: nach Klassifikation einer kundenanfrage wird
-- der Kunde in der kunden-Tabelle angelegt/ergänzt. Owner kann später
-- Felder editieren (Notizen, Telefon-Korrektur etc.) – Inbound überschreibt
-- vorhandene Felder NICHT.
--
-- Storage-Bucket "kunden_dateien" für manuelle Uploads und Inbound-
-- Verknüpfungen (Inbound-Originale liegen weiter im "anhaenge"-Bucket;
-- Verknüpfung erfolgt via storage_path, kein Re-Upload).

CREATE TABLE IF NOT EXISTS kunden (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id   UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  name         TEXT,
  firma        TEXT,
  position     TEXT,
  telefon      TEXT,
  adresse      TEXT,
  plz          TEXT,
  kunde_typ    TEXT,
  notizen      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (betrieb_id, email)
);

COMMENT ON TABLE kunden IS
  'Kunden-Profile pro Betrieb. Initial befüllt vom Inbound-Webhook nach Klassifikation; Owner kann später editieren. Owner-Edits gewinnen – Inbound überschreibt vorhandene Felder nicht.';
COMMENT ON COLUMN kunden.notizen IS
  'Freie Owner-Notizen am Kunden (z.B. "zahlt schlecht, 50% Anzahlung verlangen"). Nicht in Mails sichtbar.';

CREATE INDEX IF NOT EXISTS idx_kunden_betrieb_email
  ON kunden(betrieb_id, email);

CREATE TRIGGER trg_kunden_updated_at
  BEFORE UPDATE ON kunden
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE kunden ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kunden_select_own_betrieb" ON kunden
  FOR SELECT USING (betrieb_id = current_betrieb_id());

CREATE POLICY "kunden_modify_own_betrieb" ON kunden
  FOR ALL
  USING (betrieb_id = current_betrieb_id())
  WITH CHECK (betrieb_id = current_betrieb_id());


CREATE TABLE IF NOT EXISTS kunden_dateien (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kunde_id        UUID NOT NULL REFERENCES kunden(id) ON DELETE CASCADE,
  betrieb_id      UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  dateiname       TEXT NOT NULL,
  content_type    TEXT,
  groesse_bytes   BIGINT,
  storage_path    TEXT NOT NULL,
  storage_bucket  TEXT NOT NULL DEFAULT 'kunden_dateien',
  quelle          TEXT NOT NULL CHECK (quelle IN ('inbound_anhang', 'manuell_upload')),
  anfrage_id      UUID REFERENCES anfragen(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE kunden_dateien IS
  'Dateien am Kunden – aus Inbound-Anhängen automatisch verknüpft (storage_bucket=anhaenge) oder manuell hochgeladen (storage_bucket=kunden_dateien).';
COMMENT ON COLUMN kunden_dateien.storage_bucket IS
  'kunden_dateien für manuelle Uploads, anhaenge für Inbound-Verknüpfungen. Bei Download muss der richtige Bucket angesprochen werden.';

CREATE INDEX IF NOT EXISTS idx_kunden_dateien_kunde
  ON kunden_dateien(kunde_id, created_at DESC);

ALTER TABLE kunden_dateien ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kunden_dateien_select_own_betrieb" ON kunden_dateien
  FOR SELECT USING (betrieb_id = current_betrieb_id());

CREATE POLICY "kunden_dateien_modify_own_betrieb" ON kunden_dateien
  FOR ALL
  USING (betrieb_id = current_betrieb_id())
  WITH CHECK (betrieb_id = current_betrieb_id());


-- Storage-Bucket für manuelle Owner-Uploads. Privat, 25 MB Limit
-- (genug für Angebote/Rechnungen/Pläne, aber keine Riesen-Videos).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('kunden_dateien', 'kunden_dateien', false, 26214400)
ON CONFLICT (id) DO NOTHING;
