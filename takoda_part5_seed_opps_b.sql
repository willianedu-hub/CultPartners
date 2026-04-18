-- ============================================================
--  takoda_part5_seed_opps_b.sql — Oportunidades 76-155
--  Execute APÓS takoda_part4_seed_opps_a.sql
-- ============================================================

INSERT INTO oportunidades
  (empresa, cnpj, site_empresa, contato, cargo, obs, produto_id, status_id, fechamento, parceiro_id, aprovacao, approved_by, approved_at)
VALUES

-- NTT Data (mais oportunidades) --------------------------------
('Safra S.A.',                 '58.160.789/0001-28', 'safra.com.br',          'Maurício Guedes',    'Gerente de TI',          'Colocation premium para sistemas de private banking',          2, 6, '2025-03-01', 1, 'Aprovado', 1, now() - interval '110 days'),
('Modalmais',                  '62.287.735/0001-00', 'modalmais.com.br',      'Vanessa Cunha',      'Head de Infra',          'Cloud connect para plataforma de renda variável',              5, 4, '2025-08-01', 1, 'Aprovado', 1, now() - interval '9 days'),
('Rico Investimentos',         '42.763.586/0001-40', 'rico.com.vc',           'Henrique Lessa',     'Arquiteto de TI',        'NaaS para integração entre filiais e data center',             7, 3, '2025-09-01', 1, 'Aprovado', 1, now() - interval '6 days'),
('Warren Investimentos',       '17.263.662/0001-01', 'warren.com.br',         'Giovanna Leite',     'CTO',                    'Backup as a service para base de clientes',                    9, 2, '2025-10-01', 1, 'Pendente', null, null),
('Inter S.A.',                 '00.416.968/0001-01', 'bancointer.com.br',     'Frederico Brant',    'VP de Tecnologia',       'Cross-connect para liquidação D+0',                            6, 1, '2025-11-01', 1, 'Pendente', null, null),

-- Stefanini (mais) ---------------------------------------------
('Centauro S.A.',              '06.347.409/0001-25', 'centauro.com.br',       'Aline Machado',      'Gerente de TI',          'Colocation para ERP e e-commerce de artigos esportivos',       1, 6, '2025-03-01', 2, 'Aprovado', 1, now() - interval '115 days'),
('Decathlon Brasil',           '04.757.992/0001-24', 'decathlon.com.br',      'Rodrigo Peixoto',    'Head de Infra',          'DR para sistemas de estoque e logística',                      8, 4, '2025-08-01', 2, 'Aprovado', 1, now() - interval '10 days'),
('Lojas Quero-Quero',          '94.868.058/0001-00', 'queroquero.com.br',     'Simone Aguiar',      'IT Manager',             'NaaS para conectar 450+ lojas no RS',                          7, 3, '2025-09-01', 2, 'Pendente', null, null),
('Leroy Merlin Brasil',        '78.876.950/0001-44', 'leroymerlin.com.br',    'Cláudio Barbosa',    'Gerente de TI',          'Cloud connect Azure para ERP SAP S/4HANA',                     5, 2, '2025-10-01', 2, 'Pendente', null, null),
('Casas Bahia',                '62.227.257/0001-41', 'casasbahia.com.br',     'Juliana Assis',      'CIO',                    'Rack energizado para processamento de crediário',              3, 1, '2025-11-01', 2, 'Pendente', null, null),

-- Kyndryl (mais) -----------------------------------------------
('Rede Energia (CPFL)',        '02.429.144/0001-93', 'cpfl.com.br',           'Antonio Dias',       'Diretor de TI',          'Colocation para sistemas SCADA e smart grid',                  1, 6, '2025-03-01', 3, 'Aprovado', 1, now() - interval '108 days'),
('Energisa S.A.',              '71.027.866/0001-34', 'energisa.com.br',       'Marcela Pires',      'Gerente de Infra',       'DR para sistemas de medição e faturamento',                    8, 5, '2025-07-01', 3, 'Aprovado', 1, now() - interval '21 days'),
('Enel Brasil',                '08.317.250/0001-05', 'enel.com.br',           'Danilo Freitas',     'CTO',                    'Cage exclusivo para NOC e sistemas de distribuição',           4, 4, '2025-08-01', 3, 'Aprovado', 1, now() - interval '12 days'),
('Sabesp',                     '43.776.517/0001-80', 'sabesp.com.br',         'Carla Monteiro',     'Gerente de TI',          'Colocation para sistemas de telemetria hídrica',               1, 3, '2025-09-01', 3, 'Pendente', null, null),
('Copasa MG',                  '17.281.106/0001-03', 'copasa.com.br',         'Luiz Otávio',        'IT Manager',             'Backup para base de dados de clientes e medições',             9, 2, '2025-10-01', 3, 'Pendente', null, null),

-- Logicalis (mais) ---------------------------------------------
('Hospital Sírio-Libanês',     '61.590.410/0001-44', 'hospitalsiriolibanes.com.br','Adriane Costa','Head de TI',             'Colocation para prontuário eletrônico e PACS',                 2, 6, '2025-03-01', 4, 'Aprovado', 1, now() - interval '112 days'),
('Rede D\'Or São Luiz',        '06.047.087/0001-39', 'rededorsaoluiz.com.br', 'Thiago Braga',       'CIO',                    'DR para sistema de gestão hospitalar integrado',               8, 5, '2025-07-01', 4, 'Aprovado', 1, now() - interval '30 days'),
('Hermes Pardini',             '19.378.769/0001-76', 'hermespardini.com.br',  'Erika Sousa',        'Gerente de Infra',       'Cloud connect para laudos em nuvem',                           5, 4, '2025-08-01', 4, 'Aprovado', 1, now() - interval '14 days'),
('Grupo Fleury',               '29.979.036/0001-02', 'grupofleury.com.br',    'Luciana Viotti',     'Diretora de TI',         'NaaS para clínicas e laboratórios afiliados',                  7, 3, '2025-09-01', 4, 'Pendente', null, null),
('Oncoclínicas do Brasil',     '22.225.820/0001-83', 'oncoclínicas.com.br',  'Pedro Salles',       'Arquiteto de TI',        'Rack energizado para sistemas de radioterapia',                3, 2, '2025-10-01', 4, 'Pendente', null, null),

-- Sonda (mais) -------------------------------------------------
('Marfrig Global Foods',       '03.853.896/0001-40', 'marfrig.com.br',        'Giovani Sturaro',    'VP de TI',               'Colocation para ERP de frigoríficos',                          1, 6, '2025-03-01', 5, 'Aprovado', 1, now() - interval '107 days'),
('Suzano S.A.',                '16.404.287/0001-55', 'suzano.com.br',         'Isabel Mendonça',    'Gerente de TI',          'DR para sistemas de produção de celulose',                     8, 5, '2025-07-01', 5, 'Aprovado', 1, now() - interval '31 days'),
('Klabin S.A.',                '89.637.490/0001-45', 'klabin.com.br',         'Renata Lopes',       'Head de Infra',          'Cloud connect para analytics industrial em Azure',             5, 4, '2025-08-01', 5, 'Aprovado', 1, now() - interval '20 days'),
('Gerdau S.A.',                '33.611.500/0001-19', 'gerdau.com',            'André Siqueira',     'Diretor de TI',          'Cage exclusivo para sistemas de controle de aciaria',          4, 3, '2025-09-01', 5, 'Pendente', null, null),
('Usiminas',                   '60.894.730/0001-05', 'usiminas.com',          'Danielle Castro',    'IT Manager',             'NaaS para conectar usinas e escritório central',               7, 2, '2025-10-01', 5, 'Pendente', null, null),

-- Teltex (mais) ------------------------------------------------
('Tribunal de Justiça SP',     '07.099.670/0001-30', 'tjsp.jus.br',           'Márcio Figueiredo',  'Diretor de TI',          'Colocation para sistemas judiciais e SAJ',                     1, 6, '2025-03-01', 6, 'Aprovado', 1, now() - interval '130 days'),
('STJ - Superior Tribunal',    '00.482.840/0001-24', 'stj.jus.br',            'Adriana Pinheiro',   'Coordenadora de TI',     'DR para sistemas de processo judicial eletrônico',             8, 5, '2025-07-01', 6, 'Aprovado', 1, now() - interval '26 days'),
('TCU - Tribunal de Contas',   '00.414.607/0001-18', 'tcu.gov.br',            'Rogério Menezes',    'Gerente de TI',          'Cage exclusivo para dados sigilosos de auditoria',             4, 4, '2025-08-01', 6, 'Aprovado', 1, now() - interval '16 days'),
('INSS',                       '29.979.036/0001-44', 'inss.gov.br',           'Cláudia Saraiva',    'Head de Infra',          'Rack energizado para sistemas de benefícios',                  3, 3, '2025-09-01', 6, 'Pendente', null, null),
('Ministério da Saúde',        '00.394.411/0006-12', 'saude.gov.br',          'Eduardo Fonseca',    'Coordenador de TI',      'Backup para base do SUS e RNDS',                               9, 2, '2025-10-01', 6, 'Pendente', null, null),

-- Redbelt (mais) -----------------------------------------------
('GetNinjas',                  '17.457.926/0001-05', 'getninjas.com.br',      'Matheus Corrêa',     'CTO',                    'Colocation para plataforma de marketplace',                    1, 5, '2025-07-01', 7, 'Aprovado', 1, now() - interval '32 days'),
('iFood',                      '14.380.200/0001-21', 'ifood.com.br',          'Thaís Azevedo',      'VP de Engenharia',       'Cross-connect para CDN e baixa latência de delivery',          6, 4, '2025-08-01', 7, 'Aprovado', 1, now() - interval '18 days'),
('Enjoei',                     '16.640.553/0001-64', 'enjoei.com.br',         'Lucas Drummond',     'Head de Infra',          'Cloud connect AWS para recomendação por IA',                   5, 3, '2025-09-01', 7, 'Pendente', null, null),
('Mercado Livre Brasil',       '03.007.331/0001-41', 'mercadolivre.com.br',   'Verônica Bastos',    'Diretora de TI',         'Cage exclusivo para servidores de pagamento',                  4, 2, '2025-10-01', 7, 'Pendente', null, null),
('OLX Brasil',                 '09.515.503/0001-02', 'olx.com.br',            'Rodrigo Saldanha',   'IT Manager',             'NaaS para dados entre regiões',                                7, 1, '2025-11-01', 7, 'Pendente', null, null),

-- Totvs (mais) -------------------------------------------------
('Azul Linhas Aéreas',         '09.296.295/0001-60', 'voeazul.com.br',        'Fabiana Nery',       'CTO',                    'Colocation para sistema de reservas e bilhetagem',             2, 6, '2025-03-01', 8, 'Aprovado', 1, now() - interval '118 days'),
('GOL Linhas Aéreas',          '06.164.253/0001-87', 'voegol.com.br',         'Paulo Aquino',       'VP de Tecnologia',       'DR para check-in e operações de voo',                          8, 5, '2025-07-01', 8, 'Aprovado', 1, now() - interval '33 days'),
('LATAM Airlines Brasil',      '65.788.759/0001-94', 'latam.com',             'Carolina Muniz',     'Diretora de TI',         'Cloud connect Azure para programa de fidelidade',              5, 4, '2025-08-01', 8, 'Aprovado', 1, now() - interval '19 days'),
('Gol Smiles',                 '03.117.771/0001-49', 'smiles.com.br',         'Davi Nogueira',      'Head de Infra',          'Rack energizado para processamento de pontos e resgates',      3, 3, '2025-09-01', 8, 'Pendente', null, null),
('CVC Corp',                   '10.760.260/0001-19', 'cvccorp.com.br',        'Débora Meireles',    'Gerente de TI',          'Backup para sistema de reservas de pacotes',                   9, 2, '2025-10-01', 8, 'Pendente', null, null),

-- Wittel (mais) ------------------------------------------------
('Grupo Zaffari',              '93.209.765/0001-55', 'zaffari.com.br',        'Cristiano Pompeu',   'Gerente de TI',          'Colocation para sistemas de supermercado e conveniência',      1, 6, '2025-03-01', 9, 'Aprovado', 1, now() - interval '120 days'),
('Assaí Atacadista',           '06.057.223/0001-71', 'assai.com.br',          'Letícia Mota',       'Head de TI',             'DR para sistemas de atacado e PDV',                            8, 5, '2025-07-01', 9, 'Aprovado', 1, now() - interval '34 days'),
('Atacadão S.A.',              '75.315.333/0001-09', 'atacadao.com.br',       'Rodrigo Alves',      'IT Manager',             'NaaS para conectar 300+ lojas no Brasil',                      7, 4, '2025-08-01', 9, 'Aprovado', 1, now() - interval '21 days'),
('Sam\'s Club Brasil',         '59.761.016/0001-88', 'samsclub.com.br',       'Fernanda Coutinho',  'Gerente de Infra',       'Cloud connect para plataforma omnichannel',                    5, 3, '2025-09-01', 9, 'Pendente', null, null),
('Hortifruti Natural da Terra','35.785.420/0001-86', 'hfnatural.com.br',      'Jonas Rezende',      'CTO',                    'Rack energizado para ERP e sistemas de estoque',               3, 2, '2025-10-01', 9, 'Pendente', null, null),

-- Claro (mais) -------------------------------------------------
('Grupo SBT',                  '43.512.717/0001-04', 'sbt.com.br',            'Alex Monteiro',      'Diretor de TI',          'Colocation para transmissão digital e arquivos de mídia',      2, 6, '2025-03-01', 10, 'Aprovado', 1, now() - interval '113 days'),
('Record TV',                  '60.899.461/0001-92', 'recordtv.com.br',       'Isabelle Gama',      'Head de Infra',          'DR para sistemas de broadcast e playout',                      8, 5, '2025-07-01', 10, 'Aprovado', 1, now() - interval '35 days'),
('Globo Comunicações',         '27.865.757/0001-02', 'globo.com',             'Marcus Pedrosa',     'VP de Tecnologia',       'Cage exclusivo para arquivos de vídeo e sistemas de streaming', 4, 4, '2025-08-01', 10, 'Aprovado', 1, now() - interval '22 days'),
('Band - Bandeirantes',        '62.088.005/0001-80', 'band.com.br',           'Tatiana Bergmann',   'Gerente de TI',          'Cloud connect Azure para CMS e plataforma digital',            5, 3, '2025-09-01', 10, 'Pendente', null, null),
('CNN Brasil',                 '34.274.475/0001-50', 'cnnbrasil.com.br',      'Felipe Gontijo',     'CTO',                    'Colocation para ingest de vídeo e CDN de notícias',            1, 2, '2025-10-01', 10, 'Pendente', null, null),

-- Oportunidades perdidas (para dar realismo ao funil) ----------
('Banco Votorantim',           '59.588.111/0001-03', 'bv.com.br',             'Nelson Braga',       'Head de Infra',          'Perdeu para concorrente com proposta mais competitiva',        1, 7, '2025-04-01', 1, 'Aprovado', 1, now() - interval '90 days'),
('Hertz Brasil',               '15.370.495/0001-25', 'hertz.com.br',          'Elisa Paiva',        'Gerente de TI',          'Cliente optou por manter infra própria',                       3, 7, '2025-04-01', 2, 'Aprovado', 1, now() - interval '85 days'),
('Electrolux do Brasil',       '59.291.534/0001-67', 'electrolux.com.br',     'Gustavo Nunes',      'IT Manager',             'Budget cortado no Q2 — retomar Q4',                           2, 7, '2025-05-01', 3, 'Aprovado', 1, now() - interval '80 days'),
('Fiat Chrysler Brasil',       '03.302.544/0001-00', 'fiat.com.br',           'Roberto Vasconcelos','Diretor de TI',          'Processo licitatório complexo — prazo expirado',              1, 7, '2025-05-01', 4, 'Aprovado', 1, now() - interval '75 days'),
('Toyota do Brasil',           '59.275.792/0001-50', 'toyota.com.br',         'Akemi Tanaka',       'Head de TI',             'Matriz Japão determinou uso de DC regional em São Paulo',     4, 7, '2025-06-01', 5, 'Aprovado', 1, now() - interval '70 days'),
('GM do Brasil',               '59.275.792/0002-31', 'gm.com.br',             'Carlos Drummond',    'CIO',                    'Processo parado por reorganização interna',                   2, 7, '2025-06-01', 6, 'Aprovado', 1, now() - interval '65 days'),
('Volkswagen do Brasil',       '59.275.792/0003-12', 'vw.com.br',             'Sven Braun',         'Head de Infra',          'Migrou para campus próprio em São Bernardo',                  3, 7, '2025-06-01', 7, 'Aprovado', 1, now() - interval '60 days'),
('Ford do Brasil',             '59.275.792/0004-93', 'ford.com.br',           'James Robinson',     'VP de TI',               'Encerramento das operações no Brasil',                        1, 7, '2025-07-01', 8, 'Aprovado', 1, now() - interval '55 days'),

-- Oportunidades rejeitadas (para demonstrar fluxo) -------------
('Empresa Fictícia Alpha',     '00.000.001/0001-00', null,                    'João da Silva',       'Gerente',                'Informações insuficientes — empresa sem histórico',            1, 1, '2025-12-01', 1, 'Rejeitado', 1, null),
('Empresa Fictícia Beta',      '00.000.002/0001-00', null,                    'Maria Oliveira',      'Analista',               'CNPJ inválido — reenviar documentação',                       3, 1, '2025-12-01', 2, 'Rejeitado', 1, null);

-- ── TAREFAS DE EXEMPLO ───────────────────────────────────────
-- Associadas às primeiras oportunidades aprovadas (IDs 1 a 5)
INSERT INTO tarefas (oportunidade_id, descricao, prazo, responsavel, concluida, concluida_em) VALUES
  (1, 'Enviar proposta técnica detalhada',           '2025-01-15', 'NTT Data - Ricardo',     true,  now() - interval '175 days'),
  (1, 'Agendar visita técnica ao DC Takoda',         '2025-01-20', 'NTT Data - Ricardo',     true,  now() - interval '170 days'),
  (1, 'Assinar contrato de serviço (MSA)',           '2025-01-28', 'Admin Takoda',           true,  now() - interval '165 days'),
  (2, 'Levantamento de equipamentos para migração',  '2025-02-05', 'NTT Data - Fernanda',    true,  now() - interval '145 days'),
  (2, 'Janela de migração aprovada pela equipe',     '2025-02-12', 'NTT Data - Fernanda',    true,  now() - interval '140 days'),
  (3, 'POC de conectividade Cloud Connect',          '2025-03-10', 'NTT Data - Marcos',      true,  now() - interval '115 days'),
  (3, 'Aprovação jurídica do contrato',              '2025-03-18', 'Admin Takoda',           true,  now() - interval '108 days'),
  (4, 'Proposta financeira enviada ao BTG',          '2025-06-15', 'NTT Data - Ana',         true,  now() - interval '25 days'),
  (4, 'Negociação de SLA 99,999%',                   '2025-06-22', 'Admin Takoda',           false, null),
  (4, 'Aguardando aprovação do board do BTG',        '2025-07-10', 'NTT Data - Ana',         false, null),
  (5, 'Reunião de kickoff com equipe Cielo',         '2025-07-05', 'NTT Data - Paulo',       true,  now() - interval '10 days'),
  (5, 'Definir layout dos racks',                    '2025-07-15', 'Admin Takoda',           false, null),
  (9, 'Demo da plataforma de e-commerce no DC',      '2025-01-20', 'Stefanini - Thiago',     true,  now() - interval '155 days'),
  (9, 'Contrato de DR assinado',                     '2025-01-25', 'Admin Takoda',           true,  now() - interval '150 days'),
  (16, 'Visita ao DC com equipe de rede da Claro',   '2025-01-10', 'Kyndryl - Mariana',      true,  now() - interval '165 days'),
  (16, 'Testes de peering no MMR concluídos',        '2025-01-20', 'Kyndryl - Mariana',      true,  now() - interval '158 days'),
  (16, 'Contrato de MMR assinado',                   '2025-01-28', 'Admin Takoda',           true,  now() - interval '150 days');

-- ── FIM DA PARTE 5 (último arquivo) ──────────────────────────
-- Todos os arquivos foram executados com sucesso.
-- Acesse o portal com: login=admin / senha=Takoda@2025!
-- Parceiros acessam com: login=nttdata (ou outro) / senha=Parceiro@2025!
