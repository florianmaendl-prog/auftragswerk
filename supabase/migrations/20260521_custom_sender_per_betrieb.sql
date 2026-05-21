-- ============================================
-- Custom Sender pro Betrieb
-- ============================================
-- Tag 10 (21.5.2026, Abend)
--
-- Erlaubt jedem Betrieb eine eigene Versand-Adresse
-- mit verifizierter DKIM-Signatur via Postmark Sender Signatures.

ALTER TABLE betriebe
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS sender_domain TEXT,
  ADD COLUMN IF NOT EXISTS sender_verified BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS postmark_signature_id BIGINT,
  ADD COLUMN IF NOT EXISTS sender_dns_records JSONB;

COMMENT ON COLUMN betriebe.sender_email IS 'Versand-Adresse z.B. "info@metallbau-max.de" - wenn null: Fallback auf POSTMARK_FROM_EMAIL env-var';
COMMENT ON COLUMN betriebe.sender_name IS 'Anzeige-Name z.B. "Max Mustermann"';
COMMENT ON COLUMN betriebe.sender_domain IS 'Domain für DNS-Setup (z.B. "metallbau-max.de")';
COMMENT ON COLUMN betriebe.sender_verified IS 'DKIM verifiziert? Wenn false: Fallback auf POSTMARK_FROM_EMAIL';
COMMENT ON COLUMN betriebe.postmark_signature_id IS 'ID der Sender Signature in Postmark';
COMMENT ON COLUMN betriebe.sender_dns_records IS 'JSONB mit DNS-Records die der Betrieb setzen muss (DKIM + Return-Path + Hosts)';

-- Index für schnellen Lookup
CREATE INDEX IF NOT EXISTS idx_betriebe_postmark_signature 
  ON betriebe(postmark_signature_id)
  WHERE postmark_signature_id IS NOT NULL;