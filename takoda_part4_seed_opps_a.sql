-- ============================================================
--  takoda_part4_seed_opps_a.sql — Oportunidades 1-75
--  Execute APÓS takoda_part3_seed_base.sql
--  IDs de referência:
--    Parceiros:  1=NTT Data  2=Stefanini  3=Kyndryl  4=Logicalis  5=Sonda
--                6=Teltex    7=Redbelt    8=Totvs     9=Wittel    10=Claro
--    Produtos:   1=Colo Padrão  2=Colo Premium  3=Rack  4=Cage  5=Cloud Connect
--                6=Cross-Connect  7=NaaS  8=DRaaS  9=BaaS  10=Remote Hands
--                11=MMR  12=Smart Hands
--    Status:     1=Prospecção  2=Qualificação  3=Proposta  4=Negociação
--                5=Fechamento  6=Ganho  7=Perdido
--    Admin:      1=Admin Takoda
-- ============================================================

INSERT INTO oportunidades
  (empresa, cnpj, site_empresa, contato, cargo, obs, produto_id, status_id, fechamento, parceiro_id, aprovacao, approved_by, approved_at)
VALUES

-- NTT Data (parceiro 1) ----------------------------------------
('Itaú Unibanco S.A.',         '60.701.190/0001-04', 'itau.com.br',          'Ricardo Almeida',    'CTO',                    'Migração de workloads críticos do core bancário',             2, 6, '2025-01-01', 1, 'Aprovado', 1, now() - interval '180 days'),
('Bradesco S.A.',              '60.746.948/0001-12', 'bradesco.com.br',      'Fernanda Costa',     'Gerente de TI',          'Expansão de infraestrutura para open finance',                 3, 6, '2025-02-01', 1, 'Aprovado', 1, now() - interval '150 days'),
('XP Investimentos',           '02.332.886/0001-04', 'xpi.com.br',           'Marcos Pereira',     'Head of Infrastructure', 'Alta disponibilidade para plataforma de investimentos',        2, 6, '2025-03-01', 1, 'Aprovado', 1, now() - interval '120 days'),
('BTG Pactual',                '30.306.294/0001-45', 'btgpactual.com',       'Ana Souza',          'Diretora de TI',         'Redundância geográfica para sistemas de trading',              4, 5, '2025-07-01', 1, 'Aprovado', 1, now() - interval '30 days'),
('Cielo S.A.',                 '01.027.058/0001-91', 'cielo.com.br',         'Paulo Rodrigues',    'Gerente Sênior TI',      'Colocation para servidores de captura de transações',         1, 4, '2025-08-01', 1, 'Aprovado', 1, now() - interval '15 days'),
('Stone Pagamentos',           '16.501.555/0001-57', 'stone.com.br',         'Juliana Lima',       'VP de Engenharia',       'Infraestrutura dedicada para processamento de pagamentos',     3, 3, '2025-09-01', 1, 'Aprovado', 1, now() - interval '10 days'),
('Nubank',                     '18.236.120/0001-58', 'nubank.com.br',        'Carlos Mendes',      'SRE Lead',               'Cross-connect com operadoras para latência mínima',            6, 2, '2025-10-01', 1, 'Aprovado', 1, now() - interval '5 days'),
('PagSeguro',                  '08.561.701/0001-01', 'pagseguro.com',        'Roberta Ferreira',   'Infraestrutura Manager',  'Backup automatizado de base transacional',                   9, 1, '2025-11-01', 1, 'Pendente', null, null),

-- Stefanini (parceiro 2) ---------------------------------------
('Magazine Luiza S.A.',        '47.960.950/0001-21', 'magazineluiza.com.br', 'Thiago Oliveira',    'Diretor de TI',          'DR para e-commerce e sistemas de estoque',                    8, 6, '2025-01-01', 2, 'Aprovado', 1, now() - interval '160 days'),
('Via Varejo S.A.',            '33.041.260/0652-90', 'viavarejo.com.br',     'Luciana Santos',     'CIO',                    'Consolidação de data centers regionais',                       1, 6, '2025-02-01', 2, 'Aprovado', 1, now() - interval '140 days'),
('Renner S.A.',                '92.754.738/0001-62', 'lojasrenner.com.br',   'Eduardo Nunes',      'Gerente de Infraestrutura','Rack dedicado para sistemas ERP e PDV',                    3, 5, '2025-07-01', 2, 'Aprovado', 1, now() - interval '20 days'),
('Riachuelo',                  '61.182.892/0001-64', 'riachuelo.com.br',     'Patricia Barros',    'IT Manager',             'Conexão direta com Azure para CRM na nuvem',                  5, 4, '2025-08-01', 2, 'Aprovado', 1, now() - interval '12 days'),
('Carrefour Brasil',           '45.543.915/0001-81', 'carrefour.com.br',     'Gustavo Pinto',      'Head de TI',             'Infraestrutura para analytics e BI',                           2, 3, '2025-09-01', 2, 'Aprovado', 1, now() - interval '8 days'),
('GPA - Grupo Pão de Açúcar',  '47.508.411/0001-56', 'gpabr.com',            'Camila Torres',      'Gerente de TI',          'Smart hands para manutenção mensal de equipamentos',          12, 2, '2025-10-01', 2, 'Pendente', null, null),
('Americanas S.A.',            '00.776.574/0006-60', 'americanas.com.br',    'Rafael Cardoso',     'VP de Tecnologia',       'Recuperação de desastres pós-reestruturação',                  8, 1, '2025-11-01', 2, 'Pendente', null, null),

-- Kyndryl (parceiro 3) -----------------------------------------
('Claro S.A.',                 '40.432.544/0001-47', 'claro.com.br',         'Mariana Alves',      'Diretora de Rede',       'Meet-me-room para peering com carriers nacionais',            11, 6, '2025-01-01', 3, 'Aprovado', 1, now() - interval '170 days'),
('Vivo - Telefônica Brasil',   '02.558.157/0001-62', 'vivo.com.br',          'João Batista',       'Gerente de Operações',   'Cage exclusivo para equipamentos de core IP',                  4, 6, '2025-02-01', 3, 'Aprovado', 1, now() - interval '145 days'),
('TIM Brasil',                 '02.421.421/0001-11', 'tim.com.br',           'Beatriz Gomes',      'Head de TI',             'Cross-connect com IX.br para redução de custo de tráfego',    6, 5, '2025-07-01', 3, 'Aprovado', 1, now() - interval '25 days'),
('Embratel',                   '33.530.486/0001-29', 'embratel.com.br',      'Sérgio Monteiro',    'Arquiteto de Redes',     'Colocation para PoP de distribuição nacional',                1, 4, '2025-08-01', 3, 'Aprovado', 1, now() - interval '14 days'),
('Locaweb',                    '10.480.739/0001-06', 'locaweb.com.br',       'Daniela Cruz',       'CTO',                    'Expansão de capacidade para cloud hosting',                    2, 3, '2025-09-01', 3, 'Aprovado', 1, now() - interval '7 days'),
('UOL Diveo',                  '10.779.237/0001-10', 'uol.com.br',           'Alexandre Rocha',    'Gerente de TI',          'NaaS para conectividade entre filiais',                        7, 2, '2025-10-01', 3, 'Pendente', null, null),
('OI S.A.',                    '76.535.764/0001-43', 'oi.com.br',            'Tatiana Freitas',    'Diretora de Infraestrutura','Reestruturação de infraestrutura pós-recuperação judicial', 3, 1, '2025-11-01', 3, 'Pendente', null, null),

-- Logicalis (parceiro 4) ---------------------------------------
('Hapvida Saúde',              '63.554.067/0001-98', 'hapvida.com.br',       'Roberto Lima',       'CIO',                    'Colocation para sistemas HIS e PACS',                          1, 6, '2025-01-01', 4, 'Aprovado', 1, now() - interval '155 days'),
('NotreDame Intermédica',      '44.649.812/0001-38', 'gndi.com.br',          'Cristina Borges',    'Gerente de TI',          'DR para sistemas de faturamento médico',                       8, 6, '2025-02-01', 4, 'Aprovado', 1, now() - interval '135 days'),
('Dasa - Diagnósticos',        '61.486.650/0001-83', 'dasa.com.br',          'Henrique Macedo',    'Head de Infra',          'Backup de imagens diagnósticas (DICOM)',                       9, 5, '2025-07-01', 4, 'Aprovado', 1, now() - interval '22 days'),
('Fleury Medicina',            '60.840.055/0001-31', 'fleury.com.br',        'Isabela Prado',      'Gerente de TI',          'Cloud Connect com AWS para IA diagnóstica',                    5, 4, '2025-08-01', 4, 'Aprovado', 1, now() - interval '11 days'),
('Amil Assistência Médica',    '29.309.127/0001-79', 'amil.com.br',          'Fábio Correia',      'Diretor de TI',          'Rack energizado para servidores de autorizações',              3, 3, '2025-09-01', 4, 'Pendente', null, null),
('Unimed Nacional',            '33.200.049/0001-81', 'unimed.coop.br',       'Vera Lúcia Maia',    'CTO',                    'NaaS para interligação de cooperativas regionais',             7, 2, '2025-10-01', 4, 'Pendente', null, null),
('Einstein Hospital',          '04.611.012/0001-14', 'einstein.br',          'André Vieira',       'Infraestrutura Manager',  'Smart hands para substituição de drives em servidores',      12, 1, '2025-11-01', 4, 'Pendente', null, null),

-- Sonda (parceiro 5) -------------------------------------------
('Embraer S.A.',               '07.689.002/0001-89', 'embraer.com.br',       'Rodrigo Campos',     'VP de TI',               'Cage exclusivo para dados de engenharia confidenciais',        4, 6, '2025-01-01', 5, 'Aprovado', 1, now() - interval '165 days'),
('WEG S.A.',                   '84.429.695/0001-11', 'weg.net',              'Sandra Oliveira',    'Gerente de TI',          'Colocation para servidores de automação industrial',           1, 6, '2025-02-01', 5, 'Aprovado', 1, now() - interval '138 days'),
('JBS S.A.',                   '02.916.265/0001-60', 'jbs.com.br',           'Maurício Costa',     'CIO',                    'DR para sistemas ERP SAP de operações frigoríficas',           8, 5, '2025-07-01', 5, 'Aprovado', 1, now() - interval '28 days'),
('BRF S.A.',                   '01.838.723/0001-27', 'brf-br.com',           'Leticia Andrade',    'Head de Tecnologia',     'Cloud connect Azure para analytics de supply chain',           5, 4, '2025-08-01', 5, 'Aprovado', 1, now() - interval '16 days'),
('Vale S.A.',                  '33.592.510/0001-54', 'vale.com',             'Diego Nascimento',   'Diretor de TI',          'Colocation premium para sistemas de mineração e IoT',         2, 3, '2025-09-01', 5, 'Pendente', null, null),
('Petrobras',                  '33.000.167/0001-01', 'petrobras.com.br',     'Eliane Ramos',       'Gerente de TI',          'Redundância para sistemas SCADA e ERP',                        3, 2, '2025-10-01', 5, 'Pendente', null, null),
('Braskem S.A.',               '42.150.391/0001-70', 'braskem.com.br',       'Tiago Souza',        'IT Manager',             'NaaS para conectar plantas industriais',                       7, 1, '2025-11-01', 5, 'Pendente', null, null),

-- Teltex (parceiro 6) ------------------------------------------
('Serpro',                     '33.683.111/0001-07', 'serpro.gov.br',        'Aline Pereira',      'Gerente de Datacenter',  'Colocation govcloud para sistemas tributários',                1, 6, '2025-01-01', 6, 'Aprovado', 1, now() - interval '158 days'),
('Dataprev',                   '42.422.000/0001-41', 'dataprev.gov.br',      'Carlos Eduardo',     'Diretor de TI',          'DR para sistemas previdenciários críticos',                    8, 6, '2025-02-01', 6, 'Aprovado', 1, now() - interval '132 days'),
('Caixa Econômica Federal',    '00.360.305/0001-04', 'caixa.gov.br',         'Miriam Campos',      'CTO',                    'Rack energizado para processamento do FGTS digital',           3, 5, '2025-07-01', 6, 'Aprovado', 1, now() - interval '23 days'),
('Banco do Brasil',            '00.000.000/0001-91', 'bb.com.br',            'Leandro Santos',     'VP de Tecnologia',       'Cross-connect com BACEN para liquidação em tempo real',        6, 4, '2025-08-01', 6, 'Aprovado', 1, now() - interval '13 days'),
('BNDES',                      '33.657.248/0001-89', 'bndes.gov.br',         'Priscila Mendes',    'Gerente de Infra',       'Colocation para ambiente de análise de crédito',               1, 3, '2025-09-01', 6, 'Pendente', null, null),
('Receita Federal',            '00.394.460/0058-78', 'receita.fazenda.gov.br','Otávio Lima',       'Coordenador de TI',      'NaaS para interligação das delegacias regionais',              7, 2, '2025-10-01', 6, 'Pendente', null, null),
('ANATEL',                     '02.030.715/0001-12', 'anatel.gov.br',        'Natália Costa',      'Gerente de Datacenter',  'Backup de sistemas de fiscalização e monitoramento',           9, 1, '2025-11-01', 6, 'Pendente', null, null),

-- Redbelt (parceiro 7) -----------------------------------------
('Kroton Educacional',         '02.800.026/0001-40', 'kroton.com.br',        'Felipe Moreira',     'Head de TI',             'Colocation para LMS e plataformas EAD',                        1, 6, '2025-02-01', 7, 'Aprovado', 1, now() - interval '148 days'),
('Estácio Participações',      '08.807.432/0001-10', 'estacio.br',           'Giovanna Martins',   'Gerente de TI',          'Cloud connect para migração para AWS',                         5, 5, '2025-07-01', 7, 'Aprovado', 1, now() - interval '26 days'),
('UNINOVE',                    '58.911.364/0001-44', 'uninove.br',           'Bruno Ferreira',     'CTO',                    'DR para sistemas acadêmicos e financeiros',                    8, 4, '2025-08-01', 7, 'Aprovado', 1, now() - interval '17 days'),
('FGV - Fund. Getulio Vargas', '33.269.254/0001-29', 'fgv.br',              'Claudia Neves',      'Diretora de TI',         'Cage exclusivo para pesquisa e dados econômicos',              4, 3, '2025-09-01', 7, 'Pendente', null, null),
('Insper',                     '68.310.411/0001-41', 'insper.edu.br',        'Renato Albuquerque', 'Infraestrutura Manager',  'Smart hands para upgrade de servidores',                     12, 2, '2025-10-01', 7, 'Pendente', null, null),
('Anhanguera Educacional',     '00.591.124/0001-49', 'anhanguera.com',       'Monique Ribeiro',    'Gerente de TI',          'NaaS para conectar campi em 5 estados',                        7, 1, '2025-11-01', 7, 'Pendente', null, null),

-- Totvs (parceiro 8) -------------------------------------------
('Localiza Rent a Car',        '16.670.085/0001-55', 'localiza.com',         'Vinícius Borges',    'CIO',                    'Colocation para sistemas de frota e GPS',                      1, 6, '2025-01-01', 8, 'Aprovado', 1, now() - interval '162 days'),
('Movida Participações',       '21.314.559/0001-66', 'movida.com.br',        'Larissa Fonseca',    'Gerente de TI',          'DR para sistema de reservas e faturamento',                    8, 6, '2025-02-01', 8, 'Aprovado', 1, now() - interval '142 days'),
('Tegma Gestão Logística',     '58.800.004/0001-15', 'tegma.com.br',         'Flávio Azevedo',     'Head de Tecnologia',     'Rack energizado para rastreamento de cargas',                  3, 5, '2025-07-01', 8, 'Aprovado', 1, now() - interval '29 days'),
('JSL S.A.',                   '52.548.435/0001-59', 'jsl.com.br',           'Bruna Cavalcanti',   'IT Manager',             'Cloud connect com GCP para otimização de rotas por IA',        5, 4, '2025-08-01', 8, 'Aprovado', 1, now() - interval '18 days'),
('Correios',                   '34.028.316/0001-03', 'correios.com.br',      'Marcos Junqueira',   'Coordenador de TI',      'Colocation para sistemas de rastreamento nacional',            2, 3, '2025-09-01', 8, 'Pendente', null, null),
('DHL Brasil',                 '07.948.002/0001-52', 'dhl.com.br',           'Adriana Teixeira',   'Gerente de Infra',       'NaaS para integrar armazéns e filiais',                        7, 2, '2025-10-01', 8, 'Pendente', null, null),
('FedEx Brasil',               '49.675.856/0001-80', 'fedex.com',            'Estevan Lopes',      'Head de TI',             'Remote hands para manutenção de equipamentos',                10, 1, '2025-11-01', 8, 'Pendente', null, null),

-- Wittel (parceiro 9) ------------------------------------------
('Ambev S.A.',                 '07.526.557/0001-00', 'ambev.com.br',         'Cintia Barbosa',     'VP de TI',               'Cage exclusivo para dados de produção e supply chain',         4, 6, '2025-01-01', 9, 'Aprovado', 1, now() - interval '172 days'),
('Natura &Co',                 '71.673.990/0001-77', 'natura.com.br',        'Hugo Cavalcante',    'CTO',                    'Cloud connect com Azure para comércio digital',                5, 6, '2025-02-01', 9, 'Aprovado', 1, now() - interval '148 days'),
('Grupo Boticário',            '75.031.097/0001-77', 'grupoboticario.com.br','Sabrina Leal',       'Gerente de TI',          'DR para e-commerce e CRM de 40M de clientes',                 8, 5, '2025-07-01', 9, 'Aprovado', 1, now() - interval '27 days'),
('Hering S.A.',                '78.876.950/0001-71', 'hering.com.br',        'Leonardo Faria',     'Head de Infra',          'Colocation para sistemas de varejo e franquias',               1, 4, '2025-08-01', 9, 'Aprovado', 1, now() - interval '19 days'),
('Arezzo S.A.',                '16.590.234/0001-76', 'arezzo.com.br',        'Fernanda Queiroz',   'IT Manager',             'Backup as a service para ERP e e-commerce',                   9, 3, '2025-09-01', 9, 'Pendente', null, null),
('Vivara S.A.',                '43.886.005/0001-17', 'vivara.com.br',        'Guilherme Assunção', 'Gerente de TI',          'NaaS para lojas e escritório central',                         7, 2, '2025-10-01', 9, 'Pendente', null, null),
('Grupo Soma',                 '26.518.154/0001-84', 'grupossoma.com.br',    'Raquel Bittencourt', 'CIO',                    'Smart hands para instalação em novo rack',                    12, 1, '2025-11-01', 9, 'Pendente', null, null),

-- Claro Empresas (parceiro 10) ----------------------------------
('Porto Seguro S.A.',          '61.198.164/0001-60', 'portoseguro.com.br',   'Marcelo Pinheiro',   'Diretor de TI',          'Colocation para sistemas de apólices e sinistros',             1, 6, '2025-01-01', 10, 'Aprovado', 1, now() - interval '168 days'),
('SulAmérica Seguros',         '01.685.903/0001-16', 'sulamerica.com.br',    'Karina Dutra',       'Gerente de TI',          'DR para sistemas core de seguradora',                          8, 6, '2025-02-01', 10, 'Aprovado', 1, now() - interval '143 days'),
('Tokio Marine',               '33.164.021/0001-78', 'tokiomarine.com.br',   'Anderson Ramos',     'Head de Infra',          'Cross-connect com resseguradoras internacionais',              6, 5, '2025-07-01', 10, 'Aprovado', 1, now() - interval '24 days'),
('Bradesco Seguros',           '92.693.118/0001-56', 'bradescoseguros.com.br','Tereza Cavalcante', 'CTO',                    'Cloud connect Azure para CRM e analytics atuarial',            5, 4, '2025-08-01', 10, 'Aprovado', 1, now() - interval '15 days'),
('HDI Seguros',                '34.255.743/0001-84', 'hdi.com.br',           'Samuel Nunes',       'Gerente de TI',          'Rack energizado para processamento de sinistros',              3, 3, '2025-09-01', 10, 'Pendente', null, null),
('Chubb Seguros',              '23.916.893/0001-61', 'chubb.com',            'Patrícia Salgado',   'IT Manager',             'Backup para sistemas de subscrição',                           9, 2, '2025-10-01', 10, 'Pendente', null, null),
('Mapfre Seguros',             '61.074.175/0001-38', 'mapfre.com.br',        'Rafael Trevisan',    'Head de TI',             'Colocation padrão para filiais no Brasil',                     1, 1, '2025-11-01', 10, 'Pendente', null, null);

-- ── FIM DA PARTE 4 ───────────────────────────────────────────
-- Execute takoda_part5_seed_opps_b.sql a seguir
