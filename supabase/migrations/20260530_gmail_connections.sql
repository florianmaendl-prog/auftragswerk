-- ============================================
-- Gmail OAuth Connections
-- ============================================
-- Tag 15+ (29.5.2026) – Welle C: Gmail-OAuth-Pivot
--
-- Speichert die OAuth-Tokens für Gmail-Send-Verbindungen pro Betrieb.
-- Premium-Onboarding-Foundation: Klick "Mit Gmail verbinden" → Mail
-- kommt aus echtem Account des Kunden, kein DKIM/Sender-Signature mehr.
--
-- Iron Rule: access_token + refresh_token AES-256-GCM-verschlüsselt
-- at-rest. Verschlüsselung via lib/crypto.ts mit TOKEN_ENCRYPTION_KEY
-- aus Env. Tokens NIE plain in DB/Logs/processing_errors.
--
-- Outbound nur (Scope gmail.send). Inbound bleibt Postmark-Forward.

CREATE TABLE IF NOT EXISTS gmail_connections (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id               UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  google_email             TEXT NOT NULL,
  access_token_encrypted   TEXT NOT NULL,
  refresh_token_encrypted  TEXT NOT NULL,
  token_expiry             TIMESTAMPTZ NOT NULL,
  scope                    TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'aktiv'
                             CHECK (status IN ('aktiv', 'fehler', 'widerrufen')),
  letzter_fehler           TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (betrieb_id)
);

COMMENT ON TABLE gmail_connections IS
  'Gmail-OAuth-Tokens pro Betrieb (Scope gmail.send). Tokens AES-256-GCM-verschlüsselt.';
COMMENT ON COLUMN gmail_connections.status IS
  'aktiv = funktioniert, fehler = letzter Send-Versuch failed, widerrufen = User hat Zugriff entzogen oder selbst disconnected';

CREATE INDEX IF NOT EXISTS idx_gmail_connections_betrieb
  ON gmail_connections(betrieb_id);

-- updated_at-Trigger (Function existiert bereits aus früheren Migrationen)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gmail_connections_updated_at
  BEFORE UPDATE ON gmail_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS – Betrieb-scoped wie alle anderen Tabellen
ALTER TABLE gmail_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gmail_connections_select_own_betrieb" ON gmail_connections
  FOR SELECT USING (betrieb_id = current_betrieb_id());

CREATE POLICY "gmail_connections_modify_own_betrieb" ON gmail_connections
  FOR ALL
  USING (betrieb_id = current_betrieb_id())
  WITH CHECK (betrieb_id = current_betrieb_id());
