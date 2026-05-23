-- ============================================
-- Anhänge (Attachments) zu Mail-Nachrichten
-- ============================================
-- Tag 13 (23.5.2026) – Modul 1 "Fehlende Mitte"
--
-- Metadaten zu Datei-Anhängen pro Nachricht (eingang + ausgang). Die Datei
-- selbst liegt im Supabase Storage Bucket 'anhaenge' unter
--   <betrieb_id>/<anfrage_id>/<uuid>_<dateiname>
--
-- Server-side: Zugriff via service-role (supabaseAdmin) – bypasst Storage-RLS,
-- daher hier nur RLS auf der Tabelle.
-- Client-side: Dashboard holt signed URLs server-seitig und reicht sie raus.

CREATE TABLE IF NOT EXISTS anhaenge (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nachricht_id  UUID NOT NULL REFERENCES nachrichten(id) ON DELETE CASCADE,
  betrieb_id    UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  dateiname     TEXT NOT NULL,
  content_type  TEXT NOT NULL DEFAULT 'application/octet-stream',
  groesse_bytes BIGINT NOT NULL DEFAULT 0,
  storage_path  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  anhaenge IS 'Datei-Anhänge zu Mail-Nachrichten (in + out)';
COMMENT ON COLUMN anhaenge.storage_path IS 'Pfad im Supabase Storage Bucket "anhaenge"';

CREATE INDEX IF NOT EXISTS idx_anhaenge_nachricht ON anhaenge(nachricht_id);
CREATE INDEX IF NOT EXISTS idx_anhaenge_betrieb   ON anhaenge(betrieb_id);

-- RLS – gleiche Logik wie bei anfragen/nachrichten/entwuerfe:
-- jeder Betrieb sieht nur seine eigenen Zeilen
ALTER TABLE anhaenge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anhaenge_select_own_betrieb" ON anhaenge
  FOR SELECT USING (betrieb_id = current_betrieb_id());

CREATE POLICY "anhaenge_modify_own_betrieb" ON anhaenge
  FOR ALL
  USING (betrieb_id = current_betrieb_id())
  WITH CHECK (betrieb_id = current_betrieb_id());

-- ============================================
-- Storage Bucket
-- ============================================
-- Privater Bucket – alle Zugriffe laufen server-seitig über service-role.
-- Falls dieses INSERT im SQL-Editor fehlschlägt (Permissions),
-- den Bucket alternativ im Supabase-Dashboard → Storage → New Bucket anlegen:
--   Name: anhaenge, Public: aus.

INSERT INTO storage.buckets (id, name, public)
VALUES ('anhaenge', 'anhaenge', false)
ON CONFLICT (id) DO NOTHING;
