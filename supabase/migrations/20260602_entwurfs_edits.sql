-- ============================================
-- Tag 17 (2.6.2026) – Edit-Diff Phase 1
-- ============================================
-- STRATEGIE.md Teil A1: "Lernen aus Edits" – der Hebel hinter
-- Ton-Treffsicherheit. Phase 1 ist minimal-invasiv: wir speichern
-- den initialen KI-Entwurf separat (text_original) und vergleichen
-- ihn beim Versand mit dem final gesendeten Text (was_edited).
--
-- Daraus baut Flo später ein Diagnose-View "wie oft editiert Max?
-- was sind die häufigsten Änderungen?", manuelles Prompt-Tuning
-- (Phase 2 wäre Auto-Stilbeispiel-Vorschlag, Phase 3 voll-auto).

ALTER TABLE entwuerfe
  ADD COLUMN IF NOT EXISTS text_original TEXT,
  ADD COLUMN IF NOT EXISTS was_edited BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN entwuerfe.text_original IS
  'Initialer KI-Entwurf (body_text zum Zeitpunkt des KI-Generates). Wird beim Insert in lib/entwurf.ts gesetzt, danach NIE überschrieben. Beim Versand vs. body_text verglichen → was_edited.';
COMMENT ON COLUMN entwuerfe.was_edited IS
  'true wenn body_text beim Versand != text_original (Owner hat editiert). Default false, gesetzt in app/api/versand/route.ts beim finalen Status-Update.';

-- Backfill für bestehende Zeilen: text_original = body_text
-- (rückwirkend wissen wir nicht ob editiert wurde, deshalb was_edited=false)
UPDATE entwuerfe
   SET text_original = body_text
 WHERE text_original IS NULL;
