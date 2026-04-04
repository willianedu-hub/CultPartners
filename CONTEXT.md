# CultPartners — Contexto do Projeto para Claude Code

## Sobre este arquivo

Este arquivo contém o contexto completo do projeto CultPartners desenvolvido em sessão anterior.
Use-o para continuar o desenvolvimento sem perder nenhuma decisão técnica já tomada.

-----

## 1. O que é o CultPartners

Portal web de **registro e gestão de oportunidades comerciais** para parceiros e revendas da **CULTSEC** (empresa brasileira de conscientização em cibersegurança — cultsec.com.br).

**Fluxo principal:**

1. Parceiro faz login → registra uma oportunidade (empresa cliente que está trabalhando)
1. Admin da CULTSEC recebe → aprova ou rejeita com motivo
1. Oportunidade aprovada entra no pipeline → parceiro adiciona tarefas e movimenta status
1. Admin acompanha tudo via dashboard, kanban, relatórios e drill-down

-----

## 2. Stack técnica

|Camada      |Tecnologia                                  |Observação                                        |
|------------|--------------------------------------------|--------------------------------------------------|
|Frontend    |HTML + CSS + JavaScript puro (sem framework)|SPA single-page, sem build step                   |
|Backend / DB|Supabase (PostgreSQL)                       |Auth própria via tabelas, sem Supabase Auth       |
|Hosting     |Netlify                                     |Deploy por drag-and-drop da pasta                 |
|Senhas      |pgcrypto (bcrypt, cost 12)                  |`crypt(senha, gen_salt('bf', 12))`                |
|Logos       |Google S2 Favicons API                      |`https://www.google.com/s2/favicons?sz=32&domain=`|

-----

## 3. Estrutura de arquivos (Netlify)

```
cultpartners/
├── index.html          ← shell HTML + modais + estrutura das views
├── _redirects          ← Netlify SPA: /* /index.html 200
├── css/
│   └── app.css         ← todo o CSS (~34KB)
└── js/
    ├── config.js       ← SUPABASE_URL, SUPABASE_ANON, APP state, ALL_COLS, CHART_FILLS
    ├── ui.js           ← g(), toast(), openM(), closeM(), logoImg(), esc(), fmtMonth(), maskCnpj()
    ├── data.js         ← TODAS as chamadas ao Supabase (DB object), nenhum outro arquivo chama sb.from()
    ├── auth.js         ← boot(), doLogin(), doLogout(), loadBaseData(), startApp()
    ├── nav.js          ← nav(page), VIEW_TITLES
    ├── dashboard.js    ← renderDash(), drill(), _renderDonut(), _renderBarPartner(), _renderLine()
    ├── table.js        ← renderTable(), buildFilters(), sortBy(), exportCSV(), buildColPicker()
    ├── kanban.js       ← renderKanban(), drag & drop handlers
    ├── reports.js      ← renderReports(), por produto/parceiro/status com drill-down
    ├── ops.js          ← openOpModal(), editOp(), saveOp(), approveOp(), openReject(), tarefas
    └── admin.js        ← openCad(), CRUD de status/parceiros(com edição)/produtos
```

**Ordem de carregamento dos scripts no index.html (importa):**

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/config.js"></script>
<script src="js/ui.js"></script>
<script src="js/data.js"></script>
<script src="js/auth.js"></script>
<script src="js/nav.js"></script>
<script src="js/dashboard.js"></script>
<script src="js/table.js"></script>
<script src="js/kanban.js"></script>
<script src="js/reports.js"></script>
<script src="js/ops.js"></script>
<script src="js/admin.js"></script>
<script>boot();</script>
```

-----

## 4. Banco de dados (Supabase / PostgreSQL)

### 4.1 Extensões

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- bcrypt
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- busca textual ILIKE eficiente
```

### 4.2 Tabelas

#### `admins`

```
id, nome, login (UNIQUE), senha_hash (bcrypt), email, ativo, created_at, updated_at
```

Seed: `admin / CultP@rtners2025` (trocar no primeiro acesso)

#### `parceiros`

```
id, nome, cnpj, site, login (UNIQUE), senha_hash (bcrypt), email, ativo, deleted_at (soft delete), created_at, updated_at
```

Seed de demo: 10 parceiros, todos com senha `Parceiro@2025`

#### `status_funil`

```
id, nome (UNIQUE), cor (hex), ordem (SMALLINT), ativo, created_at, updated_at
```

Seed: Prospect, Qualificado, Proposta, Negociação, Ganho, Perdido

#### `produtos`

```
id, nome (UNIQUE), categoria, descricao, ativo, created_at, updated_at
```

Seed: 7 produtos CULTSEC

#### `oportunidades`

```
id, empresa, cnpj, site_empresa, contato, cargo, obs,
produto_id (FK → produtos), status_id (FK → status_funil),
fechamento (DATE — sempre primeiro dia do mês: YYYY-MM-01),
parceiro_id (FK → parceiros),
aprovacao (ENUM: Pendente|Aprovado|Rejeitado),
approved_at, approved_by (FK → admins),
motivo_rejeicao, rejected_at, rejected_by (FK → admins),
deleted_at (soft delete), created_at, updated_at
```

#### `tarefas`

```
id, oportunidade_id (FK → oportunidades CASCADE DELETE),
descricao, prazo (DATE), responsavel,
concluida (BOOLEAN), concluida_em (TIMESTAMPTZ),
created_at, updated_at
```

#### `preferencias_usuario`

```
user_key (PK — 'admin' ou String(parceiro.id)),
colunas (JSONB — array de keys visíveis na tabela),
updated_at
```

#### `audit_log`

```
id, tabela, registro_id, acao, usuario, dados_antes (JSONB), dados_depois (JSONB), created_at
```

### 4.3 View principal

```sql
-- v_oportunidades
-- Desnormaliza produto, status, parceiro, admin aprovador/rejeitador
-- Inclui tarefas_total e tarefas_pendentes como subqueries
-- Filtra deleted_at IS NULL
```

**O frontend carrega oportunidades SEMPRE via `v_oportunidades`**, nunca direto da tabela.

### 4.4 RPC Functions (chamadas pelo frontend via `sb.rpc()`)

```
fn_login_admin(p_login, p_senha)       → retorna admin sem senha
fn_login_parceiro(p_login, p_senha)    → retorna parceiro sem senha
fn_set_senha_parceiro(p_id, p_senha)   → hash bcrypt no banco
fn_set_senha_admin(p_id, p_senha)      → hash bcrypt no banco
fn_delete_oportunidade(p_id, p_usuario)→ soft delete + audit_log
```

### 4.5 RLS

Todas as tabelas com `allow_all` via anon key.
Segurança de “parceiro vê só as suas” é feita no JS com `.eq('parceiro_id', cu.pid)`.

-----

## 5. Estado global da aplicação (APP object em config.js)

```javascript
const APP = {
  statusList : [],   // array de status_funil
  partners   : [],   // array de parceiros (sem senha)
  products   : [],   // array de produtos
  opps       : [],   // array de oportunidades (da v_oportunidades + tarefas injetadas)
  cu         : null, // current user: { role: 'admin'|'partner', pid, name, ini, site }
  visCols    : null, // array de keys de colunas visíveis (salvo no banco)
  editId     : null, // ID da oportunidade sendo editada (null = nova)
  editTasks  : [],   // tarefas em edição no modal
  tSort      : { col: 'empresa', dir: 'asc' },
};
```

-----

## 6. Convenções de código

### Nomeação de funções

- `render*()` — desenha HTML no DOM (dashboard, table, kanban, reports)
- `build*()` — monta estrutura reutilizável (filtros, col picker)
- `open*()` / `close*()` — abre/fecha modais
- `save*()` / `delete*()` — operações async no banco
- `_fn()` — funções privadas do módulo (não chamadas de fora)

### DOM helpers (ui.js)

```javascript
g(id)    // document.getElementById
qs(sel)  // document.querySelector
qsa(sel) // document.querySelectorAll
esc(str) // sanitização XSS básica (escapa &, <, >, ")
```

### Formatadores (ui.js)

```javascript
fmtMonth(val)       // "2025-06-01" ou "2025-06" → "Jun/25"
monthToDate(ym)     // "2025-06" → "2025-06-01" (para salvar no banco)
dateToMonth(d)      // "2025-06-01" → "2025-06" (para input[type=month])
fmtDate(d)          // "2025-06-01" → "01/06/2025"
fmtDateTime(d)      // ISO → "01/06/2025 14:30"
logoImg(site, alt)  // retorna <img> com favicon via Google S2 ou ''
```

### Tratamento de erros

```javascript
// Padrão em toda operação async:
loadingShow(true);
try {
  await DB.algumMetodo();
  toast('✅ Mensagem de sucesso');
} catch (e) {
  toast('Erro: ' + e.message, 'bad');
  console.error(e);
} finally {
  loadingShow(false);
}
```

-----

## 7. Design system (CSS variables em app.css)

```css
--bg: #f6f7fb            /* fundo geral */
--surface: #ffffff       /* cards, modais */
--surface2: #f0f1fa      /* inputs, rows alternadas */
--surface3: #e8eaf5      /* hover states */
--border: #e2e4f0
--border2: #d0d3e8

--sidebar-bg: #10112a    /* sidebar navy escuro */
--primary: #7c3aed       /* roxo CULTSEC */
--primary-light: #ede9fe
--accent: #c026d3        /* magenta CULTSEC */
--gradient: linear-gradient(135deg, #c026d3 0%, #7c3aed 60%, #0ea5e9 100%)

--text: #1e1e3a          /* texto principal */
--text2: #4a4a7a
--text3: #8888b0
--text4: #b0b0d0

--green: #059669  --green-bg: #ecfdf5
--yellow: #d97706 --yellow-bg: #fffbeb
--red: #dc2626    --red-bg: #fef2f2
--blue: #1d4ed8   --blue-bg: #eff6ff
--purple: #6d28d9 --purple-bg: #f5f3ff
```

**Tipografia:**

- Títulos: `Rajdhani` (700) — importado do Google Fonts
- Corpo: `Plus Jakarta Sans` (400/500/600)

-----

## 8. Credenciais de conexão Supabase

```javascript
// js/config.js
const SUPABASE_URL  = 'https://sdulnmjzjsmuciktpqfz.supabase.co';
const SUPABASE_ANON = 'sb_publishable_HH_neH5TnIUPeCRrn_8K1w_UmB9aVtR';
```

-----

## 9. Funcionalidades implementadas

- [x] Login/logout com sessão em localStorage (`cp_session_v2`)
- [x] Dois roles: `admin` e `partner`
- [x] Sidebar recolhível com tooltips no modo colapsado
- [x] User menu estilo Gmail (topbar direita)
- [x] Dashboard: 4 stat cards, donut, bar por parceiro, line chart por fechamento
- [x] Drill-down em todos os elementos clicáveis (abre modal com tabela filtrada)
- [x] Tabela de oportunidades com: ordenação por coluna, filtros, seleção de colunas (persistida no banco), sticky na coluna Empresa, linhas alternadas, duplo-clique para editar
- [x] Exportação CSV com todos os campos (baseada no filtro ativo)
- [x] Kanban drag & drop com atualização otimista + rollback em erro
- [x] Relatórios: por produto, conversão por parceiro, tiles por status — todos com drill-down
- [x] Modal de oportunidade: novo + editar, com detecção de duplicata em tempo real
- [x] Campo `site_empresa` → logo automático via Google S2
- [x] Fluxo de aprovação: Pendente → Aprovado | Rejeitado (com motivo obrigatório)
- [x] Admin pode reverter Rejeitado → Aprovado
- [x] Tarefas por oportunidade: criar, concluir, excluir — alerta se aprovada há +60 dias sem tarefa
- [x] Admin CRUD: Status do funil, Parceiros (com edição), Produtos/Serviços
- [x] Soft delete em oportunidades via `fn_delete_oportunidade` (registra no audit_log)
- [x] Logo automático do parceiro via site cadastrado

-----

## 10. Funcionalidades pendentes / backlog sugerido

- [ ] Tela de “Alterar minha senha” para admin e parceiros
- [ ] Paginação na tabela de oportunidades (Supabase `.range()`)
- [ ] Notificações por email (Supabase Edge Functions + Resend/SendGrid) para:
  - Nova oportunidade aguardando aprovação
  - Oportunidade aprovada/rejeitada (notifica parceiro)
  - Alerta de +60 dias sem tarefa
- [ ] Realtime: atualizar dashboard automaticamente via `supabase.channel()`
- [ ] Relatório de PDF exportável
- [ ] Histórico de movimentações da oportunidade (timeline)
- [ ] Filtro de data no dashboard (período customizável)
- [ ] Múltiplos admins com níveis de permissão
- [ ] Dashboard específico do parceiro (só suas métricas)
- [ ] Campo de valor estimado da oportunidade (para pipeline financeiro)

-----

## 11. Arquivos SQL gerados

|Arquivo                     |Descrição                                                                 |
|----------------------------|--------------------------------------------------------------------------|
|`cultpartners_schema_v2.sql`|Schema completo: DROP → CREATE → RLS → Triggers → Functions → Seed inicial|
|`cultpartners_seed.sql`     |10 parceiros + 50 oportunidades variadas + tarefas de demo                |

-----

## 12. Como continuar no Claude Code

### Iniciar uma sessão

```bash
# Na pasta do projeto
cd cultpartners
claude
```

### Prompts de contexto recomendados para abrir a sessão

```
Leia o arquivo CONTEXT.md — ele contém o contexto completo do projeto CultPartners.
É um portal de gestão de oportunidades comerciais para parceiros da CULTSEC,
usando HTML/CSS/JS puro no frontend e Supabase (PostgreSQL) no backend.
Após ler, confirme que entendeu a estrutura de arquivos e o estado atual do projeto.
```

### Dicas de uso no Claude Code

- Use `@arquivo.js` para referenciar um arquivo específico na conversa
- Use `/add` para adicionar arquivos ao contexto ativo
- O Claude Code lê os arquivos do disco em tempo real — mantenha os arquivos salvos
- Para mudanças grandes, peça para o Claude Code editar um arquivo por vez
- Sempre que mudar `data.js`, verifique se os métodos do `DB object` batem com as chamadas nos outros módulos

-----

## 13. Decisões técnicas importantes (não reverter sem motivo)

1. **Senhas nunca trafegam como hash** — o plaintext vai para o banco e o PostgreSQL faz o `crypt()` via RPC. Isso garante que mesmo com MITM o hash nunca fica exposto no JS.
1. **`v_oportunidades` é a fonte de verdade do frontend** — nunca fazer SELECT direto na tabela `oportunidades` no frontend. A view já desnormaliza produto/status/parceiro/admin.
1. **Tarefas: diff inteligente em `DB.saveTasks()`** — não usar delete-all + reinsert. O método faz upsert das existentes (id numérico = do banco) e insert das novas (id string = temporário).
1. **Soft delete obrigatório** — nunca deletar oportunidades ou parceiros diretamente. Usar `fn_delete_oportunidade()` (registra no audit_log) e `DB.softDeletePartner()`.
1. **`esc()` em todo conteúdo do usuário** — qualquer dado que venha do banco e seja renderizado via innerHTML deve passar por `esc()` para evitar XSS.
1. **`fechamento` é sempre `DATE`** — salvar sempre como `YYYY-MM-01` (usar `monthToDate()`). Nunca salvar como string `"YYYY-MM"`.
1. **Estado global no objeto `APP`** — não criar variáveis globais soltas. Tudo vive em `APP.*`. O único estado que pode ficar local é dentro de closures de funções específicas (ex: `_rejId` em ops.js).