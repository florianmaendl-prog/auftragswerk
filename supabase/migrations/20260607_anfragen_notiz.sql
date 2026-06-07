-- ============================================
-- Tag 19 (7.6.2026) – Interne Owner-Notiz pro Anfrage
-- ============================================
-- Sprint 6 Polish-Welle. Handwerker telefonieren oft parallel zur
-- Mail-Konversation – wenn Max mit Frau Müller telefoniert hat
-- ("zahlt schlecht, lieber 50% Anzahlung verlangen"), braucht er ein
-- freies Notiz-Feld an der Anfrage. Heute gibt es nur
-- entwuerfe.interne_notiz (KI-generiert), aber nichts owner-eigenes.
--
-- Bewusst minimal: ein TEXT-Feld, kein Markdown, kein Notiz-Verlauf.
-- Auto-Save beim Blur in der Detail-Page.

ALTER TABLE anfragen
  ADD COLUMN IF NOT EXISTS notiz TEXT;

COMMENT ON COLUMN anfragen.notiz IS
  'Freie Owner-Notiz pro Anfrage (intern, nicht in Mails sichtbar). Für Telefonat-Erinnerungen, Kunden-Eigenheiten, eigene Marker. Wird in der Anfrage-Detail-Page editierbar angezeigt.';
