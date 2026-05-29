-- ============================================
-- Idempotenz: nachrichten.message_id UNIQUE (partial)
-- ============================================
-- Tag 14 (28.5.2026) – Welle 1.1 Härtungssprint
--
-- Problem: Postmark retried Inbound-Webhooks bei Timeouts (z.B. langer
-- Claude-Call). Aktuell führt das zu doppelten anfragen-, nachrichten-,
-- analysen- und entwuerfe-Einträgen plus doppelten KI-Kosten.
--
-- Lösung: partial UNIQUE index auf message_id (nur wenn nicht NULL,
-- damit Outbound-Nachrichten ohne Postmark-ID weiterhin erlaubt sind).
--
-- Der Pre-Check in app/api/inbound/route.ts fängt die Duplikate vorher
-- ab und gibt 200 zurück; dieser Index ist die DB-seitige Garantie
-- für die Race-Condition (zwei Webhooks innerhalb von ms).

CREATE UNIQUE INDEX IF NOT EXISTS nachrichten_message_id_uniq
  ON nachrichten (message_id)
  WHERE message_id IS NOT NULL;

COMMENT ON INDEX nachrichten_message_id_uniq IS
  'Postmark-Retry-Schutz: gleiche message_id kann nicht zweimal eingefügt werden';
