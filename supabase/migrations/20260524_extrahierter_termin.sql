-- ============================================
-- Extrahierter Termin (Modul 6)
-- ============================================
-- Tag 12 (23.5.2026, spät) – Termin direkt aus Reply festmachen
--
-- Die Klassifikation extrahiert bei Replies oder klaren Termin-Mails
-- Datum/Uhrzeit/Ort als JSONB:
--   { datum_iso: "2026-05-26T10:00:00", ort: "Trogerstraße 18", notiz: "..." }
-- oder NULL wenn nichts erkennbar.
--
-- Verwendet von:
--   - lib/klassifikation.ts (Insert beim Klassifikations-Run)
--   - app/dashboard/anfragen/[id]/page.tsx (Read für TerminCard)
--   - app/dashboard/anfragen/[id]/termin-card.tsx (Pre-Fill im Festmach-Modal)

ALTER TABLE analysen
  ADD COLUMN IF NOT EXISTS extrahierter_termin JSONB;

COMMENT ON COLUMN analysen.extrahierter_termin IS
  'Aus dem Mail-Text extrahierter Termin-Vorschlag/Bestätigung: { datum_iso, ort, notiz } oder NULL';
