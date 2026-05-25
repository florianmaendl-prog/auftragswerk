-- ============================================
-- Standalone-Termine (Modul 7 Tag 13)
-- ============================================
--
-- Max will Termine direkt im Kalender anlegen, die nichts mit einer
-- bestehenden Anfrage zu tun haben (Werkstatt-Wartung, Innungsversammlung,
-- Privattermin etc.). Bisher war anfrage_id NOT NULL.

ALTER TABLE termine
  ALTER COLUMN anfrage_id DROP NOT NULL;

COMMENT ON COLUMN termine.anfrage_id IS
  'NULL für standalone Termine, die direkt im Kalender angelegt wurden (keine Anfrage-Bezug).';
