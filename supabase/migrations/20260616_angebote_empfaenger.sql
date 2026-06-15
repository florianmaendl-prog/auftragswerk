-- ============================================
-- Säule 2 – Empfänger-Felder direkt am Angebot
-- ============================================
-- Bisher: Empfänger kommt aus angebote.anfrage_id → anfragen.von_email.
-- Owner-Feedback: braucht auch Angebote OHNE vorgelagerte Mail-Anfrage
-- (Kunde steht im Laden, Telefon-Anfrage, …). Daher Empfänger direkt
-- am Angebot speichern – wenn aus Anfrage erstellt, wird der Empfänger
-- aus Kunden-/Analyse-Daten vorbefüllt, danach komplett editierbar.

ALTER TABLE angebote
  ADD COLUMN IF NOT EXISTS empfaenger_name     TEXT,
  ADD COLUMN IF NOT EXISTS empfaenger_firma    TEXT,
  ADD COLUMN IF NOT EXISTS empfaenger_email    TEXT,
  ADD COLUMN IF NOT EXISTS empfaenger_adresse  TEXT,
  ADD COLUMN IF NOT EXISTS empfaenger_plz      TEXT;

COMMENT ON COLUMN angebote.empfaenger_email IS
  'Pflicht für Versand. Wenn aus Anfrage erstellt: vorbefüllt aus anfragen.von_email + kunden-Stammdaten, dann frei editierbar.';
