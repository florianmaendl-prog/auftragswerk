-- ============================================
-- Microsoft 365 / Outlook OAuth Connections
-- ============================================
-- Provider-Abdeckung für Innung-Vorstellung: ~Hälfte der KMU-Handwerker
-- nutzt Microsoft 365/Outlook statt Gmail. Ohne den Pfad fällt die Hälfte
-- der Zielgruppe weg.
--
-- Pragmatisch separate Tabelle statt generic `email_connections`-Refactor,
-- damit Live-Code (Max-Pilot läuft) nicht angefasst wird. Bei 3+ Providern
-- später konsolidieren.
--
-- Iron Rule: access_token + refresh_token AES-256-GCM-verschlüsselt
-- at-rest. Verschlüsselung via lib/crypto.ts mit TOKEN_ENCRYPTION_KEY
-- aus Env. Tokens NIE plain in DB/Logs/processing_errors.
--
-- Outbound nur (Scope Mail.Send + offline_access). Inbound bleibt
-- Postmark-Forward.
--
-- tenant_id: Microsoft unterscheidet zwischen Consumer-Outlook.com
-- (`consumers`) und Org-Tenants (UUID). Wir speichern was im id_token
-- ankommt, damit wir bei künftigen API-Calls die richtige Authority
-- nutzen können falls nötig.

CREATE TABLE IF NOT EXISTS microsoft_connections (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id               UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  microsoft_email          TEXT NOT NULL,
  tenant_id                TEXT,
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

COMMENT ON TABLE microsoft_connections IS
  'Microsoft 365/Outlook-OAuth-Tokens pro Betrieb (Scope Mail.Send). Tokens AES-256-GCM-verschlüsselt.';
COMMENT ON COLUMN microsoft_connections.tenant_id IS
  '"consumers" für Outlook.com oder Tenant-UUID für Org-Accounts. Aus id_token "tid"-Claim.';
COMMENT ON COLUMN microsoft_connections.status IS
  'aktiv = funktioniert, fehler = letzter Send-Versuch failed, widerrufen = User hat Zugriff entzogen oder selbst disconnected';

CREATE INDEX IF NOT EXISTS idx_microsoft_connections_betrieb
  ON microsoft_connections(betrieb_id);

-- updated_at-Trigger (Function existiert bereits aus Gmail-Migration)
CREATE TRIGGER trg_microsoft_connections_updated_at
  BEFORE UPDATE ON microsoft_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS – Betrieb-scoped wie alle anderen Tabellen
ALTER TABLE microsoft_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "microsoft_connections_select_own_betrieb" ON microsoft_connections
  FOR SELECT USING (betrieb_id = current_betrieb_id());

CREATE POLICY "microsoft_connections_modify_own_betrieb" ON microsoft_connections
  FOR ALL
  USING (betrieb_id = current_betrieb_id())
  WITH CHECK (betrieb_id = current_betrieb_id());
