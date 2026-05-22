-- ============================================
-- Säule 2: Angebot & Kalkulation – Datenmodell
-- ============================================
-- Tag 11 (22.5.2026)
--
-- Drei Tabellen:
--   angebot_bausteine  – wiederverwendbare Positions-Templates pro Betrieb
--   material_preise    – Material-Preisliste pro Betrieb
--   angebote           – generierte Angebote (1 Anfrage kann mehrere Varianten haben)
--
-- ANNAHMEN (vor dem Ausführen prüfen):
--   1. Tabelle `angebote` ist laut INVENTUR.md leer ("LEER, Säule 2 noch
--      nicht gebaut") – diese Migration DROPPED & erstellt sie neu.
--      Falls dort doch Daten liegen: NICHT ausführen, erst melden.
--   2. Bestehende Tabellen haben kein RLS (keine Policy in den Migrations) –
--      die neuen Tabellen bleiben konsistent dazu ohne RLS. Sauberes
--      Multi-Tenant-RLS kommt gebündelt in der Skalierungs-Phase.

-- --------------------------------------------
-- Betrieb: Stundensatz für Arbeitszeit-Kalkulation
-- --------------------------------------------
ALTER TABLE betriebe
  ADD COLUMN IF NOT EXISTS stundensatz NUMERIC(10,2);

COMMENT ON COLUMN betriebe.stundensatz IS 'Verrechnungssatz €/Stunde – Basis der Arbeitszeit-Kalkulation in Angeboten';

-- --------------------------------------------
-- Helper: updated_at automatisch pflegen
-- --------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------
-- angebot_bausteine – Positions-Templates pro Betrieb
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS angebot_bausteine (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id          UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  kategorie           TEXT,                       -- z.B. geländer / treppe / tor
  bezeichnung         TEXT NOT NULL,              -- Kurzname für die Auswahl-Liste
  beschreibung        TEXT,                       -- ausführlicher Text fürs Angebot
  einheit             TEXT NOT NULL DEFAULT 'Stk',-- m / Stk / h / m² / pauschal
  material_kosten     NUMERIC(12,2) NOT NULL DEFAULT 0,   -- Material-Einkauf pro Einheit
  arbeitszeit_min     INTEGER NOT NULL DEFAULT 0,         -- Arbeitszeit in Minuten pro Einheit
  kalkulations_faktor NUMERIC(6,3) NOT NULL DEFAULT 1.000,-- Aufschlag/Marge, z.B. 1.200 = +20%
  aktiv               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE angebot_bausteine IS 'Wiederverwendbare Positions-Templates – Grundlage des Angebots-Generators';
COMMENT ON COLUMN angebot_bausteine.kalkulations_faktor IS 'Multiplikator auf die Selbstkosten, z.B. 1.200 = 20% Aufschlag';
COMMENT ON COLUMN angebot_bausteine.aktiv IS 'FALSE = Baustein ausgeblendet, ohne ihn zu löschen';

-- --------------------------------------------
-- material_preise – Material-Preisliste pro Betrieb
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS material_preise (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id    UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  bezeichnung   TEXT NOT NULL,                   -- z.B. "Edelstahl-Rohr V2A 1.4301 42,4mm"
  artikelnummer TEXT,                            -- optionale Lieferanten-Artikelnummer
  einheit       TEXT NOT NULL DEFAULT 'Stk',
  einkaufspreis NUMERIC(12,2) NOT NULL DEFAULT 0,
  lieferant     TEXT,
  preis_stand   DATE,                            -- Stand des Preises (Backlog: "datum")
  notiz         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE material_preise IS 'Material-Einkaufspreise pro Betrieb – speist Material-Kosten in Angebote';
COMMENT ON COLUMN material_preise.preis_stand IS 'Datum, zu dem der Einkaufspreis galt';

-- --------------------------------------------
-- angebote – generierte Angebote
-- --------------------------------------------
-- angebote ist laut INVENTUR leer → neu aufsetzen mit Säule-2-Schema
DROP TABLE IF EXISTS angebote CASCADE;

CREATE TABLE angebote (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id      UUID NOT NULL REFERENCES betriebe(id) ON DELETE CASCADE,
  anfrage_id      UUID REFERENCES anfragen(id) ON DELETE SET NULL,
  titel           TEXT,
  variante        TEXT NOT NULL DEFAULT 'standard'
                    CHECK (variante IN ('standard', 'premium', 'spar')),
  einleitung      TEXT,                          -- Freitext vor den Positionen
  positionen      JSONB NOT NULL DEFAULT '[]'::jsonb,
  schlusstext     TEXT,                          -- Freitext nach den Positionen
  summe_netto     NUMERIC(12,2) NOT NULL DEFAULT 0,
  mwst_satz       NUMERIC(5,2)  NOT NULL DEFAULT 19.00,
  summe_brutto    NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'entwurf'
                    CHECK (status IN ('entwurf', 'versendet', 'angenommen', 'abgelehnt')),
  angebotsnummer  TEXT,                          -- wird beim Finalisieren gesetzt
  gueltig_bis     DATE,
  notiz_intern    TEXT,
  versendet_am    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE angebote IS 'Generierte Angebote – mehrere Varianten (standard/premium/spar) pro Anfrage möglich';
COMMENT ON COLUMN angebote.positionen IS 'JSONB-Array von Positionen: [{ pos, bezeichnung, beschreibung, menge, einheit, einzelpreis_netto, gesamtpreis_netto, baustein_id }]';
COMMENT ON COLUMN angebote.status IS 'entwurf → versendet → angenommen/abgelehnt (Basis für späteres Conversion-Tracking)';

-- --------------------------------------------
-- Indizes
-- --------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bausteine_betrieb       ON angebot_bausteine(betrieb_id);
CREATE INDEX IF NOT EXISTS idx_bausteine_kategorie     ON angebot_bausteine(betrieb_id, kategorie);
CREATE INDEX IF NOT EXISTS idx_material_betrieb        ON material_preise(betrieb_id);
CREATE INDEX IF NOT EXISTS idx_angebote_betrieb        ON angebote(betrieb_id);
CREATE INDEX IF NOT EXISTS idx_angebote_anfrage        ON angebote(anfrage_id);

-- --------------------------------------------
-- updated_at-Trigger
-- --------------------------------------------
CREATE TRIGGER trg_bausteine_updated_at
  BEFORE UPDATE ON angebot_bausteine
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_material_updated_at
  BEFORE UPDATE ON material_preise
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_angebote_updated_at
  BEFORE UPDATE ON angebote
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
