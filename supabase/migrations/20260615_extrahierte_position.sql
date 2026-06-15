-- ============================================
-- Tag 21 (15.6.2026) – Position/Titel zur KI-Extraktion
-- ============================================
-- Aus Pilot-Feedback: bei B2B-Anfragen (Architekten, Bauträger, GU,
-- Hausverwaltungen) ist die Position des Absenders wichtige Kontakt-
-- Info fürs Kundenprofil. Beispiele die KI heute schon erkennen
-- könnte aber nicht ausgibt: "Geschäftsführer", "Architekt",
-- "Bauleiter", "Hausverwaltung", "Einkauf".
--
-- KI-Pfad: System-Prompt in lib/klassifikation.ts erweitert um
-- "extrahierte_position", Output-Schema ergänzt. UI in Kunden-Detail
-- zeigt das Feld wenn nicht leer.

ALTER TABLE analysen
  ADD COLUMN IF NOT EXISTS extrahierte_position TEXT;

COMMENT ON COLUMN analysen.extrahierte_position IS
  'KI-extrahierte berufliche Rolle/Funktion des Absenders (z.B. "Geschäftsführer", "Architekt", "Hausverwaltung"). Nur gesetzt wenn in Mail/Signatur erkennbar.';
