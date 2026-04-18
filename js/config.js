// ============================================================
//  config.js — Conexão Supabase e constantes globais
//  TROQUE as duas variáveis abaixo pelos valores do seu projeto
//  Supabase → Project Settings → API
// ============================================================

const SUPABASE_URL  = 'https://jtdrnjlbnchsvjxuifku.supabase.co';
const SUPABASE_ANON = 'sb_publishable_fTzo-xYRLF5ODTfGiMPPUA_nITIkhdE';

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

// Paleta de cores dos gráficos — Takoda orange/gold
const CHART_FILLS = [
  '#E85D1A', '#F5A623', '#C4440D',
  '#059669', '#0ea5e9', '#d97706', '#a16207'
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
