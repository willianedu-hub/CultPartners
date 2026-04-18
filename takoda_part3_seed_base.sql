-- ============================================================
--  takoda_part3_seed_base.sql — Admin, Status, Produtos, Parceiros
--  Execute APÓS takoda_part2_rls_functions.sql
-- ============================================================

-- ── ADMIN ────────────────────────────────────────────────────
-- Login: admin / Senha: Takoda@2025!
INSERT INTO admins (nome, login, senha_hash, email) VALUES
  ('Admin Takoda', 'admin', crypt('Takoda@2025!', gen_salt('bf', 12)), 'admin@takodadatacenters.com');

-- ── STATUS FUNIL ─────────────────────────────────────────────
INSERT INTO status_funil (nome, cor, ordem) VALUES
  ('Prospecção',   '#6b7280', 1),
  ('Qualificação', '#0ea5e9', 2),
  ('Proposta',     '#8b5cf6', 3),
  ('Negociação',   '#f59e0b', 4),
  ('Fechamento',   '#E85D1A', 5),
  ('Ganho',        '#10b981', 6),
  ('Perdido',      '#ef4444', 7);

-- ── PRODUTOS ─────────────────────────────────────────────────
-- IDs gerados sequencialmente: 1 a 12
INSERT INTO produtos (nome, categoria, descricao) VALUES
  ('Colocation Padrão',    'Colocation',    'Hospedagem de servidores em ambiente seguro e climatizado com SLA 99,9%'),
  ('Colocation Premium',   'Colocation',    'Hospedagem em suite dedicada com energia 2N e SLA 99,999%'),
  ('Rack Energizado',      'Colocation',    'Rack completo com energia redundante 2N, 10 kVA e climatização dedicada'),
  ('Cage Exclusivo',       'Colocation',    'Cage privativo com acesso biométrico exclusivo e circuito CFTV'),
  ('Cloud Connect',        'Conectividade', 'Conexão direta e dedicada com AWS, Azure e GCP sem passar pela internet'),
  ('Cross-Connect',        'Conectividade', 'Interconexão física com carriers e ISPs no campus Takoda'),
  ('Network as a Service', 'Conectividade', 'Rede gerenciada com SD-WAN, QoS configurável e NOC 24x7'),
  ('DRaaS',                'Cloud & DR',    'Disaster Recovery as a Service com RTO < 4h e RPO < 1h garantidos'),
  ('Backup as a Service',  'Cloud & DR',    'Backup gerenciado em nuvem com retenção de 30/60/90 dias configurável'),
  ('Remote Hands',         'Serviços',      'Suporte técnico presencial 24x7 no data center — até 30 min de resposta'),
  ('Meet-Me-Room',         'Conectividade', 'Ponto de troca de tráfego neutro e IX no campus Takoda'),
  ('Smart Hands',          'Serviços',      'Instalação, cabeamento estruturado e manutenção de equipamentos no DC');

-- ── PARCEIROS ────────────────────────────────────────────────
-- Senha padrão de todos: Parceiro@2025!
INSERT INTO parceiros (nome, cnpj, site, login, senha_hash, email) VALUES
  ('NTT Data Brasil',          '40.343.622/0001-00', 'nttdata.com',          'nttdata',    crypt('Parceiro@2025!', gen_salt('bf', 12)), 'canal@nttdata.com'),
  ('Stefanini Group',          '58.611.340/0001-30', 'stefanini.com',        'stefanini',  crypt('Parceiro@2025!', gen_salt('bf', 12)), 'canal@stefanini.com'),
  ('Kyndryl Brasil',           '36.483.024/0001-56', 'kyndryl.com',          'kyndryl',    crypt('Parceiro@2025!', gen_salt('bf', 12)), 'canal@kyndryl.com'),
  ('Logicalis Brasil',         '00.257.439/0001-68', 'la.logicalis.com',     'logicalis',  crypt('Parceiro@2025!', gen_salt('bf', 12)), 'canal@logicalis.com'),
  ('Sonda IT',                 '76.535.764/0001-43', 'sonda.com',            'sonda',      crypt('Parceiro@2025!', gen_salt('bf', 12)), 'canal@sonda.com'),
  ('Teltex Tecnologia',        '03.450.152/0001-97', 'teltex.com.br',        'teltex',     crypt('Parceiro@2025!', gen_salt('bf', 12)), 'canal@teltex.com.br'),
  ('Redbelt Security',         '22.781.576/0001-64', 'redbelt.com.br',       'redbelt',    crypt('Parceiro@2025!', gen_salt('bf', 12)), 'canal@redbelt.com.br'),
  ('Totvs S.A.',               '53.113.791/0001-22', 'totvs.com',            'totvs',      crypt('Parceiro@2025!', gen_salt('bf', 12)), 'canal@totvs.com'),
  ('Wittel Telecomunicações',  '67.235.715/0001-80', 'wittel.com',           'wittel',     crypt('Parceiro@2025!', gen_salt('bf', 12)), 'canal@wittel.com'),
  ('Claro Empresas',           '40.432.544/0001-47', 'claro.com.br',         'claro',      crypt('Parceiro@2025!', gen_salt('bf', 12)), 'canal@claro.com.br');

-- ── FIM DA PARTE 3 ───────────────────────────────────────────
-- Execute takoda_part4_seed_opps_a.sql a seguir
