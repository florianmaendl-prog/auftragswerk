-- ============================================
-- Welle P3 – Custom-Tags / Owner-Labels
-- ============================================
-- Default-Kategorien (kundenanfrage / werbung / rechnung etc.) decken
-- nicht jeden Workflow ab. Owner soll eigene Labels definieren können:
-- "Lieferanten", "Wichtig", "Architekten", "Bauamt" – plus Sender→Tag-
-- Regeln damit's automatisch passiert (z.B. "obi.de → Tag Lieferanten").
--
-- Drei Bausteine:
--   anfragen.tags                 → Array der gesetzten Tags pro Anfrage
--   betriebe.eigene_tags          → Owner-pflegte Liste der bekannten Tags
--   tag_regeln                    → Auto-Set-Regeln (Sender-Pattern → Tag)
--
-- Tags sind freie Strings (keine eigene Tabelle nötig) – Premium-CRMs
-- machen das oft als String-Array, ist KISS und schnell zu durchsuchen
-- via GIN-Index.

ALTER TABLE anfragen
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN anfragen.tags IS
  'Owner-Tags pro Anfrage. Aus betriebe.eigene_tags + automatisch durch tag_regeln (Sender-Matching nach Klassifikation).';

CREATE INDEX IF NOT EXISTS idx_anfragen_tags
  ON anfragen USING gin(tags);

ALTER TABLE betriebe
  ADD COLUMN IF NOT EXISTS eigene_tags TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN betriebe.eigene_tags IS
  'Liste vordefinierter Owner-Tags. UI zeigt diese in Auswahl-Menüs. Tags die in anfragen.tags vorkommen aber hier nicht stehen sind "legacy" und werden trotzdem angezeigt.';

-- Tag-Regeln: Sender-Pattern → Tag wird automatisch nach Inbound gesetzt
CREATE TABLE IF NOT EXISTS tag_regeln (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id      UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  sender_pattern  TEXT NOT NULL,
  tag             TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (betrieb_id, sender_pattern, tag)
);

COMMENT ON TABLE tag_regeln IS
  'Sender-Pattern → Tag-Auto-Set nach Klassifikation. sender_pattern matcht case-insensitive Substring gegen anfragen.von_email (z.B. "obi.de" matcht "info@obi.de" und "support@obi.de").';

CREATE INDEX IF NOT EXISTS idx_tag_regeln_betrieb
  ON tag_regeln(betrieb_id);

ALTER TABLE tag_regeln ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tag_regeln_select_own_betrieb" ON tag_regeln
  FOR SELECT USING (betrieb_id = current_betrieb_id());

CREATE POLICY "tag_regeln_modify_own_betrieb" ON tag_regeln
  FOR ALL
  USING (betrieb_id = current_betrieb_id())
  WITH CHECK (betrieb_id = current_betrieb_id());
