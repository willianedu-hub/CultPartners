-- ============================================================
--  takoda_part1_schema.sql — Extensões, tipos e tabelas
--  Execute PRIMEIRO no Supabase SQL Editor
-- ============================================================

-- Extensão para bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tipo ENUM de aprovação
DO $$ BEGIN
  CREATE TYPE aprovacao_enum AS ENUM ('Pendente', 'Aprovado', 'Rejeitado');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── DROP (ordem inversa) ─────────────────────────────────────
DROP VIEW  IF EXISTS v_oportunidades      CASCADE;
DROP TABLE IF EXISTS audit_log            CASCADE;
DROP TABLE IF EXISTS preferencias_usuario CASCADE;
DROP TABLE IF EXISTS tarefas              CASCADE;
DROP TABLE IF EXISTS oportunidades        CASCADE;
DROP TABLE IF EXISTS status_funil         CASCADE;
DROP TABLE IF EXISTS produtos             CASCADE;
DROP TABLE IF EXISTS parceiros            CASCADE;
DROP TABLE IF EXISTS admins               CASCADE;

-- ── TABELAS ──────────────────────────────────────────────────

CREATE TABLE admins (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL,
  login      TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  email      TEXT,
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE parceiros (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL,
  cnpj       TEXT,
  site       TEXT,
  login      TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  email      TEXT,
  ativo      BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE status_funil (
  id    SERIAL PRIMARY KEY,
  nome  TEXT UNIQUE NOT NULL,
  cor   TEXT NOT NULL DEFAULT '#6b7280',
  ordem SMALLINT DEFAULT 0,
  ativo BOOLEAN DEFAULT true
);

CREATE TABLE produtos (
  id        SERIAL PRIMARY KEY,
  nome      TEXT UNIQUE NOT NULL,
  categoria TEXT,
  descricao TEXT,
  ativo     BOOLEAN DEFAULT true
);

CREATE TABLE oportunidades (
  id              SERIAL PRIMARY KEY,
  empresa         TEXT NOT NULL,
  cnpj            TEXT,
  site_empresa    TEXT,
  contato         TEXT,
  cargo           TEXT,
  obs             TEXT,
  produto_id      INTEGER REFERENCES produtos(id),
  status_id       INTEGER REFERENCES status_funil(id),
  fechamento      DATE,
  parceiro_id     INTEGER REFERENCES parceiros(id),
  aprovacao       aprovacao_enum NOT NULL DEFAULT 'Pendente',
  approved_by     INTEGER REFERENCES admins(id),
  approved_at     TIMESTAMPTZ,
  rejected_by     INTEGER REFERENCES admins(id),
  rejected_at     TIMESTAMPTZ,
  motivo_rejeicao TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tarefas (
  id              SERIAL PRIMARY KEY,
  oportunidade_id INTEGER NOT NULL REFERENCES oportunidades(id) ON DELETE CASCADE,
  descricao       TEXT NOT NULL,
  prazo           DATE,
  responsavel     TEXT,
  concluida       BOOLEAN DEFAULT false,
  concluida_em    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE preferencias_usuario (
  user_key   TEXT PRIMARY KEY,
  colunas    JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_log (
  id          SERIAL PRIMARY KEY,
  tabela      TEXT,
  registro_id INTEGER,
  acao        TEXT,
  usuario     TEXT,
  dados_antes  JSONB,
  dados_depois JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── VIEW ─────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_oportunidades AS
SELECT
  o.id,
  o.empresa,
  o.cnpj,
  o.site_empresa,
  o.contato,
  o.cargo,
  o.obs,
  o.fechamento,
  o.aprovacao,
  o.motivo_rejeicao,
  o.approved_at,
  o.rejected_at,
  o.created_at,
  o.updated_at,
  o.deleted_at,
  o.parceiro_id,
  p.nome        AS parceiro,
  p.site        AS parceiro_site,
  o.produto_id,
  pr.nome       AS produto,
  pr.categoria  AS produto_categoria,
  o.status_id,
  sf.nome       AS status,
  sf.cor        AS status_cor,
  o.approved_by,
  aa.nome       AS aprovado_por,
  o.rejected_by,
  ra.nome       AS rejeitado_por,
  (SELECT COUNT(*) FROM tarefas t WHERE t.oportunidade_id = o.id)                        AS tarefas_total,
  (SELECT COUNT(*) FROM tarefas t WHERE t.oportunidade_id = o.id AND NOT t.concluida)    AS tarefas_pendentes
FROM oportunidades o
LEFT JOIN parceiros    p  ON p.id  = o.parceiro_id
LEFT JOIN produtos     pr ON pr.id = o.produto_id
LEFT JOIN status_funil sf ON sf.id = o.status_id
LEFT JOIN admins       aa ON aa.id = o.approved_by
LEFT JOIN admins       ra ON ra.id = o.rejected_by
WHERE o.deleted_at IS NULL;

-- ── FIM DA PARTE 1 ───────────────────────────────────────────
-- Execute takoda_part2_rls_functions.sql a seguir
