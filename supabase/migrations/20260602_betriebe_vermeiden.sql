-- ============================================
-- Tag 17 (2.6.2026) – "Vermeiden"-Feld pro Betrieb
-- ============================================
-- STRATEGIE.md Teil A1 "Entwurfsqualität". Heute hat die KI nur positive
-- Stil-Beispiele (ton_beispiele) – sie generalisiert daraus aber NICHT
-- automatisch was sie NICHT machen soll. Klassisches LLM-Problem:
-- wenn alle Stilbeispiele Gedankenstriche enthalten, denkt die KI das
-- ist Owner-Stil und nutzt sie häufiger.
--
-- Lösung: ein Freitext-Feld wo der Owner explizit negative Constraints
-- pflegt. Fließt als eigener Block in den System-Prompt von
-- lib/entwurf.ts:
--   "Keine Gedankenstriche im Mitteltext."
--   "Sag 'gern' statt 'gerne'."
--   "Nicht zu förmlich, ich duze viele Kunden."

ALTER TABLE betriebe
  ADD COLUMN IF NOT EXISTS vermeiden TEXT;

COMMENT ON COLUMN betriebe.vermeiden IS
  'Freitext mit negativen Stil-Constraints (was die KI vermeiden soll). Fließt als eigener VERMEIDEN-Block in den Entwurf-System-Prompt (lib/entwurf.ts). Pendant zu ton_beispiele (positiv).';
