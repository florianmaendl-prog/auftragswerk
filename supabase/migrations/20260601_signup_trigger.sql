-- ============================================
-- Welle G: Self-Service-Signup-Trigger
-- ============================================
-- Tag 16 (1.6.2026) – Welle G
--
-- Bisher: betriebe + profiles wurden manuell vom Admin (Flo) per SQL
-- angelegt, der User wurde händisch verknüpft. Nicht skalierbar.
--
-- Jetzt: Self-Service-Signup auf /registrieren. Der User gibt
-- Betriebsname + Inhaber + Branche an, ruft supabase.auth.signUp() mit
-- diesen Werten in options.data auf. Supabase schreibt die Werte in
-- raw_user_meta_data. Dieser Trigger fängt das Insert ab und legt
-- automatisch betriebe-Row (mit auto-generierter Subdomain-Adresse über
-- name_zu_slug aus Migration 20260601) + profiles-Row mit Rolle
-- 'inhaber' an.
--
-- Wenn raw_user_meta_data.betriebsname leer → Trigger tut nichts
-- (z.B. für manuelle Admin-Inserts ohne Self-Service).

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  betriebsname TEXT;
  inhaber_val TEXT;
  branche_val TEXT;
  basis_slug TEXT;
  kandidat TEXT;
  suffix INT;
  neuer_betrieb_id UUID;
BEGIN
  betriebsname := COALESCE(NEW.raw_user_meta_data->>'betriebsname', '');
  inhaber_val := COALESCE(NEW.raw_user_meta_data->>'inhaber', '');
  branche_val := COALESCE(NEW.raw_user_meta_data->>'branche', '');

  -- Ohne Betriebsname → kein auto-anlegen (z.B. Admin-Re-Insert)
  IF betriebsname = '' THEN
    RETURN NEW;
  END IF;

  -- Wenn schon ein profile mit betrieb_id existiert → skip
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.id AND betrieb_id IS NOT NULL
  ) THEN
    RETURN NEW;
  END IF;

  -- Slug + Conflict-Resolution (analog Migration 20260601_inbound_email_subdomain)
  basis_slug := public.name_zu_slug(betriebsname);
  kandidat := basis_slug || '@kunden.auftragswerk.app';
  suffix := 2;

  WHILE EXISTS (
    SELECT 1 FROM public.betriebe WHERE inbound_email = kandidat
  ) LOOP
    kandidat := basis_slug || '-' || suffix || '@kunden.auftragswerk.app';
    suffix := suffix + 1;
    IF suffix > 99 THEN
      RAISE EXCEPTION 'Slug-Kollisionen für "%": 99 Versuche fehlgeschlagen', betriebsname;
    END IF;
  END LOOP;

  INSERT INTO public.betriebe (name, inhaber, branche, inbound_email)
  VALUES (betriebsname, inhaber_val, branche_val, kandidat)
  RETURNING id INTO neuer_betrieb_id;

  INSERT INTO public.profiles (id, betrieb_id, rolle)
  VALUES (NEW.id, neuer_betrieb_id, 'inhaber')
  ON CONFLICT (id) DO UPDATE SET
    betrieb_id = EXCLUDED.betrieb_id,
    rolle = EXCLUDED.rolle;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
