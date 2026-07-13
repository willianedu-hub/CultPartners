-- ============================================================
--  CONSOLIDAÇÃO — Parte 2/3: DADOS (origem → cultpartners)
--  Rodar no SQL Editor do projeto DESTINO (xqrudhwtdwzmgwstcyoh)
--  DEPOIS de consolidacao_01_schema.sql. Rerunnable (TRUNCATE no topo).
-- ============================================================

SET search_path = cultpartners, extensions, public;

BEGIN;

TRUNCATE cultpartners.oportunidade_produtos, cultpartners.tarefas,
         cultpartners.audit_log, cultpartners.oportunidades,
         cultpartners.produtos, cultpartners.status_funil,
         cultpartners.parceiros, cultpartners.admins,
         cultpartners.preferencias_usuario RESTART IDENTITY CASCADE;

-- admins: 1 linha(s)
INSERT INTO cultpartners.admins (id, nome, login, senha_hash, email, ativo, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES
  (1, 'Administrador CULTSEC', 'admin', '$2a$12$e9YWq9NRLyXsxhfb/zZn1.VBXWnluaN/j9jyPx.8pS4a/Il6Fjdgi', 'admin@cultsec.com.br', TRUE, '2026-04-04T02:24:05.932137+00:00', '2026-04-04T02:24:05.932137+00:00');

-- parceiros: 11 linha(s)
INSERT INTO cultpartners.parceiros (id, nome, cnpj, site, login, senha_hash, email, ativo, deleted_at, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES
  (1, 'TechBridge Soluções', '11.222.333/0001-01', 'https://techbridge.com.br', 'techbridge', '$2a$12$k.JxrxNwDCh3zl3HI.2dk.ixkCJG85G7Ei.Tn0g3XlrP7K48byIT6', 'contato@techbridge.com.br', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (2, 'Nexus IT Consulting', '22.333.444/0001-02', 'https://nexusit.com.br', 'nexusit', '$2a$12$k.JxrxNwDCh3zl3HI.2dk.ixkCJG85G7Ei.Tn0g3XlrP7K48byIT6', 'parceria@nexusit.com.br', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (3, 'DataSafe Partners', '33.444.555/0001-03', 'https://datasafe.com.br', 'datasafe', '$2a$12$k.JxrxNwDCh3zl3HI.2dk.ixkCJG85G7Ei.Tn0g3XlrP7K48byIT6', 'vendas@datasafe.com.br', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (4, 'CloudGuard Brasil', '44.555.666/0001-04', 'https://cloudguard.com.br', 'cloudguard', '$2a$12$k.JxrxNwDCh3zl3HI.2dk.ixkCJG85G7Ei.Tn0g3XlrP7K48byIT6', 'comercial@cloudguard.com.br', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (5, 'Inova Cyber', '55.666.777/0001-05', 'https://inovacyber.com.br', 'inovacyber', '$2a$12$k.JxrxNwDCh3zl3HI.2dk.ixkCJG85G7Ei.Tn0g3XlrP7K48byIT6', 'inovacyber@inovacyber.com.br', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (6, 'Rede Segura Tecnologia', '66.777.888/0001-06', 'https://redesegura.com.br', 'redesegura', '$2a$12$k.JxrxNwDCh3zl3HI.2dk.ixkCJG85G7Ei.Tn0g3XlrP7K48byIT6', 'contato@redesegura.com.br', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (7, 'Fortify Consultoria', '77.888.999/0001-07', 'https://fortify.com.br', 'fortify', '$2a$12$k.JxrxNwDCh3zl3HI.2dk.ixkCJG85G7Ei.Tn0g3XlrP7K48byIT6', 'vendas@fortify.com.br', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (8, 'PrimeRisk Advisory', '88.999.000/0001-08', 'https://primerisk.com.br', 'primerisk', '$2a$12$k.JxrxNwDCh3zl3HI.2dk.ixkCJG85G7Ei.Tn0g3XlrP7K48byIT6', 'advisory@primerisk.com.br', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (9, 'SecurePath Integrações', '99.000.111/0001-09', 'https://securepath.com.br', 'securepath', '$2a$12$k.JxrxNwDCh3zl3HI.2dk.ixkCJG85G7Ei.Tn0g3XlrP7K48byIT6', 'partners@securepath.com.br', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (10, 'Apex Digital Security', '10.111.222/0001-10', 'https://apexdigital.com.br', 'apexdigital', '$2a$12$k.JxrxNwDCh3zl3HI.2dk.ixkCJG85G7Ei.Tn0g3XlrP7K48byIT6', 'comercial@apexdigital.com.br', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (11, 'Movti Cloud Solutions Ltda.', '10.363.084/0001-81', '[www.movti.com.br](https://www.movti.com.br)', 'movti', '$2a$12$9XWRvud9mpNoZ2kGhOWLveZB4PZXQB3Cp27X6TUAAdQwWqWRmGuaW', 'thalisson.martins@movti.com.br', TRUE, NULL, '2026-04-24T02:45:06.889987+00:00', '2026-04-24T02:45:07.06654+00:00');

-- status_funil: 6 linha(s)
INSERT INTO cultpartners.status_funil (id, nome, cor, ordem, ativo, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES
  (1, 'Prospect', '#64748b', 1, TRUE, '2026-04-04T02:24:05.932137+00:00', '2026-04-04T02:24:05.932137+00:00'),
  (2, 'Qualificado', '#d97706', 2, TRUE, '2026-04-04T02:24:05.932137+00:00', '2026-04-04T02:24:05.932137+00:00'),
  (3, 'Proposta', '#1d4ed8', 3, TRUE, '2026-04-04T02:24:05.932137+00:00', '2026-04-04T02:24:05.932137+00:00'),
  (4, 'Negociação', '#6d28d9', 4, TRUE, '2026-04-04T02:24:05.932137+00:00', '2026-04-04T02:24:05.932137+00:00'),
  (5, 'Ganho', '#059669', 5, TRUE, '2026-04-04T02:24:05.932137+00:00', '2026-04-04T02:24:05.932137+00:00'),
  (6, 'Perdido', '#dc2626', 6, TRUE, '2026-04-04T02:24:05.932137+00:00', '2026-04-04T02:24:05.932137+00:00');

-- produtos: 42 linha(s)
INSERT INTO cultpartners.produtos (id, nome, categoria, descricao, ativo, created_at, updated_at, ordem) OVERRIDING SYSTEM VALUE VALUES
  (1, 'Conscientização Essencial', 'Treinamento', 'Programa base de conscientização em cibersegurança', FALSE, '2026-04-04T02:24:05.932137+00:00', '2026-04-24T03:40:49.528451+00:00', 0),
  (2, 'Conscientização Avançada', 'Treinamento', 'Programa avançado com simulações e relatórios gerenciais', FALSE, '2026-04-04T02:24:05.932137+00:00', '2026-04-24T03:40:49.528451+00:00', 0),
  (3, 'Simulação de Phishing', 'Simulação', 'Campanhas de phishing simulado com análise de vulnerabilidade', FALSE, '2026-04-04T02:24:05.932137+00:00', '2026-04-24T03:40:49.528451+00:00', 0),
  (4, 'Consultoria Estratégica', 'Consultoria', 'Diagnóstico e planejamento de cultura de segurança', FALSE, '2026-04-04T02:24:05.932137+00:00', '2026-04-24T03:40:49.528451+00:00', 0),
  (5, 'Palestra Corporativa', 'Evento', 'Palestra presencial ou online para times de qualquer tamanho', FALSE, '2026-04-04T02:24:05.932137+00:00', '2026-04-24T03:40:49.528451+00:00', 0),
  (6, 'Plataforma EAD', 'Plataforma', 'Acesso à plataforma de treinamentos online autogerenciada', FALSE, '2026-04-04T02:24:05.932137+00:00', '2026-04-24T03:40:49.528451+00:00', 0),
  (7, 'Programa Personalizado', 'Custom', 'Solução desenvolvida sob medida para o cliente', FALSE, '2026-04-04T02:24:05.932137+00:00', '2026-04-24T03:40:49.528451+00:00', 0),
  (8, 'Assessment de Conscientização', 'Programas de Consultoria', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 1),
  (9, 'Programa de Conscientização', 'Programas de Consultoria', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 2),
  (10, 'Programa Pocket', 'Programas de Consultoria', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 3),
  (11, 'Plano de Comunicação — Basic', 'Programas de Consultoria', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 4),
  (12, 'Plano de Comunicação — Standard', 'Programas de Consultoria', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 5),
  (13, 'Plano de Comunicação — Advanced', 'Programas de Consultoria', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 6),
  (14, 'Plano de Comunicação — Customizado', 'Programas de Consultoria', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 7),
  (15, 'Palestras', 'Ações de Conscientização', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 10),
  (16, 'Show de Sósia', 'Ações de Conscientização', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 11),
  (17, 'Sala Interativa', 'Ações de Conscientização', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 12),
  (18, 'Estações de Configuração', 'Ações de Conscientização', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 13),
  (19, 'Phishing Físico', 'Ações de Conscientização', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 14),
  (20, 'The Insider Man', 'Ações de Conscientização', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 15),
  (21, 'Robôs Interativos', 'Ações de Conscientização', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 16),
  (22, 'Espelho Interativo', 'Ações de Conscientização', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 17),
  (23, 'Palestra Holográfica', 'Ações de Conscientização', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 18),
  (24, 'Totens e Telas', 'Ações de Conscientização', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 19),
  (25, 'Escape Room Físico', 'Jogos e Dinâmicas', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 20),
  (26, 'Escape Room Virtual', 'Jogos e Dinâmicas', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 21),
  (27, 'CTF (Capture The Flag)', 'Jogos e Dinâmicas', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 22),
  (28, 'Table Top Exercise', 'Jogos e Dinâmicas', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 23),
  (29, 'UNO da Conscientização', 'Jogos e Dinâmicas', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 24),
  (30, 'Tabuleiro da Conscientização', 'Jogos e Dinâmicas', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 25),
  (31, 'Batalha Naval', 'Jogos e Dinâmicas', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 26),
  (32, 'Detetive', 'Jogos e Dinâmicas', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 27),
  (33, 'Roda da Fortuna', 'Jogos e Dinâmicas', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 28),
  (34, 'Passa ou Repassa', 'Jogos e Dinâmicas', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 29),
  (35, 'Imagem e Ação', 'Jogos e Dinâmicas', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 30),
  (36, 'O Garra do Phishing', 'Jogos e Dinâmicas', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 31),
  (37, 'Doce ou Travessura', 'Jogos e Dinâmicas', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 32),
  (38, 'Treinamentos Personalizados', 'Educação e Treinamentos', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 40),
  (39, 'Vídeos (Pílulas / SCORM)', 'Educação e Treinamentos', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 41),
  (40, 'Comunicados Textuais e Visuais', 'Educação e Treinamentos', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 42),
  (41, 'Plataforma de Phishing e E-learning', 'Plataforma e Gerenciamento', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 50),
  (42, 'Gerenciamento de Plataformas', 'Plataforma e Gerenciamento', NULL, TRUE, '2026-04-24T03:40:49.528451+00:00', '2026-04-24T03:40:49.528451+00:00', 51);

-- oportunidades: 58 linha(s)
INSERT INTO cultpartners.oportunidades (id, empresa, cnpj, site_empresa, contato, cargo, obs, produto_id, status_id, fechamento, parceiro_id, aprovacao, approved_at, approved_by, motivo_rejeicao, rejected_at, rejected_by, deleted_at, created_at, updated_at, valor_estimado) OVERRIDING SYSTEM VALUE VALUES
  (1, 'Grupo Empresarial Alvorada', '01.234.567/0001-11', 'https://alvorada.com.br', 'Fernanda Queiroz', 'Diretora de TI', 'Indicação de evento de cibersegurança SP.', 1, 1, '2025-09-01', 1, 'Pendente', NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-01T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (2, 'Supermercados BomPreço', '02.345.678/0001-12', 'https://bompreco.com.br', 'Ricardo Santana', 'Gerente de Infraestrutura', 'Rede com +500 colaboradores expostos a phishing.', 3, 1, '2025-10-01', 2, 'Pendente', NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-02T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (3, 'Clínica Saúde Plena', '03.456.789/0001-13', 'https://saudeplena.med.br', 'Dra. Camila Rocha', 'Coordenadora Médica', 'LGPD como gatilho principal.', 5, 1, '2025-09-01', 3, 'Pendente', NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-03T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (4, 'Transportadora Velox', '04.567.890/0001-14', 'https://velox.com.br', 'Marcos Teixeira', 'CTO', 'Empresa em expansão, primeira abordagem de segurança.', 1, 1, '2025-11-01', 4, 'Pendente', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-30T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (5, 'Escola Saber Digital', '05.678.901/0001-15', 'https://saberdigital.edu.br', 'Prof. Ana Beatriz', 'Diretora Pedagógica', 'Interesse em plataforma para todo corpo docente.', 6, 1, '2026-01-01', 5, 'Pendente', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-31T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (6, 'Farmácias Bem Viver', '06.789.012/0001-16', 'https://bemviver.farm.br', 'Luís Magalhães', 'Gerente Regional', 'Rede de 120 farmácias no Sudeste.', 1, 1, '2025-10-01', 6, 'Pendente', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-29T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (7, 'Construmax Engenharia', '07.890.123/0001-17', 'https://construmax.eng.br', 'Sílvia Moreira', 'Diretora Administrativa', 'Ataque recente de ransomware motivou a busca.', 4, 1, '2026-02-01', 7, 'Pendente', NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-02T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (8, 'Fintech Crédito Ágil', '08.901.234/0001-18', 'https://creditoagil.com.br', 'Bruno Alves', 'Head de Compliance', 'Regulatório BACEN como driver principal.', 7, 1, '2025-12-01', 8, 'Pendente', NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-03T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (9, 'Distribuidora Norte Sul', '09.012.345/0001-19', 'https://nortesul.com.br', 'Patrícia Lemos', 'Supervisora de TI', 'Recebeu proposta de concorrente, em análise comparativa.', 2, 1, '2025-09-01', 9, 'Pendente', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-28T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (10, 'Banco Regional Meridiano', '10.123.456/0001-20', 'https://meridiano.bank', 'Carlos Drummond', 'CISO', 'Reunião de discovery realizada. Budget confirmado R$180k.', 7, 2, '2025-10-01', 1, 'Aprovado', '2026-03-15T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-03-05T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (11, 'Hospital São Lucas', '11.234.567/0001-21', 'https://saolucas.hosp.br', 'Dra. Renata Vieira', 'Diretora de TI', 'LGPD e HIPAA como requisitos. Decisão por comitê.', 2, 2, '2025-11-01', 2, 'Aprovado', '2026-03-20T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-03-10T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (12, 'Seguradora Confiança', '12.345.678/0001-22', 'https://confianca.seg.br', 'Paulo Mendes', 'VP de Tecnologia', 'Incidente de engenharia social levou à qualificação.', 4, 2, '2025-12-01', 3, 'Aprovado', '2026-03-25T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-03-17T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (13, 'Grupo Educacional Lumiar', '13.456.789/0001-23', 'https://lumiar.edu.br', 'Márcia Pinheiro', 'Reitora', '12.000 alunos + 800 professores. Grande oportunidade.', 6, 2, '2026-01-01', 4, 'Aprovado', '2026-03-27T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-03-15T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (14, 'E-commerce Moda Trend', '14.567.890/0001-24', 'https://modatrend.com.br', 'Juliana Costa', 'CTO', 'Black Friday como deadline natural para fechar.', 3, 2, '2025-10-01', 5, 'Aprovado', '2026-03-23T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-03-13T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (15, 'Prefeitura de Campinópolis', '15.678.901/0001-25', NULL, 'Sec. Adriano Lima', 'Secretário de Gestão', 'Licitação em andamento, nota técnica favorável.', 1, 2, '2025-11-01', 6, 'Aprovado', '2026-03-30T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-03-20T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (16, 'Agro Cerrado Exportações', '16.789.012/0001-26', 'https://agrocerrado.agr.br', 'Fernando Barros', 'Diretor Executivo', 'Parceiro de cadeia de fornecimento exigiu certificação.', 5, 2, '2025-09-01', 7, 'Aprovado', '2026-03-28T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-03-21T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (18, 'Logística Expressa BR', '18.901.234/0001-28', 'https://logisticabr.com.br', 'André Cavalcanti', 'Gerente de Operações', 'Vazamento de dados de clientes motivou urgência.', 2, 2, '2025-12-01', 9, 'Pendente', NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-01T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (19, 'Petroquímica Atlântica', '19.012.345/0001-29', 'https://petroquimicaatl.com.br', 'Roberto Figueiredo', 'CISO', 'Proposta R$320k enviada. Aguardando aprovação do board.', 7, 3, '2025-09-01', 1, 'Aprovado', '2026-02-23T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-02-08T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (20, 'Banco Digital Valore', '20.123.456/0001-30', 'https://valore.bank', 'Carolina Andrade', 'Head de Segurança', 'Proposta customizada após 3 reuniões técnicas.', 2, 3, '2025-09-01', 2, 'Aprovado', '2026-02-28T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-02-13T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (21, 'Rede de Hotéis Majestic', '21.234.567/0001-31', 'https://majestichoteis.com.br', 'Gustavo Ribeiro', 'Diretor de TI', 'Sazonalidade do turismo como fator de urgência.', 3, 3, '2025-10-01', 3, 'Aprovado', '2026-03-07T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-02-21T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (22, 'Mineradora Serra Bela', '22.345.678/0001-32', 'https://serrabela.min.br', 'Hélio Nascimento', 'VP de Infraestrutura', 'Operação 24/7 com dados sensíveis de produção.', 4, 3, '2025-11-01', 4, 'Aprovado', '2026-03-13T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-02-25T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (23, 'Cooperativa AgriSul', '23.456.789/0001-33', 'https://agrisul.coop.br', 'Maria das Dores', 'Gestora de TI', '4.200 cooperados. Proposta por módulos.', 1, 3, '2025-10-01', 5, 'Aprovado', '2026-03-17T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-03-03T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (24, 'Plano de Saúde BemEstar', '24.567.890/0001-34', 'https://bemestarsaude.com.br', 'Dr. Thiago Matos', 'CTO', 'ANS exigindo controles. Proposta inclui certificação.', 6, 3, '2025-12-01', 6, 'Aprovado', '2026-03-21T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-03-07T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (29, 'Grupo Financeiro Solano', '29.012.345/0001-39', 'https://solano.fin.br', 'Alexandre Teles', 'CFO', 'Negociando escopo e SLA. Contrato em última rodada.', 7, 4, '2025-08-01', 1, 'Aprovado', '2026-02-03T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-01-19T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (30, 'Telecom Conecta Brasil', '30.123.456/0001-40', 'https://conectabrasil.tel.br', 'Simone Barros', 'VP de TI', 'Ajuste no número de licenças. Quase fechado.', 2, 4, '2025-08-01', 2, 'Aprovado', '2026-02-08T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-01-24T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (31, 'Siderúrgica Fortaleza', '31.234.567/0001-41', 'https://siderurgicafort.ind.br', 'Nelson Costa', 'CIO', 'Disputa interna entre áreas. Jurídico revisando.', 4, 4, '2025-09-01', 3, 'Aprovado', '2026-02-15T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-01-29T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (27, 'Consórcio RodoVia', '27.890.123/0001-37', NULL, 'Vítor Mendonça', 'Superintendente de TI', 'Proposta aguardando revisão interna. Decisão em 30 dias.', 7, 3, '2025-10-01', 9, 'Aprovado', '2026-04-05T01:14:30.328+00:00', 1, NULL, NULL, NULL, NULL, '2026-03-27T02:39:35.579857+00:00', '2026-04-05T01:14:30.55628+00:00', NULL),
  (28, 'Startup HealthTech Pulse', '28.901.234/0001-38', 'https://pulse.health', 'Débora Lima', 'CEO', 'Série A recém-concluída. Budget disponível.', 3, 4, '2025-09-01', 10, 'Pendente', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-30T02:39:35.579857+00:00', '2026-04-06T15:03:21.901977+00:00', NULL),
  (25, 'Atacadão Distribuição', '25.678.901/0001-35', 'https://atacadaodist.com.br', 'Karina Sousa', 'Diretora Financeira', 'Decisão entre 3 fornecedores. Diferencial: metodologia.', 2, 4, '2025-09-01', 7, 'Aprovado', '2026-03-25T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-03-11T02:39:35.579857+00:00', '2026-04-06T16:10:35.884201+00:00', NULL),
  (26, 'Indústria Têxtil Fiora', '26.789.012/0001-36', 'https://fioratextil.ind.br', 'Leandro Campos', 'Gerente de TI', 'ISO 27001 como requisito do cliente europeu.', 5, 5, '2026-01-01', 8, 'Aprovado', '2026-03-29T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-03-15T02:39:35.579857+00:00', '2026-04-06T16:10:43.601017+00:00', NULL),
  (32, 'Rede de Ensino Cérebro', '32.345.678/0001-42', 'https://cerebro.edu.br', 'Priscila Araújo', 'Diretora Comercial', '22 unidades. Negociando desconto por volume.', 6, 4, '2025-10-01', 4, 'Aprovado', '2026-02-21T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-02-05T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (33, 'Grupo Varejo FastBuy', '33.456.789/0001-43', 'https://fastbuy.com.br', 'Rodrigo Fonseca', 'CISO', 'Pré-contrato assinado. Faltam detalhes de integração.', 3, 4, '2025-08-01', 5, 'Aprovado', '2026-02-25T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-02-08T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (34, 'Laboratório BioExame', '34.567.890/0001-44', 'https://bioexame.lab.br', 'Tatiana Melo', 'Gerente de Compliance', 'LGPD Health Data. Negociando cláusulas de confidencialidade.', 1, 4, '2025-09-01', 6, 'Aprovado', '2026-03-05T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-02-18T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (35, 'Incorporadora Ópera', '35.678.901/0001-45', 'https://incorporadoraopera.com.br', 'Henrique Vaz', 'Diretor Financeiro', 'Aprovação do COO pendente. Alta probabilidade de fechamento.', 5, 4, '2025-09-01', 7, 'Aprovado', '2026-03-10T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-02-23T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (36, 'Seguradora Proteção Total', '36.789.012/0001-46', 'https://protecaototal.seg.br', 'Flávia Duarte', 'Diretora de Operações', 'Regulatório SUSEP como driver. Contrato minuta enviada.', 7, 4, '2025-10-01', 8, 'Aprovado', '2026-03-15T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-02-28T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (37, 'Indústria Química Nobre', '37.890.123/0001-47', 'https://quimicanobre.ind.br', 'Claudio Esteves', 'CTO', '✅ Contrato assinado R$280k. Onboarding iniciado.', 7, 5, '2025-07-01', 1, 'Aprovado', '2026-01-04T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2025-12-15T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (40, 'Empresa de Energia RenovaBR', '40.123.456/0001-50', 'https://renovabr.energy', 'Giovana Luz', 'Head de TI', '✅ Setor crítico. Programa anual com revisão semestral.', 4, 5, '2025-07-01', 4, 'Aprovado', '2026-01-09T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2025-12-20T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (44, 'Fintech Pagamentos Ágeis', '44.567.890/0001-54', 'https://pagamentosageis.fin.br', 'Thales Correia', 'CEO', '✅ Programa customizado aprovado pelo board. Caso de sucesso.', 7, 5, '2025-08-01', 8, 'Aprovado', '2026-01-24T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2026-01-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (45, 'Varejão Popular Norte', '45.678.901/0001-55', 'https://varejaonotenorte.com.br', 'César Nunes', 'Dono / CEO', 'Optou por solução interna. Orçamento cortado.', 1, 6, '2025-04-01', 9, 'Aprovado', '2025-12-05T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2025-11-15T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (46, 'Escola Pública Estadual SP', '46.789.012/0001-56', NULL, 'Coord. Míriam', 'Coordenadora Pedagógica', 'Verba pública não aprovada em tempo.', 5, 6, '2025-04-01', 10, 'Aprovado', '2025-12-10T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2025-11-20T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (47, 'Startup GameTech Nova', '47.890.123/0001-57', 'https://gametech.io', 'Diego Menezes', 'CTO', 'Perdeu para concorrente com preço 30% menor.', 3, 6, '2025-05-01', 1, 'Aprovado', '2025-12-20T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2025-11-30T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (49, 'Imobiliária Sonho Próprio', '49.012.345/0001-59', 'https://sonhoproprio.imob.br', 'Antônia Paz', 'Diretora de TI', 'Decisor trocou e novo gestor recomençou processo do zero.', 4, 6, '2025-05-01', 3, 'Aprovado', '2025-12-27T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2025-12-10T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (50, 'Cooperativa de Crédito Sul', '50.123.456/0001-60', 'https://credsul.coop.br', 'Alfredo Dias', 'Superintendente', 'Conselho vetou por questões políticas internas.', 7, 6, '2025-06-01', 4, 'Aprovado', '2026-01-04T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2025-12-15T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00', NULL),
  (17, 'Clínica Odonto Premium', '17.890.123/0001-27', 'https://odontopremium.com.br', 'Dra. Luana Gomes', 'Sócia-Diretora', 'Rede de 45 clínicas. Em processo de qualificação.', 1, 2, '2026-02-01', 8, 'Aprovado', '2026-04-04T02:51:38.021+00:00', 1, NULL, NULL, NULL, NULL, '2026-03-29T02:39:35.579857+00:00', '2026-04-04T02:51:36.808574+00:00', NULL),
  (38, 'Banco Cooperativo UniCred', '38.901.234/0001-48', 'https://unicred.fin.br', 'Sandra Moraes', 'Gerente de Segurança', '✅ Programa de 12 meses. 2.400 colaboradores ativos.', 2, 5, '2025-06-01', 2, 'Aprovado', '2025-12-30T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2025-12-05T02:39:35.579857+00:00', '2026-04-04T03:09:06.020179+00:00', NULL),
  (43, 'Construtora Ibirapuera', '43.456.789/0001-53', 'https://ibirapuera.eng.br', 'Roberto Chaves', 'Diretor de Suprimentos', '✅ Palestra + treinamento. Cliente satisfeito, renova em dez.', 5, 5, '2025-07-01', 7, 'Aprovado', '2026-01-12T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2025-12-25T02:39:35.579857+00:00', '2026-04-04T03:09:50.509931+00:00', NULL),
  (48, 'Distribuidora Alimentos Max', '48.901.234/0001-58', 'https://alimentosmax.com.br', 'Neuza Corrêa', 'Gerente Financeira', 'Prioridade interna mudou para ERP. Retomar em 2026.', 1, 6, '2025-03-01', 2, 'Aprovado', '2025-11-25T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2025-11-05T02:39:35.579857+00:00', '2026-04-04T03:10:13.628853+00:00', NULL),
  (39, 'Grupo de Mídia Record+', '39.012.345/0001-49', 'https://recordmais.com.br', 'Marcelo Prado', 'VP de Tecnologia', '✅ Após incidente de phishing em 2024. ROI comprovado.', 3, 5, '2025-06-01', 3, 'Aprovado', '2025-12-25T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2025-11-30T02:39:35.579857+00:00', '2026-04-04T03:10:39.74097+00:00', NULL),
  (41, 'Hospital Albert Silva', '41.234.567/0001-51', 'https://albertsilva.hosp.br', 'Dr. Fábio Cunha', 'Superintendente TI', '✅ Plataforma EAD para 3.800 profissionais de saúde.', 6, 5, '2025-05-01', 5, 'Aprovado', '2025-12-15T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2025-11-20T02:39:35.579857+00:00', '2026-04-04T03:11:00.824805+00:00', NULL),
  (42, 'Rede de Postos Combustível+', '42.345.678/0001-52', 'https://combustivelmais.com.br', 'Leila Ramos', 'Gerente de TI', '✅ 180 postos em 5 estados. Expansão do contrato prevista.', 1, 5, '2025-06-01', 6, 'Aprovado', '2026-01-06T02:39:35.579857+00:00', 1, NULL, NULL, NULL, NULL, '2025-12-17T02:39:35.579857+00:00', '2026-04-04T03:11:22.8207+00:00', NULL),
  (52, 'Banco Meridional S.A.', '12.345.678/0001-90', 'bancomeridional.com.br', 'Ricardo Ferreira', 'Diretor de Segurança da Informação', 'Cliente com histórico de incidentes de phishing. Alto potencial de expansão para treinamentos recorrentes.', 8, 5, '2025-07-01', 11, 'Aprovado', '2026-04-09T04:12:47.908829+00:00', 1, NULL, NULL, NULL, NULL, '2026-04-24T04:12:47.908829+00:00', '2026-04-24T13:30:42.907043+00:00', 85000),
  (53, 'TechSul Sistemas Ltda', '98.765.432/0001-11', 'techsul.com.br', 'Camila Ramos', 'Gerente de TI', 'Equipe técnica muito engajada. Preferência por dinâmicas gamificadas.', 27, 4, '2025-08-01', 11, 'Aprovado', '2026-04-19T04:12:47.908829+00:00', 1, NULL, NULL, NULL, NULL, '2026-04-24T04:12:47.908829+00:00', '2026-05-04T12:52:35.84274+00:00', 42500),
  (51, 'Empresa Teste', '12.345.678/0001-71', '[www.google.com.br](https://www.google.com.br)', 'Contato Teste', 'Diretor de Segurança da Informação', 'Cliente de teste da plataforma para a MOVTI.', 8, 1, '2026-11-01', 11, 'Pendente', NULL, NULL, NULL, NULL, NULL, '2026-04-24T04:06:27.05966+00:00', '2026-04-24T03:44:05.562759+00:00', '2026-04-24T04:06:27.05966+00:00', 52000),
  (54, 'Clínica São Luiz', '45.678.901/0001-23', 'clinicasaoluiz.com.br', 'Dra. Marina Costa', 'Diretora Administrativa', 'Setor de saúde com dados LGPD sensíveis. Necessidade urgente de conscientização da equipe administrativa.', 9, 2, '2025-09-01', 11, 'Pendente', NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-24T04:12:47.908829+00:00', '2026-04-24T04:12:47.908829+00:00', 28000),
  (55, 'Construservice Engenharia', '32.109.876/0001-44', 'construservice.com.br', 'Paulo Mendes', 'Gerente de RH', 'Maior contrato em andamento. Cliente quer experiência imersiva para 400 colaboradores distribuídos em 3 filiais.', 17, 3, '2025-10-01', 11, 'Aprovado', '2026-04-21T04:12:47.908829+00:00', 1, NULL, NULL, NULL, NULL, '2026-04-24T04:12:47.908829+00:00', '2026-04-24T04:12:47.908829+00:00', 120000),
  (56, 'Grupo Alfa Varejo', '67.890.123/0001-56', 'grupoalfa.com.br', 'Fernanda Lima', 'Coordenadora de Compliance', 'Negócio fechado. Contrato assinado para conscientização de 200 funcionários do varejo.', 10, 5, '2025-06-01', 11, 'Aprovado', '2026-03-25T04:12:47.908829+00:00', 1, NULL, NULL, NULL, NULL, '2026-04-24T04:12:47.908829+00:00', '2026-04-24T04:12:47.908829+00:00', 35800),
  (58, 'CultTeste', '12.345.678/0001-78', '[www.microsoft.com.br](https://www.microsoft.com.br)', 'Teste 3', 'CTO', NULL, 11, 2, '2026-07-01', 11, 'Aprovado', '2026-05-04T12:53:33.146+00:00', 1, NULL, NULL, NULL, NULL, '2026-05-04T12:51:40.600077+00:00', '2026-05-04T12:53:32.813557+00:00', 80000),
  (57, 'Empresa UOL Teste', '46.789.012/0001-54', '[www.uol.com.br](https://www.uol.com.br)', 'Rui Costa', 'CTO', 'Oportunidade de teste.', 15, 1, '2026-07-01', 11, 'Rejeitado', NULL, NULL, 'Desculpe, parceiro x já está trabalhando.', '2026-05-04T12:53:53.807+00:00', 1, NULL, '2026-04-24T04:25:37.052478+00:00', '2026-05-04T12:53:53.543013+00:00', 40000);

-- tarefas: 25 linha(s)
INSERT INTO cultpartners.tarefas (id, oportunidade_id, descricao, prazo, responsavel, concluida, concluida_em, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES
  (1, 10, 'Enviar questionário de maturidade em segurança', '2025-08-10', 'Carlos Drummond', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (2, 10, 'Agendar workshop de diagnóstico com time técnico', '2025-08-25', 'Equipe CULTSEC', FALSE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (3, 11, 'Apresentar cases de hospitais similares', '2025-08-15', 'Nexus IT', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (4, 11, 'Enviar proposta com cláusulas LGPD Health', '2025-08-30', 'CULTSEC Jurídico', FALSE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (5, 19, 'Follow-up com Roberto Figueiredo após reunião de board', '2025-08-05', 'TechBridge', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (6, 19, 'Revisar proposta com desconto de 5% aprovado pela CULTSEC', '2025-08-12', 'Comercial CULTSEC', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (7, 19, 'Aguardar assinatura do contrato', '2025-08-20', 'TechBridge', FALSE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (8, 29, 'Enviar minuta do contrato revisada', '2025-08-08', 'Jurídico CULTSEC', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (9, 29, 'Call de alinhamento final com CFO', '2025-08-15', 'Alexandre Teles', FALSE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (10, 30, 'Confirmar número final de licenças com área de RH', '2025-08-10', 'Simone Barros', FALSE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (11, 20, 'Alinhar cronograma de implementação com equipe técnica', '2025-08-18', 'Carolina Andrade', FALSE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (12, 20, 'Solicitar aprovação da Diretoria de Compliance', '2025-08-22', 'Nexus IT', FALSE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (13, 21, 'Enviar calendário de treinamentos para temporada', '2025-08-28', 'DataSafe Partners', FALSE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (14, 33, 'Definir ambiente de integração (AD / LDAP)', '2025-08-12', 'Equipe Técnica CULTSEC', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (15, 33, 'Confirmar data de kick-off', '2025-08-19', 'Rodrigo Fonseca', FALSE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (16, 31, 'Aguardar liberação do jurídico para assinar', '2025-08-30', 'Nelson Costa', FALSE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (17, 12, 'Apresentar metodologia de simulação de phishing', '2025-08-14', 'DataSafe Partners', TRUE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (18, 12, 'Encaminhar proposta atualizada após feedback', '2025-08-21', 'CULTSEC Comercial', FALSE, NULL, '2026-04-04T02:39:35.579857+00:00', '2026-04-04T02:39:35.579857+00:00'),
  (19, 38, 'Acompanhamento', '2026-04-30', 'Todos', FALSE, NULL, '2026-04-04T03:09:06.35674+00:00', '2026-04-04T03:09:06.35674+00:00'),
  (20, 43, 'Acompanhamento', '2026-04-30', 'Todos', FALSE, NULL, '2026-04-04T03:09:50.793688+00:00', '2026-04-04T03:09:50.793688+00:00'),
  (21, 48, 'Acompanhamento', '2026-05-08', 'Todos', FALSE, NULL, '2026-04-04T03:10:13.830429+00:00', '2026-04-04T03:10:13.830429+00:00'),
  (22, 39, 'Acompanhamento', '2026-05-08', 'Todos', FALSE, NULL, '2026-04-04T03:10:39.97646+00:00', '2026-04-04T03:10:39.97646+00:00'),
  (23, 41, 'Acompanhamento', '2026-05-08', 'Todos', FALSE, NULL, '2026-04-04T03:11:01.072072+00:00', '2026-04-04T03:11:01.072072+00:00'),
  (24, 42, 'Acompanhamento', '2026-05-09', 'Todos', FALSE, NULL, '2026-04-04T03:11:23.105824+00:00', '2026-04-04T03:11:23.105824+00:00'),
  (25, 58, 'Precisa entrar em contato.', '2026-05-28', 'Thalisson', FALSE, NULL, '2026-05-04T12:52:18.930698+00:00', '2026-05-04T12:52:18.930698+00:00');

-- oportunidade_produtos: 34 linha(s)
INSERT INTO cultpartners.oportunidade_produtos (oportunidade_id, produto_id) VALUES
  (51, 8),
  (51, 14),
  (51, 16),
  (51, 19),
  (51, 21),
  (51, 39),
  (51, 40),
  (51, 41),
  (52, 8),
  (52, 15),
  (52, 19),
  (52, 38),
  (52, 41),
  (53, 26),
  (53, 27),
  (53, 28),
  (53, 39),
  (54, 9),
  (54, 16),
  (54, 40),
  (55, 15),
  (55, 17),
  (55, 21),
  (55, 22),
  (55, 33),
  (56, 10),
  (56, 11),
  (56, 42),
  (57, 15),
  (57, 19),
  (57, 20),
  (58, 11),
  (58, 18),
  (58, 20);

-- preferencias_usuario: 1 linha(s)
INSERT INTO cultpartners.preferencias_usuario (user_key, colunas, updated_at) VALUES
  ('admin', '["empresa", "cnpj", "contato", "cargo", "produto", "status", "parceiro", "aprovacao", "acoes", "tarefas", "fechamento"]'::jsonb, '2026-04-05T01:12:30.204983+00:00');

-- audit_log: 1 linha(s)
INSERT INTO cultpartners.audit_log (id, tabela, registro_id, acao, usuario, dados_antes, dados_depois, created_at) OVERRIDING SYSTEM VALUE VALUES
  (1, 'oportunidades', 51, 'DELETE', 'Movti Cloud Solutions Ltda.', '{"id": 51, "obs": "Cliente de teste da plataforma para a MOVTI.", "cnpj": "12.345.678/0001-71", "cargo": "Diretor de Segurança da Informação", "contato": "Contato Teste", "empresa": "Empresa Teste", "aprovacao": "Pendente", "status_id": 1, "created_at": "2026-04-24T03:44:05.562759+00:00", "deleted_at": null, "fechamento": "2026-11-01", "produto_id": 8, "updated_at": "2026-04-24T04:05:53.863054+00:00", "approved_at": null, "approved_by": null, "parceiro_id": 11, "rejected_at": null, "rejected_by": null, "site_empresa": "[www.google.com.br](https://www.google.com.br)", "valor_estimado": 52000, "motivo_rejeicao": null}'::jsonb, NULL, '2026-04-24T04:06:27.05966+00:00');

-- Reset das sequences (IDs foram inseridos explicitamente)
SELECT setval(pg_get_serial_sequence('cultpartners.admins','id'), (SELECT COALESCE(MAX(id),1) FROM cultpartners.admins), true);
SELECT setval(pg_get_serial_sequence('cultpartners.parceiros','id'), (SELECT COALESCE(MAX(id),1) FROM cultpartners.parceiros), true);
SELECT setval(pg_get_serial_sequence('cultpartners.status_funil','id'), (SELECT COALESCE(MAX(id),1) FROM cultpartners.status_funil), true);
SELECT setval(pg_get_serial_sequence('cultpartners.produtos','id'), (SELECT COALESCE(MAX(id),1) FROM cultpartners.produtos), true);
SELECT setval(pg_get_serial_sequence('cultpartners.oportunidades','id'), (SELECT COALESCE(MAX(id),1) FROM cultpartners.oportunidades), true);
SELECT setval(pg_get_serial_sequence('cultpartners.tarefas','id'), (SELECT COALESCE(MAX(id),1) FROM cultpartners.tarefas), true);
SELECT setval(pg_get_serial_sequence('cultpartners.audit_log','id'), (SELECT COALESCE(MAX(id),1) FROM cultpartners.audit_log), true);

COMMIT;
