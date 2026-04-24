-- ============================================================
--  Migration: Multi-produto por oportunidade
--  Executar no Supabase SQL Editor (Project: kjzpjuxekzhjoyernxuv)
--
--  O que faz:
--  1. Adiciona coluna `ordem` em produtos (se não existir)
--  2. Cria tabela `oportunidade_produtos` (N:N)
--  3. Desativa produtos antigos
--  4. Insere catálogo completo (35 produtos, 5 categorias)
--  5. Migra produto_id existente → junction (best-effort)
-- ============================================================

-- 1. Coluna ordem em produtos
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ordem SMALLINT DEFAULT 0;

-- 2. Tabela junction
CREATE TABLE IF NOT EXISTS oportunidade_produtos (
  oportunidade_id INTEGER NOT NULL REFERENCES oportunidades(id) ON DELETE CASCADE,
  produto_id      INTEGER NOT NULL REFERENCES produtos(id),
  PRIMARY KEY (oportunidade_id, produto_id)
);

-- 3. Desativa produtos antigos
UPDATE produtos SET ativo = false;

-- 4. Insere novos produtos
INSERT INTO produtos (nome, categoria, ordem, ativo) VALUES
-- Programas de Consultoria
('Assessment de Conscientização',  'Programas de Consultoria', 1,  true),
('Programa de Conscientização',    'Programas de Consultoria', 2,  true),
('Programa Pocket',                'Programas de Consultoria', 3,  true),
('Plano de Comunicação — Basic',   'Programas de Consultoria', 4,  true),
('Plano de Comunicação — Standard','Programas de Consultoria', 5,  true),
('Plano de Comunicação — Advanced','Programas de Consultoria', 6,  true),
('Plano de Comunicação — Customizado','Programas de Consultoria', 7, true),
-- Ações de Conscientização
('Palestras',               'Ações de Conscientização', 10, true),
('Show de Sósia',           'Ações de Conscientização', 11, true),
('Sala Interativa',         'Ações de Conscientização', 12, true),
('Estações de Configuração','Ações de Conscientização', 13, true),
('Phishing Físico',         'Ações de Conscientização', 14, true),
('The Insider Man',         'Ações de Conscientização', 15, true),
('Robôs Interativos',       'Ações de Conscientização', 16, true),
('Espelho Interativo',      'Ações de Conscientização', 17, true),
('Palestra Holográfica',    'Ações de Conscientização', 18, true),
('Totens e Telas',          'Ações de Conscientização', 19, true),
-- Jogos e Dinâmicas
('Escape Room Físico',          'Jogos e Dinâmicas', 20, true),
('Escape Room Virtual',         'Jogos e Dinâmicas', 21, true),
('CTF (Capture The Flag)',       'Jogos e Dinâmicas', 22, true),
('Table Top Exercise',           'Jogos e Dinâmicas', 23, true),
('UNO da Conscientização',       'Jogos e Dinâmicas', 24, true),
('Tabuleiro da Conscientização', 'Jogos e Dinâmicas', 25, true),
('Batalha Naval',                'Jogos e Dinâmicas', 26, true),
('Detetive',                     'Jogos e Dinâmicas', 27, true),
('Roda da Fortuna',              'Jogos e Dinâmicas', 28, true),
('Passa ou Repassa',             'Jogos e Dinâmicas', 29, true),
('Imagem e Ação',                'Jogos e Dinâmicas', 30, true),
('O Garra do Phishing',          'Jogos e Dinâmicas', 31, true),
('Doce ou Travessura',           'Jogos e Dinâmicas', 32, true),
-- Educação e Treinamentos
('Treinamentos Personalizados',       'Educação e Treinamentos', 40, true),
('Vídeos (Pílulas / SCORM)',          'Educação e Treinamentos', 41, true),
('Comunicados Textuais e Visuais',    'Educação e Treinamentos', 42, true),
-- Plataforma e Gerenciamento
('Plataforma de Phishing e E-learning', 'Plataforma e Gerenciamento', 50, true),
('Gerenciamento de Plataformas',        'Plataforma e Gerenciamento', 51, true);

-- 5. Migra produto_id existente → junction (via nome do produto antigo)
--    Para cada oportunidade com produto_id, tenta achar o novo produto pelo nome
INSERT INTO oportunidade_produtos (oportunidade_id, produto_id)
SELECT o.id, o.produto_id
FROM oportunidades o
WHERE o.produto_id IS NOT NULL
  AND o.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM produtos p WHERE p.id = o.produto_id AND p.ativo = true)
ON CONFLICT DO NOTHING;

-- Também tenta migrar por nome do produto (caso o produto_id aponte para inativo)
INSERT INTO oportunidade_produtos (oportunidade_id, produto_id)
SELECT o.id, np.id
FROM oportunidades o
JOIN produtos op ON op.id = o.produto_id  -- produto antigo
JOIN produtos np ON np.nome = op.nome AND np.ativo = true  -- produto novo com mesmo nome
WHERE o.produto_id IS NOT NULL
  AND o.deleted_at IS NULL
ON CONFLICT DO NOTHING;
