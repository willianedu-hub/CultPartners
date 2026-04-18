-- ============================================================
--  takoda_part2_rls_functions.sql — RLS, Funções RPC e Trigger
--  Execute APÓS takoda_part1_schema.sql
-- ============================================================

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE admins               ENABLE ROW LEVEL SECURITY;
ALTER TABLE parceiros            ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_funil         ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE oportunidades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferencias_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all ON admins               FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON parceiros            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON status_funil         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON produtos             FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON oportunidades        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON tarefas              FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON preferencias_usuario FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON audit_log            FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── FUNÇÕES RPC ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_login_admin(p_login TEXT, p_senha TEXT)
RETURNS TABLE(id INTEGER, nome TEXT, email TEXT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT a.id, a.nome, a.email
  FROM admins a
  WHERE a.login = p_login
    AND a.senha_hash = crypt(p_senha, a.senha_hash)
    AND a.ativo = true;
$$;

CREATE OR REPLACE FUNCTION fn_login_parceiro(p_login TEXT, p_senha TEXT)
RETURNS TABLE(id INTEGER, nome TEXT, email TEXT, site TEXT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT p.id, p.nome, p.email, p.site
  FROM parceiros p
  WHERE p.login = p_login
    AND p.senha_hash = crypt(p_senha, p.senha_hash)
    AND p.ativo = true
    AND p.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION fn_set_senha_admin(p_id INTEGER, p_senha TEXT)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE admins
  SET senha_hash = crypt(p_senha, gen_salt('bf', 12))
  WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION fn_set_senha_parceiro(p_id INTEGER, p_senha TEXT)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE parceiros
  SET senha_hash = crypt(p_senha, gen_salt('bf', 12))
  WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION fn_delete_oportunidade(p_id INTEGER, p_usuario TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_dados JSONB;
BEGIN
  SELECT row_to_json(o)::jsonb INTO v_dados
  FROM oportunidades o WHERE id = p_id;

  UPDATE oportunidades SET deleted_at = now() WHERE id = p_id;

  INSERT INTO audit_log (tabela, registro_id, acao, usuario, dados_antes)
  VALUES ('oportunidades', p_id, 'DELETE', p_usuario, v_dados);
END;
$$;

-- ── TRIGGER updated_at ───────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_opp_updated
  BEFORE UPDATE ON oportunidades
  FOR EACH ROW EXECUTE FUNCTION fn_updated_at();

-- ── FIM DA PARTE 2 ───────────────────────────────────────────
-- Execute takoda_part3_seed_base.sql a seguir
