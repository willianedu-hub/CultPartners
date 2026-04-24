-- ============================================================
--  Migration: Campo valor_estimado em oportunidades
--  Executar no Supabase SQL Editor (Project: kjzpjuxekzhjoyernxuv)
-- ============================================================
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC(14,2);
