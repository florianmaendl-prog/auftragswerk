-- ============================================
-- Welle P2 – Signatur Premium (HTML + Logo)
-- ============================================
-- Heute: betriebe.signatur ist Plain-Text-Textarea, wird unter den
-- KI-Entwurf gehängt. Sieht 2026 billig aus – Premium-Mail-Tools
-- haben HTML-Signaturen mit Logo wie Outlook.
--
-- Drei neue Spalten:
--   signatur_html        → Rich-Text-Variante (TipTap-Editor)
--   logo_storage_path    → Pfad im Bucket `logos`, NULL wenn kein Logo
--   logo_content_type    → MIME für Inline-Embedding (image/png etc.)
--
-- Legacy-Feld `signatur` (Plain-Text) bleibt – wird genutzt wenn
-- signatur_html leer ist, und für den text/plain-Fallback in
-- multipart/alternative-Mails (manche Empfänger lesen nur Plain-Text).

ALTER TABLE betriebe
  ADD COLUMN IF NOT EXISTS signatur_html        TEXT,
  ADD COLUMN IF NOT EXISTS logo_storage_path    TEXT,
  ADD COLUMN IF NOT EXISTS logo_content_type    TEXT;

COMMENT ON COLUMN betriebe.signatur_html IS
  'HTML-Variante der Signatur (Rich-Text mit Fett/Größe/Liste, optional <img src="cid:logo"> wenn logo_storage_path gesetzt). Plain-Text-Pendant betriebe.signatur dient als Fallback.';
COMMENT ON COLUMN betriebe.logo_storage_path IS
  'Pfad im Bucket `logos`, format <betrieb_id>.<ext>. NULL wenn kein Logo. Send-Pfad lädt das Bild + embedded via Content-ID (multipart/related).';
COMMENT ON COLUMN betriebe.logo_content_type IS
  'MIME-Type des Logos (image/png, image/jpeg, image/svg+xml). Wird im Send-Pfad als Content-Type des Inline-Attachments verwendet.';

-- Storage-Bucket `logos` für Owner-Upload (privat, 2 MB Limit, nur Bild-MIMEs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  false,
  2097152,
  ARRAY['image/png','image/jpeg','image/jpg','image/svg+xml','image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage-Policies: jeder Betrieb darf nur in den eigenen Pfad <betrieb_id>/
-- schreiben/lesen. Service-Role (Server-Routes) hat eh Vollzugriff.
CREATE POLICY "logos_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = current_betrieb_id()::text
  );

CREATE POLICY "logos_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = current_betrieb_id()::text
  );

CREATE POLICY "logos_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = current_betrieb_id()::text
  );

CREATE POLICY "logos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = current_betrieb_id()::text
  );
