-- ============================================
-- Tag 19 (5.6.2026) – Eskalations-Erkennung in der Klassifikation
-- ============================================
-- STRATEGIE.md TEIL A1 Punkt 6 – Inhalts-Guardrails.
--
-- Die Klassifikations-KI (Haiku) erkennt jetzt Eskalations-Signale in
-- der Anfrage:
--   - Beschwerden, Reklamationen, Mängelrügen
--   - Anwalt-/RA-Schreiben, Klage-Andeutungen
--   - Drohungen, stark aggressiver Ton
--   - Hartnäckige Wiederholungs-Forderungen mit Druck
--
-- Wenn `eskalation_erkannt=true` → die Pipeline baut KEINEN Auto-Entwurf
-- (Iron Rule 3 "KI baut Entwurf für ALLE" bewusst umgangen). Status wird
-- auf 'manuell_pruefen' gesetzt + Hinweis in interne_notiz: "Owner muss
-- selbst antworten – Eskalation: <grund>".
--
-- Damit fängt die KI das ab, BEVOR ein lockerer Entwurf gegen einen
-- wütenden Kunden geht. Reputational + rechtlicher Schutz.

ALTER TABLE analysen
  ADD COLUMN IF NOT EXISTS eskalation_erkannt BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eskalation_grund TEXT;

COMMENT ON COLUMN analysen.eskalation_erkannt IS
  'KI hat Beschwerde/Anwalt/Mängelrüge/Drohung erkannt. Pipeline skipped Entwurfsgenerierung → Status manuell_pruefen mit Hinweis in interne_notiz.';
COMMENT ON COLUMN analysen.eskalation_grund IS
  '1-Satz-Begründung warum die KI eskaliert hat (z.B. "Kunde erwähnt Anwalt", "Mängelrüge mit Fristsetzung").';
