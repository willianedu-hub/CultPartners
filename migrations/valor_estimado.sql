-- ============================================================
--  Migration: Campo valor_estimado em oportunidades
--  Executar no Supabase SQL Editor (Project: kjzpjuxekzhjoyernxuv)
--
--  IMPORTANTE: Em PostgreSQL, views com SELECT * NÃO refletem
--  automaticamente colunas novas. Por isso este script também
--  recria a v_oportunidades incluindo valor_estimado.
-- ============================================================

-- 1. Adiciona coluna na tabela base
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC(14,2);

-- 2. Recria a view para incluir valor_estimado
--    (necessário pois views não atualizam automaticamente)
CREATE OR REPLACE VIEW v_oportunidades AS
SELECT
  op.id,
  op.empresa,
  op.cnpj,
  op.site_empresa,
  op.contato,
  op.cargo,
  op.obs,
  op.produto_id,
  pr.nome        AS produto,
  op.status_id,
  sf.nome        AS status,
  sf.cor         AS status_cor,
  op.fechamento,
  op.parceiro_id,
  pa.nome        AS parceiro_nome,
  op.aprovacao,
  op.approved_by,
  op.approved_at,
  op.rejected_by,
  op.rejected_at,
  op.motivo_rejeicao,
  op.deleted_at,
  op.created_at,
  op.valor_estimado,
  adm_apv.nome  AS aprovado_por,
  adm_rej.nome  AS rejeitado_por,
  (SELECT COUNT(*)
     FROM tarefas t
    WHERE t.oportunidade_id = op.id)                        AS tarefas_total,
  (SELECT COUNT(*)
     FROM tarefas t
    WHERE t.oportunidade_id = op.id AND t.concluida = false) AS tarefas_pendentes
FROM oportunidades op
LEFT JOIN produtos     pr      ON pr.id      = op.produto_id
LEFT JOIN status_funil sf      ON sf.id      = op.status_id
LEFT JOIN parceiros    pa      ON pa.id      = op.parceiro_id
LEFT JOIN admins       adm_apv ON adm_apv.id = op.approved_by
LEFT JOIN admins       adm_rej ON adm_rej.id = op.rejected_by
WHERE op.deleted_at IS NULL;
