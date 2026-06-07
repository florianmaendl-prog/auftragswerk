-- ============================================
-- Welle E.2: Catch-All-Subdomain kunden.auftragswerk.app
-- ============================================
-- Tag 16 (1.6.2026) – Welle E.2
--
-- Bisher: jeder Betrieb hatte als inbound_email die Postmark-Hex-Adresse
-- (22410d58…@inbound.postmarkapp.com). Sieht "scammy" als Reply-To für
-- Endkunden, plus jeder Betrieb hatte die gleiche Hex → kein Mandanten-
-- Routing möglich.
--
-- Jetzt: pro Betrieb eine eigene saubere Subdomain-Adresse, z.B.
-- "mustermann-bau@kunden.auftragswerk.app". MX-Record für die Subdomain
-- routet alle Mails zu Postmark, Postmark forwarded an unseren Edge-Proxy.
--
-- Migration setzt für ALLE bestehenden Betriebe einen Slug-basierten
-- inbound_email-Wert. Slug = lowercase, Umlaute ersetzt (ä→ae etc.),
-- Sonderzeichen → Bindestrich, Rechtsformen (GmbH, AG, KG, …) raus.
-- Konflikte mit Suffix -2, -3 etc. aufgelöst.

-- Funktion: Name → Slug (Pure SQL, kein PL/pgSQL nötig für die Basis)
CREATE OR REPLACE FUNCTION name_zu_slug(input_name TEXT)
RETURNS TEXT AS $$
DECLARE
  slug TEXT;
BEGIN
  IF input_name IS NULL OR input_name = '' THEN
    RETURN 'betrieb';
  END IF;

  slug := input_name;

  -- Umlaute + ß
  slug := translate(slug, 'äöüÄÖÜß', 'aouAOUs');
  slug := replace(slug, 'a', 'a'); -- placeholder weil translate 1:1 zeichen tauscht
  -- Eigentliche Umlaut-Doppel-Substitution: ä→ae etc.
  slug := regexp_replace(slug, 'ä', 'ae', 'gi');
  slug := regexp_replace(slug, 'ö', 'oe', 'gi');
  slug := regexp_replace(slug, 'ü', 'ue', 'gi');
  slug := regexp_replace(slug, 'ß', 'ss', 'g');

  -- & und + zu " und "
  slug := regexp_replace(slug, '[&+]', ' und ', 'g');

  -- Lowercase, alles nicht-[a-z0-9] zu '-'
  slug := lower(slug);
  slug := regexp_replace(slug, '[^a-z0-9]+', '-', 'g');
  slug := regexp_replace(slug, '^-+|-+$', '', 'g');

  -- Stoppwörter (Rechtsformen) entfernen
  slug := regexp_replace(
    slug,
    '(^|-)(gmbh|mbh|ag|kg|ohg|ug|co|gbr|und|der|die|das)(-|$)',
    '\1\3',
    'gi'
  );
  slug := regexp_replace(slug, '-+', '-', 'g');
  slug := regexp_replace(slug, '^-+|-+$', '', 'g');

  -- Max 40 Zeichen, kein trailing Bindestrich
  slug := substring(slug from 1 for 40);
  slug := regexp_replace(slug, '-+$', '', 'g');

  IF slug = '' THEN
    RETURN 'betrieb';
  END IF;

  RETURN slug;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Migration: für jeden Betrieb einen eindeutigen Slug-basierten Wert in
-- inbound_email setzen. Wenn zwei Betriebe gleichen Wunsch-Slug haben,
-- kriegt der zweite -2, dritter -3 etc.
DO $$
DECLARE
  rec RECORD;
  basis_slug TEXT;
  kandidat TEXT;
  suffix INT;
BEGIN
  FOR rec IN
    SELECT id, name
    FROM betriebe
    ORDER BY created_at ASC NULLS LAST, id ASC
  LOOP
    basis_slug := name_zu_slug(COALESCE(rec.name, 'betrieb'));
    kandidat := basis_slug || '@kunden.auftragswerk.app';
    suffix := 2;

    -- Kollisions-Check mit bereits aktualisierten Zeilen
    WHILE EXISTS (
      SELECT 1 FROM betriebe
      WHERE inbound_email = kandidat
      AND id <> rec.id
    ) LOOP
      kandidat := basis_slug || '-' || suffix || '@kunden.auftragswerk.app';
      suffix := suffix + 1;
      IF suffix > 99 THEN
        RAISE EXCEPTION 'Slug-Konflikt für Betrieb %', rec.name;
      END IF;
    END LOOP;

    UPDATE betriebe SET inbound_email = kandidat WHERE id = rec.id;
  END LOOP;
END $$;

-- UNIQUE-Constraint damit zukünftig keine zwei Betriebe die gleiche
-- inbound_email kriegen. NULL ist erlaubt (für ältere Datenpfade).
CREATE UNIQUE INDEX IF NOT EXISTS betriebe_inbound_email_uniq
  ON betriebe (inbound_email)
  WHERE inbound_email IS NOT NULL;
