-- ============================================
-- Sprint 2 – analysen.kurzfassung (max 80 Zeichen)
-- ============================================
-- Aus Max-Audio 3.7.: „die zusammenfassung in der detailview ist mir
-- zu lang für die inbox, gib der KI ein zeichenlimit".
--
-- Neue Spalte `kurzfassung` an analysen: max ~80 Zeichen, Absender +
-- Anliegen kompakt ("Metallbau Rapp will Angebot für Edelstahl-Geländer",
-- "Newsletter Hero-Software"). Wird in der Inbox als Subline unter dem
-- Betreff gerendert (line-clamp-1).
--
-- Bestandsanalysen bleiben ohne kurzfassung – die Inbox fällt dann auf
-- die ersten 80 Zeichen der langen zusammenfassung zurück, damit der
-- Rollout keinen Big-Bang braucht.

ALTER TABLE analysen ADD COLUMN IF NOT EXISTS kurzfassung TEXT;

-- PostgREST-Schema-Cache neu laden damit das Feld ohne Redeploy in
-- Prod verfügbar ist.
NOTIFY pgrst, 'reload schema';
