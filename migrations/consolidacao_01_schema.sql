-- ============================================================
--  CONSOLIDAÇÃO — Parte 1/3: SCHEMA cultpartners no projeto ALVO
--  Rodar no SQL Editor do projeto DESTINO (xqrudhwtdwzmgwstcyoh)
--
--  Origem: kjzpjuxekzhjoyernxuv (public) → Destino: schema cultpartners
--  Este script cria SÓ a estrutura (sem dados). Dados = Parte 2.
--
--  Roda de uma vez, num schema cultpartners AINDA INEXISTENTE.
--  Se algo falhar no meio: DROP SCHEMA cultpartners CASCADE; e rode de novo.
-- ============================================================

-- ── 0. Schema + extensões + tipo ENUM ───────────────────────
CREATE SCHEMA IF NOT EXISTS cultpartners;

-- pgcrypto (senhas: crypt/gen_salt) e pg_trgm (índice fuzzy de empresa).
-- No Supabase as extensões vivem no schema `extensions` (compartilhado).
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA extensions;

-- Tipo ENUM da aprovação (não existia no repo — recuperado do banco vivo)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'aprovacao_status' AND n.nspname = 'cultpartners'
  ) THEN
    CREATE TYPE cultpartners.aprovacao_status AS ENUM ('Pendente','Aprovado','Rejeitado');
  END IF;
END $$;

SET search_path = cultpartners, extensions, public;

-- ── 1. Tabelas ──────────────────────────────────────────────
-- (colunas id são GENERATED ALWAYS AS IDENTITY — sequences internas,
--  NÃO criar sequences à mão)

CREATE TABLE IF NOT EXISTS cultpartners.admins (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nome text NOT NULL,
  login text NOT NULL,
  senha_hash text NOT NULL,
  email text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cultpartners.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tabela text NOT NULL,
  registro_id bigint NOT NULL,
  acao text NOT NULL,
  usuario text,
  dados_antes jsonb,
  dados_depois jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cultpartners.parceiros (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nome text NOT NULL,
  cnpj text,
  site text,
  login text NOT NULL,
  senha_hash text NOT NULL,
  email text,
  ativo boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cultpartners.produtos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nome text NOT NULL,
  categoria text,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ordem smallint DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cultpartners.status_funil (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#64748b'::text,
  ordem smallint NOT NULL DEFAULT 99,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cultpartners.oportunidades (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  empresa text NOT NULL,
  cnpj text,
  site_empresa text,
  contato text,
  cargo text,
  obs text,
  produto_id bigint,
  status_id bigint,
  fechamento date,
  parceiro_id bigint,
  aprovacao cultpartners.aprovacao_status NOT NULL DEFAULT 'Pendente'::cultpartners.aprovacao_status,
  approved_at timestamptz,
  approved_by bigint,
  motivo_rejeicao text,
  rejected_at timestamptz,
  rejected_by bigint,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  valor_estimado numeric(14,2)
);

CREATE TABLE IF NOT EXISTS cultpartners.tarefas (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  oportunidade_id bigint NOT NULL,
  descricao text NOT NULL,
  prazo date,
  responsavel text,
  concluida boolean NOT NULL DEFAULT false,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cultpartners.oportunidade_produtos (
  oportunidade_id integer NOT NULL,
  produto_id integer NOT NULL
);

CREATE TABLE IF NOT EXISTS cultpartners.preferencias_usuario (
  user_key text NOT NULL,
  colunas jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Constraints (PK / UNIQUE / FK) ───────────────────────
ALTER TABLE cultpartners.admins               ADD CONSTRAINT admins_pkey PRIMARY KEY (id);
ALTER TABLE cultpartners.admins               ADD CONSTRAINT admins_login_key UNIQUE (login);
ALTER TABLE cultpartners.audit_log            ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);
ALTER TABLE cultpartners.parceiros            ADD CONSTRAINT parceiros_pkey PRIMARY KEY (id);
ALTER TABLE cultpartners.parceiros            ADD CONSTRAINT parceiros_login_key UNIQUE (login);
ALTER TABLE cultpartners.produtos             ADD CONSTRAINT produtos_pkey PRIMARY KEY (id);
ALTER TABLE cultpartners.produtos             ADD CONSTRAINT produtos_nome_key UNIQUE (nome);
ALTER TABLE cultpartners.status_funil         ADD CONSTRAINT status_funil_pkey PRIMARY KEY (id);
ALTER TABLE cultpartners.status_funil         ADD CONSTRAINT status_funil_nome_key UNIQUE (nome);
ALTER TABLE cultpartners.oportunidades        ADD CONSTRAINT oportunidades_pkey PRIMARY KEY (id);
ALTER TABLE cultpartners.tarefas              ADD CONSTRAINT tarefas_pkey PRIMARY KEY (id);
ALTER TABLE cultpartners.preferencias_usuario ADD CONSTRAINT preferencias_usuario_pkey PRIMARY KEY (user_key);
ALTER TABLE cultpartners.oportunidade_produtos ADD CONSTRAINT oportunidade_produtos_pkey PRIMARY KEY (oportunidade_id, produto_id);

ALTER TABLE cultpartners.oportunidades ADD CONSTRAINT oportunidades_produto_id_fkey
  FOREIGN KEY (produto_id)  REFERENCES cultpartners.produtos(id)     ON DELETE SET NULL;
ALTER TABLE cultpartners.oportunidades ADD CONSTRAINT oportunidades_status_id_fkey
  FOREIGN KEY (status_id)   REFERENCES cultpartners.status_funil(id) ON DELETE SET NULL;
ALTER TABLE cultpartners.oportunidades ADD CONSTRAINT oportunidades_parceiro_id_fkey
  FOREIGN KEY (parceiro_id) REFERENCES cultpartners.parceiros(id)    ON DELETE SET NULL;
ALTER TABLE cultpartners.oportunidades ADD CONSTRAINT oportunidades_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES cultpartners.admins(id)       ON DELETE SET NULL;
ALTER TABLE cultpartners.oportunidades ADD CONSTRAINT oportunidades_rejected_by_fkey
  FOREIGN KEY (rejected_by) REFERENCES cultpartners.admins(id)       ON DELETE SET NULL;
ALTER TABLE cultpartners.tarefas ADD CONSTRAINT tarefas_oportunidade_id_fkey
  FOREIGN KEY (oportunidade_id) REFERENCES cultpartners.oportunidades(id) ON DELETE CASCADE;
ALTER TABLE cultpartners.oportunidade_produtos ADD CONSTRAINT oportunidade_produtos_oportunidade_id_fkey
  FOREIGN KEY (oportunidade_id) REFERENCES cultpartners.oportunidades(id) ON DELETE CASCADE;
ALTER TABLE cultpartners.oportunidade_produtos ADD CONSTRAINT oportunidade_produtos_produto_id_fkey
  FOREIGN KEY (produto_id) REFERENCES cultpartners.produtos(id);

-- ── 3. Índices ──────────────────────────────────────────────
CREATE INDEX idx_op_parceiro     ON cultpartners.oportunidades USING btree (parceiro_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_op_status       ON cultpartners.oportunidades USING btree (status_id)   WHERE (deleted_at IS NULL);
CREATE INDEX idx_op_aprovacao    ON cultpartners.oportunidades USING btree (aprovacao)   WHERE (deleted_at IS NULL);
CREATE INDEX idx_op_fechamento   ON cultpartners.oportunidades USING btree (fechamento)  WHERE (deleted_at IS NULL);
CREATE INDEX idx_op_deleted      ON cultpartners.oportunidades USING btree (deleted_at);
CREATE INDEX idx_op_empresa_trgm ON cultpartners.oportunidades USING gin (empresa extensions.gin_trgm_ops) WHERE (deleted_at IS NULL);
CREATE INDEX idx_op_cnpj         ON cultpartners.oportunidades USING btree (cnpj) WHERE ((deleted_at IS NULL) AND (cnpj IS NOT NULL));
CREATE INDEX idx_tarefas_op       ON cultpartners.tarefas USING btree (oportunidade_id);
CREATE INDEX idx_tarefas_pendente ON cultpartners.tarefas USING btree (oportunidade_id) WHERE (concluida = false);
CREATE INDEX idx_audit_tabela  ON cultpartners.audit_log USING btree (tabela, registro_id);
CREATE INDEX idx_audit_created ON cultpartners.audit_log USING btree (created_at DESC);
CREATE INDEX idx_parceiros_ativos ON cultpartners.parceiros USING btree (ativo) WHERE (deleted_at IS NULL);

-- ── 4. Funções do app (7) ───────────────────────────────────
-- Reescritas: public.* → cultpartners.*  +  search_path fixado
-- (SECURITY DEFINER precisa achar crypt/gen_salt em `extensions`)

CREATE OR REPLACE FUNCTION cultpartners.set_updated_at()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION cultpartners.fn_tarefas_concluida()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.concluida = TRUE AND OLD.concluida = FALSE THEN
    NEW.concluida_em = NOW();
  ELSIF NEW.concluida = FALSE THEN
    NEW.concluida_em = NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION cultpartners.fn_login_admin(p_login text, p_senha text)
 RETURNS TABLE(id bigint, nome text, login text, email text)
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = cultpartners, extensions, public
AS $function$
BEGIN
  RETURN QUERY
  SELECT a.id, a.nome, a.login, a.email
  FROM   cultpartners.admins a
  WHERE  a.login = p_login
    AND  a.ativo = TRUE
    AND  a.senha_hash = crypt(p_senha, a.senha_hash);
END;
$function$;

CREATE OR REPLACE FUNCTION cultpartners.fn_login_parceiro(p_login text, p_senha text)
 RETURNS TABLE(id bigint, nome text, login text, email text, site text)
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = cultpartners, extensions, public
AS $function$
BEGIN
  RETURN QUERY
  SELECT p.id, p.nome, p.login, p.email, p.site
  FROM   cultpartners.parceiros p
  WHERE  p.login = p_login
    AND  p.ativo = TRUE
    AND  p.deleted_at IS NULL
    AND  p.senha_hash = crypt(p_senha, p.senha_hash);
END;
$function$;

CREATE OR REPLACE FUNCTION cultpartners.fn_set_senha_admin(p_id bigint, p_senha text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = cultpartners, extensions, public
AS $function$
BEGIN
  UPDATE cultpartners.admins
  SET    senha_hash = crypt(p_senha, gen_salt('bf', 12)),
         updated_at = NOW()
  WHERE  id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION cultpartners.fn_set_senha_parceiro(p_id bigint, p_senha text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = cultpartners, extensions, public
AS $function$
BEGIN
  UPDATE cultpartners.parceiros
  SET    senha_hash = crypt(p_senha, gen_salt('bf', 12)),
         updated_at = NOW()
  WHERE  id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION cultpartners.fn_delete_oportunidade(p_id bigint, p_usuario text DEFAULT 'sistema'::text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = cultpartners, extensions, public
AS $function$
BEGIN
  INSERT INTO cultpartners.audit_log(tabela, registro_id, acao, usuario, dados_antes)
  SELECT 'oportunidades', id, 'DELETE', p_usuario, to_jsonb(o)
  FROM   cultpartners.oportunidades o WHERE id = p_id;

  UPDATE cultpartners.oportunidades
  SET    deleted_at = NOW(), updated_at = NOW()
  WHERE  id = p_id;
END;
$function$;

-- ── 5. View v_oportunidades (tabelas qualificadas) ──────────
CREATE OR REPLACE VIEW cultpartners.v_oportunidades AS
 SELECT op.id, op.empresa, op.cnpj, op.site_empresa, op.contato, op.cargo, op.obs,
    op.produto_id, pr.nome AS produto,
    op.status_id, sf.nome AS status, sf.cor AS status_cor,
    op.fechamento,
    op.parceiro_id, pa.nome AS parceiro_nome,
    op.aprovacao, op.approved_by, op.approved_at,
    op.rejected_by, op.rejected_at, op.motivo_rejeicao,
    op.deleted_at, op.created_at, op.valor_estimado,
    adm_apv.nome AS aprovado_por, adm_rej.nome AS rejeitado_por,
    (SELECT count(*) FROM cultpartners.tarefas t WHERE t.oportunidade_id = op.id) AS tarefas_total,
    (SELECT count(*) FROM cultpartners.tarefas t WHERE t.oportunidade_id = op.id AND t.concluida = false) AS tarefas_pendentes
   FROM cultpartners.oportunidades op
     LEFT JOIN cultpartners.produtos     pr      ON pr.id      = op.produto_id
     LEFT JOIN cultpartners.status_funil sf      ON sf.id      = op.status_id
     LEFT JOIN cultpartners.parceiros    pa      ON pa.id      = op.parceiro_id
     LEFT JOIN cultpartners.admins       adm_apv ON adm_apv.id = op.approved_by
     LEFT JOIN cultpartners.admins       adm_rej ON adm_rej.id = op.rejected_by
  WHERE op.deleted_at IS NULL;

-- ── 6. Triggers ─────────────────────────────────────────────
CREATE TRIGGER trg_admins_updated_at               BEFORE UPDATE ON cultpartners.admins               FOR EACH ROW EXECUTE FUNCTION cultpartners.set_updated_at();
CREATE TRIGGER trg_parceiros_updated_at            BEFORE UPDATE ON cultpartners.parceiros            FOR EACH ROW EXECUTE FUNCTION cultpartners.set_updated_at();
CREATE TRIGGER trg_status_funil_updated_at         BEFORE UPDATE ON cultpartners.status_funil         FOR EACH ROW EXECUTE FUNCTION cultpartners.set_updated_at();
CREATE TRIGGER trg_produtos_updated_at             BEFORE UPDATE ON cultpartners.produtos             FOR EACH ROW EXECUTE FUNCTION cultpartners.set_updated_at();
CREATE TRIGGER trg_oportunidades_updated_at        BEFORE UPDATE ON cultpartners.oportunidades        FOR EACH ROW EXECUTE FUNCTION cultpartners.set_updated_at();
CREATE TRIGGER trg_tarefas_updated_at              BEFORE UPDATE ON cultpartners.tarefas              FOR EACH ROW EXECUTE FUNCTION cultpartners.set_updated_at();
CREATE TRIGGER trg_preferencias_usuario_updated_at BEFORE UPDATE ON cultpartners.preferencias_usuario FOR EACH ROW EXECUTE FUNCTION cultpartners.set_updated_at();
CREATE TRIGGER trg_tarefas_concluida               BEFORE UPDATE ON cultpartners.tarefas              FOR EACH ROW EXECUTE FUNCTION cultpartners.fn_tarefas_concluida();

-- ── 7. RLS + políticas (réplica do padrão da origem) ────────
ALTER TABLE cultpartners.admins               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultpartners.parceiros            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultpartners.status_funil         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultpartners.produtos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultpartners.oportunidades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultpartners.tarefas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultpartners.preferencias_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultpartners.audit_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultpartners.oportunidade_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all       ON cultpartners.admins               FOR ALL    TO public USING (true) WITH CHECK (true);
CREATE POLICY allow_all       ON cultpartners.parceiros            FOR ALL    TO public USING (true) WITH CHECK (true);
CREATE POLICY escrita_publica ON cultpartners.status_funil         FOR ALL    TO public USING (true) WITH CHECK (true);
CREATE POLICY leitura_publica ON cultpartners.status_funil         FOR SELECT TO public USING (true);
CREATE POLICY escrita_publica ON cultpartners.produtos             FOR ALL    TO public USING (true) WITH CHECK (true);
CREATE POLICY leitura_publica ON cultpartners.produtos             FOR SELECT TO public USING (true);
CREATE POLICY allow_all       ON cultpartners.oportunidades        FOR ALL    TO public USING (true) WITH CHECK (true);
CREATE POLICY allow_all       ON cultpartners.tarefas              FOR ALL    TO public USING (true) WITH CHECK (true);
CREATE POLICY allow_all       ON cultpartners.preferencias_usuario FOR ALL    TO public USING (true) WITH CHECK (true);
CREATE POLICY allow_all       ON cultpartners.audit_log            FOR ALL    TO public USING (true) WITH CHECK (true);
CREATE POLICY allow_all       ON cultpartners.oportunidade_produtos FOR ALL   TO public USING (true) WITH CHECK (true);

-- ── 8. Grants (anon/authenticated/service_role via PostgREST) ─
GRANT USAGE ON SCHEMA cultpartners TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES     IN SCHEMA cultpartners TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES  IN SCHEMA cultpartners TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cultpartners TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cultpartners GRANT ALL     ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cultpartners GRANT ALL     ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cultpartners GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Recarrega o cache do PostgREST (senão as tabelas novas dão 404)
NOTIFY pgrst, 'reload schema';
