-- ============================================
-- Tag 18 (4.6.2026) – Gesperrte Sender (Blocklist)
-- ============================================
-- Aus Max-Pilot Tag 18: jede Menge Newsletter (Handwerkskammer,
-- hero-software, metallbau-onlineshop) landen in der Inbox. Owner soll
-- per Klick "von dieser Adresse nie wieder" sagen können.
--
-- Zwei Use-Cases mit derselben Tabelle:
--   1. Aus Kunden-Liste: "× Kunde löschen" – Absender wird gesperrt,
--      alle alten Anfragen dieses Absenders auf 'aussortiert'
--   2. Aus Inbox/Anfrage-Detail: "Absender sperren"
--
-- Inbound-Route checkt diese Tabelle VOR der KI-Klassifikation –
-- gesperrte Absender werden direkt als 'aussortiert' angelegt
-- (kein Anthropic-Call, keine Kosten).

CREATE TABLE IF NOT EXISTS gesperrte_sender (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  grund TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (betrieb_id, email)
);

CREATE INDEX IF NOT EXISTS idx_gesperrte_sender_betrieb_email
  ON gesperrte_sender (betrieb_id, lower(email));

ALTER TABLE gesperrte_sender ENABLE ROW LEVEL SECURITY;

-- Policies idempotent: erst DROP IF EXISTS, dann CREATE.
-- Postgres hat kein "CREATE POLICY IF NOT EXISTS", deshalb diese Form –
-- so kann die Migration mehrfach ohne Fehler ausgeführt werden.
DROP POLICY IF EXISTS gesperrte_sender_select_own ON gesperrte_sender;
DROP POLICY IF EXISTS gesperrte_sender_insert_own ON gesperrte_sender;
DROP POLICY IF EXISTS gesperrte_sender_delete_own ON gesperrte_sender;

CREATE POLICY gesperrte_sender_select_own ON gesperrte_sender
  FOR SELECT USING (
    betrieb_id IN (
      SELECT betrieb_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY gesperrte_sender_insert_own ON gesperrte_sender
  FOR INSERT WITH CHECK (
    betrieb_id IN (
      SELECT betrieb_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY gesperrte_sender_delete_own ON gesperrte_sender
  FOR DELETE USING (
    betrieb_id IN (
      SELECT betrieb_id FROM profiles WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE gesperrte_sender IS
  'Pro Betrieb Block-Liste von Sender-Emails. Inbound-Route filtert vor der KI-Klassifikation – gesperrte Absender werden direkt als aussortiert angelegt.';
