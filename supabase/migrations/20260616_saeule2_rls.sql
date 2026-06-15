-- ============================================
-- Säule 2 – RLS-Policies nachziehen
-- ============================================
-- Die ursprüngliche Säule-2-Migration (20260522_saeule2_angebote.sql)
-- hat bewusst auf RLS verzichtet, mit Verweis "Multi-Tenant-RLS kommt
-- gebündelt in der Skalierungs-Phase". Diese Phase ist jetzt: Welle P5
-- (Mini-CRM) hat überall RLS, und wir wollen vor Innung-Go-Live keine
-- Tabelle ohne Betrieb-Scope haben.
--
-- Idempotent: DROP POLICY IF EXISTS vor jedem CREATE.

-- angebot_bausteine
ALTER TABLE angebot_bausteine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "angebot_bausteine_select_own_betrieb" ON angebot_bausteine;
CREATE POLICY "angebot_bausteine_select_own_betrieb" ON angebot_bausteine
  FOR SELECT USING (betrieb_id = current_betrieb_id());

DROP POLICY IF EXISTS "angebot_bausteine_modify_own_betrieb" ON angebot_bausteine;
CREATE POLICY "angebot_bausteine_modify_own_betrieb" ON angebot_bausteine
  FOR ALL USING (betrieb_id = current_betrieb_id())
  WITH CHECK (betrieb_id = current_betrieb_id());

-- material_preise
ALTER TABLE material_preise ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "material_preise_select_own_betrieb" ON material_preise;
CREATE POLICY "material_preise_select_own_betrieb" ON material_preise
  FOR SELECT USING (betrieb_id = current_betrieb_id());

DROP POLICY IF EXISTS "material_preise_modify_own_betrieb" ON material_preise;
CREATE POLICY "material_preise_modify_own_betrieb" ON material_preise
  FOR ALL USING (betrieb_id = current_betrieb_id())
  WITH CHECK (betrieb_id = current_betrieb_id());

-- angebote
ALTER TABLE angebote ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "angebote_select_own_betrieb" ON angebote;
CREATE POLICY "angebote_select_own_betrieb" ON angebote
  FOR SELECT USING (betrieb_id = current_betrieb_id());

DROP POLICY IF EXISTS "angebote_modify_own_betrieb" ON angebote;
CREATE POLICY "angebote_modify_own_betrieb" ON angebote
  FOR ALL USING (betrieb_id = current_betrieb_id())
  WITH CHECK (betrieb_id = current_betrieb_id());
