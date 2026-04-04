// ============================================================
//  config.js — Conexão Supabase e constantes globais
//  TROQUE as duas variáveis abaixo pelos valores do seu projeto
//  Supabase → Project Settings → API
// ============================================================

const SUPABASE_URL  = 'https://kjzpjuxekzhjoyernxuv.supabase.co';
const SUPABASE_ANON = 'sb_publishable_p_H6fbhHXM9JYzG5vROAKA_jMDIpWYF';

// Cliente global — usado por todos os módulos
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Colunas da tabela de oportunidades ──────────────────────
const ALL_COLS = [
  { k: 'empresa',    l: 'Empresa',    req: true  },
  { k: 'cnpj',       l: 'CNPJ',       req: false },
  { k: 'contato',    l: 'Contato',    req: false },
  { k: 'cargo',      l: 'Cargo',      req: false },
  { k: 'produto',    l: 'Produto',    req: false },
  { k: 'status',     l: 'Etapa',      req: false },
  { k: 'fechamento', l: 'Fechamento', req: false },
  { k: 'parceiro',   l: 'Parceiro',   req: false },
  { k: 'aprovacao',  l: 'Aprovação',  req: false },
  { k: 'tarefas',    l: 'Tarefas',    req: false },
  { k: 'acoes',      l: 'Ações',      req: true  },
];

// Paleta de cores dos gráficos
const CHART_FILLS = [
  '#7c3aed', '#c026d3', '#059669',
  '#d97706', '#0ea5e9', '#6d28d9', '#a21caf'
];

// Estado global da aplicação (único lugar onde o estado vive)
const APP = {
  statusList : [],
  partners   : [],
  products   : [],
  opps       : [],
  cu         : null,   // current user: { role, pid, name, ini, site }
  visCols    : null,
  editId     : null,
  editTasks  : [],
  tSort      : { col: 'empresa', dir: 'asc' },
  tPage      : 0,
  tPageSize  : 30,
};
