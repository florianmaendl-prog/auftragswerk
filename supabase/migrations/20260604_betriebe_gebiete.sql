-- ============================================
-- Tag 18 (4.6.2026) – Einzugsgebiet + gebiets-abhängiger Mindestauftragswert
-- ============================================
-- Aus Pilot-Feedback Tag 18: ein globaler Mindestauftragswert ergibt keinen
-- Sinn. Handwerker fahren in der Heimat-PLZ auch für 100€, aber 60km
-- weiter nur ab 5.000€. KI soll bei Anfragen die geografische und
-- wertmäßige Passung mitprüfen.
--
-- Datenstruktur in betriebe.gebiete (jsonb-Array):
--   [
--     { "plz_muster": "85*",  "label": "Hauptgebiet",       "mindestauftragswert": 100 },
--     { "plz_muster": "86*",  "label": "Augsburg & Umkreis", "mindestauftragswert": 5000 },
--     { "plz_muster": "*",    "label": "Sonst",              "mindestauftragswert": 20000 }
--   ]
--
-- Logik: erste Übereinstimmung gewinnt → User sortiert spezifischste
-- Muster nach oben, "*" als Fallback nach unten. Pattern-Matching
-- macht heute die KI selbst im Prompt (sie kennt PLZ→Stadt-Mapping aus
-- ihrem Training). V2 könnte echte Code-side Match-Logik werden.
--
-- Die alte Spalte betriebe.mindestauftragswert bleibt als globaler
-- Fallback wenn gebiete leer ist (Backward-Compat). Sobald gebiete
-- befüllt → gilt das Tier-System.

ALTER TABLE betriebe
  ADD COLUMN IF NOT EXISTS gebiete JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN betriebe.gebiete IS
  'Array<{plz_muster, label, mindestauftragswert}>. Pattern-Match in Reihenfolge – erste Übereinstimmung gewinnt. "*" als Wildcard-Fallback. KI nutzt die Liste im Entwurf-Prompt für gebiets-abhängige Antworten (z.B. "leider außerhalb unseres Standardgebiets").';
