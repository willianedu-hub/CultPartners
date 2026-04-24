-- ============================================================
--  Seed: 5 oportunidades para parceiro Movti (id = 11)
--  Executar no Supabase SQL Editor (Project: kjzpjuxekzhjoyernxuv)
--
--  Pré-requisito: migrations/multi_produto.sql e
--                 migrations/valor_estimado.sql já executadas.
-- ============================================================

WITH
-- ── Oportunidade 1: Banco Meridional ─────────────────────────
op1 AS (
  INSERT INTO oportunidades (
    empresa, cnpj, site_empresa, contato, cargo,
    produto_id, status_id, fechamento,
    parceiro_id, aprovacao, approved_by, approved_at,
    valor_estimado, obs
  ) VALUES (
    'Banco Meridional S.A.',
    '12.345.678/0001-90',
    'bancomeridional.com.br',
    'Ricardo Ferreira',
    'Diretor de Segurança da Informação',
    (SELECT id FROM produtos WHERE nome = 'Assessment de Conscientização' AND ativo = true LIMIT 1),
    (SELECT id FROM status_funil WHERE nome = 'Negociação' AND ativo = true LIMIT 1),
    '2025-07-01',
    11,
    'Aprovado',
    (SELECT id FROM admins LIMIT 1),
    NOW() - INTERVAL '15 days',
    85000.00,
    'Cliente com histórico de incidentes de phishing. Alto potencial de expansão para treinamentos recorrentes.'
  ) RETURNING id
),

-- ── Oportunidade 2: TechSul Sistemas ─────────────────────────
op2 AS (
  INSERT INTO oportunidades (
    empresa, cnpj, site_empresa, contato, cargo,
    produto_id, status_id, fechamento,
    parceiro_id, aprovacao, approved_by, approved_at,
    valor_estimado, obs
  ) VALUES (
    'TechSul Sistemas Ltda',
    '98.765.432/0001-11',
    'techsul.com.br',
    'Camila Ramos',
    'Gerente de TI',
    (SELECT id FROM produtos WHERE nome = 'CTF (Capture The Flag)' AND ativo = true LIMIT 1),
    (SELECT id FROM status_funil WHERE nome = 'Proposta' AND ativo = true LIMIT 1),
    '2025-08-01',
    11,
    'Aprovado',
    (SELECT id FROM admins LIMIT 1),
    NOW() - INTERVAL '5 days',
    42500.00,
    'Equipe técnica muito engajada. Preferência por dinâmicas gamificadas.'
  ) RETURNING id
),

-- ── Oportunidade 3: Clínica São Luiz ─────────────────────────
op3 AS (
  INSERT INTO oportunidades (
    empresa, cnpj, site_empresa, contato, cargo,
    produto_id, status_id, fechamento,
    parceiro_id, aprovacao,
    valor_estimado, obs
  ) VALUES (
    'Clínica São Luiz',
    '45.678.901/0001-23',
    'clinicasaoluiz.com.br',
    'Dra. Marina Costa',
    'Diretora Administrativa',
    (SELECT id FROM produtos WHERE nome = 'Programa de Conscientização' AND ativo = true LIMIT 1),
    (SELECT id FROM status_funil WHERE nome = 'Qualificado' AND ativo = true LIMIT 1),
    '2025-09-01',
    11,
    'Pendente',
    28000.00,
    'Setor de saúde com dados LGPD sensíveis. Necessidade urgente de conscientização da equipe administrativa.'
  ) RETURNING id
),

-- ── Oportunidade 4: Construservice Engenharia ─────────────────
op4 AS (
  INSERT INTO oportunidades (
    empresa, cnpj, site_empresa, contato, cargo,
    produto_id, status_id, fechamento,
    parceiro_id, aprovacao, approved_by, approved_at,
    valor_estimado, obs
  ) VALUES (
    'Construservice Engenharia',
    '32.109.876/0001-44',
    'construservice.com.br',
    'Paulo Mendes',
    'Gerente de RH',
    (SELECT id FROM produtos WHERE nome = 'Sala Interativa' AND ativo = true LIMIT 1),
    (SELECT id FROM status_funil WHERE nome = 'Proposta' AND ativo = true LIMIT 1),
    '2025-10-01',
    11,
    'Aprovado',
    (SELECT id FROM admins LIMIT 1),
    NOW() - INTERVAL '3 days',
    120000.00,
    'Maior contrato em andamento. Cliente quer experiência imersiva para 400 colaboradores distribuídos em 3 filiais.'
  ) RETURNING id
),

-- ── Oportunidade 5: Grupo Alfa Varejo ─────────────────────────
op5 AS (
  INSERT INTO oportunidades (
    empresa, cnpj, site_empresa, contato, cargo,
    produto_id, status_id, fechamento,
    parceiro_id, aprovacao, approved_by, approved_at,
    valor_estimado, obs
  ) VALUES (
    'Grupo Alfa Varejo',
    '67.890.123/0001-56',
    'grupoalfa.com.br',
    'Fernanda Lima',
    'Coordenadora de Compliance',
    (SELECT id FROM produtos WHERE nome = 'Programa Pocket' AND ativo = true LIMIT 1),
    (SELECT id FROM status_funil WHERE nome = 'Ganho' AND ativo = true LIMIT 1),
    '2025-06-01',
    11,
    'Aprovado',
    (SELECT id FROM admins LIMIT 1),
    NOW() - INTERVAL '30 days',
    35800.00,
    'Negócio fechado. Contrato assinado para conscientização de 200 funcionários do varejo.'
  ) RETURNING id
),

-- ── Junction: produtos de cada oportunidade ───────────────────
prods AS (
  SELECT id, nome FROM produtos WHERE ativo = true
    AND nome IN (
      'Assessment de Conscientização',
      'Palestras',
      'Phishing Físico',
      'Plataforma de Phishing e E-learning',
      'Treinamentos Personalizados',
      'CTF (Capture The Flag)',
      'Escape Room Virtual',
      'Table Top Exercise',
      'Vídeos (Pílulas / SCORM)',
      'Programa de Conscientização',
      'Comunicados Textuais e Visuais',
      'Show de Sósia',
      'Sala Interativa',
      'Robôs Interativos',
      'Espelho Interativo',
      'Roda da Fortuna',
      'Programa Pocket',
      'Plano de Comunicação — Basic',
      'Gerenciamento de Plataformas'
    )
)
INSERT INTO oportunidade_produtos (oportunidade_id, produto_id)
-- Op1 — Banco Meridional (5 produtos)
SELECT op1.id, prods.id FROM op1, prods
  WHERE prods.nome IN (
    'Assessment de Conscientização', 'Palestras', 'Phishing Físico',
    'Plataforma de Phishing e E-learning', 'Treinamentos Personalizados'
  )
UNION ALL
-- Op2 — TechSul Sistemas (4 produtos)
SELECT op2.id, prods.id FROM op2, prods
  WHERE prods.nome IN (
    'CTF (Capture The Flag)', 'Escape Room Virtual',
    'Table Top Exercise', 'Vídeos (Pílulas / SCORM)'
  )
UNION ALL
-- Op3 — Clínica São Luiz (3 produtos)
SELECT op3.id, prods.id FROM op3, prods
  WHERE prods.nome IN (
    'Programa de Conscientização', 'Comunicados Textuais e Visuais', 'Show de Sósia'
  )
UNION ALL
-- Op4 — Construservice Engenharia (5 produtos)
SELECT op4.id, prods.id FROM op4, prods
  WHERE prods.nome IN (
    'Sala Interativa', 'Robôs Interativos', 'Espelho Interativo',
    'Palestras', 'Roda da Fortuna'
  )
UNION ALL
-- Op5 — Grupo Alfa Varejo (3 produtos)
SELECT op5.id, prods.id FROM op5, prods
  WHERE prods.nome IN (
    'Programa Pocket', 'Plano de Comunicação — Basic', 'Gerenciamento de Plataformas'
  )
ON CONFLICT DO NOTHING;
