# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CultPartners** is a single-page web portal for managing commercial opportunities for partners/resellers of CULTSEC (Brazilian cybersecurity company). Partners register deals, admins approve/reject them, and approved deals flow through a kanban pipeline with tasks.

- **Frontend:** Plain HTML + CSS + JS (no framework, no build step)
- **Backend/DB:** Supabase (PostgreSQL) with custom auth (no Supabase Auth)
- **Hosting:** Netlify (drag-and-drop deploy)
- **Passwords:** bcrypt via PostgreSQL `pgcrypto` — `crypt(senha, gen_salt('bf', 12))`
- **Logos:** Google S2 Favicons API — `https://www.google.com/s2/favicons?sz=32&domain=`

## Architecture

### Data flow
All Supabase calls are centralized in `js/data.js` via the `DB` object — no other file calls `sb.from()` directly. The frontend always reads opportunities through the `v_oportunidades` view (never the raw `oportunidades` table). The view denormalizes produto, status, parceiro, and admin approver/rejecter, and includes `tarefas_total` / `tarefas_pendentes` as subqueries.

### Global state
Everything lives in the `APP` object defined in `js/config.js`:
```javascript
APP.cu          // current user: { role: 'admin'|'partner', pid, name, ini, site }
APP.opps        // loaded opportunities (from v_oportunidades)
APP.statusList / APP.partners / APP.products  // reference data
APP.visCols     // visible table columns (persisted to DB)
APP.editId      // ID of opportunity being edited (null = new)
APP.editTasks   // tasks being edited in modal
APP.tSort       // { col: 'empresa', dir: 'asc' }
```

### Script load order (must be maintained)
`config.js` → `ui.js` → `data.js` → `auth.js` → `nav.js` → `dashboard.js` → `table.js` → `kanban.js` → `reports.js` → `ops.js` → `admin.js` → `boot()`

### Module responsibilities
| File | Responsibility |
|------|---------------|
| `config.js` | `APP` state, `SUPABASE_URL`, `SUPABASE_ANON`, `ALL_COLS`, `CHART_FILLS` |
| `ui.js` | DOM helpers (`g`, `qs`, `qsa`, `esc`), formatters, `toast()`, `openM()`/`closeM()` |
| `data.js` | All Supabase calls (the `DB` object) |
| `auth.js` | `boot()`, login/logout, session management (`cp_session_v2` in localStorage) |
| `nav.js` | `nav(page)`, `VIEW_TITLES` |
| `dashboard.js` | `renderDash()`, `drill()`, chart renderers |
| `table.js` | `renderTable()`, `buildFilters()`, `sortBy()`, `exportCSV()`, `buildColPicker()` |
| `kanban.js` | `renderKanban()`, drag & drop handlers |
| `reports.js` | `renderReports()` — by produto/parceiro/status with drill-down |
| `ops.js` | Opportunity modal, approval flow, tasks CRUD |
| `admin.js` | Admin CRUD for status/partners/products |

## Key Conventions

### Function naming
- `render*()` — writes HTML to DOM
- `build*()` — builds reusable structures (filters, col picker)
- `open*()`/`close*()` — modal control
- `save*()`/`delete*()` — async DB operations
- `_fn()` — module-private (not called externally)

### DOM helpers (`ui.js`)
```javascript
g(id)    // document.getElementById
qs(sel)  // document.querySelector
qsa(sel) // document.querySelectorAll
esc(str) // XSS sanitization — escapes &, <, >, "
```

### Formatters (`ui.js`)
```javascript
fmtMonth(val)       // "2025-06-01" or "2025-06" → "Jun/25"
monthToDate(ym)     // "2025-06" → "2025-06-01"  (use when saving to DB)
dateToMonth(d)      // "2025-06-01" → "2025-06"  (use for input[type=month])
fmtDate(d)          // "2025-06-01" → "01/06/2025"
fmtDateTime(d)      // ISO → "01/06/2025 14:30"
logoImg(site, alt)  // returns <img> with Google S2 favicon or ''
```

### Async error handling pattern
```javascript
loadingShow(true);
try {
  await DB.someMethod();
  toast('✅ Success message');
} catch (e) {
  toast('Erro: ' + e.message, 'bad');
  console.error(e);
} finally {
  loadingShow(false);
}
```

## Database

### Tables
- `admins` — `id, nome, login (UNIQUE), senha_hash, email, ativo`
- `parceiros` — `id, nome, cnpj, site, login (UNIQUE), senha_hash, email, ativo, deleted_at`
- `status_funil` — `id, nome (UNIQUE), cor (hex), ordem (SMALLINT), ativo`
- `produtos` — `id, nome (UNIQUE), categoria, descricao, ativo`
- `oportunidades` — `id, empresa, cnpj, site_empresa, contato, cargo, obs, produto_id, status_id, fechamento (DATE), parceiro_id, aprovacao (ENUM: Pendente|Aprovado|Rejeitado), approved_by, rejected_by, deleted_at`
- `tarefas` — `id, oportunidade_id (CASCADE DELETE), descricao, prazo, responsavel, concluida, concluida_em`
- `preferencias_usuario` — `user_key (PK), colunas (JSONB)`
- `audit_log` — `id, tabela, registro_id, acao, usuario, dados_antes (JSONB), dados_depois (JSONB)`

### RPC Functions (called via `sb.rpc()`)
```
fn_login_admin(p_login, p_senha)        → admin row without senha_hash
fn_login_parceiro(p_login, p_senha)     → parceiro row without senha_hash
fn_set_senha_parceiro(p_id, p_senha)    → bcrypt hash in DB
fn_set_senha_admin(p_id, p_senha)       → bcrypt hash in DB
fn_delete_oportunidade(p_id, p_usuario) → soft delete + audit_log entry
```

### RLS
All tables use `allow_all` via anon key. Partner data isolation is enforced in JS with `.eq('parceiro_id', cu.pid)`.

## Design System (`css/app.css`)

```css
--sidebar-bg: #10112a   /* dark navy sidebar */
--primary: #7c3aed      /* CULTSEC purple */
--accent: #c026d3       /* CULTSEC magenta */
--gradient: linear-gradient(135deg, #c026d3 0%, #7c3aed 60%, #0ea5e9 100%)
--bg: #f6f7fb / --surface: #fff / --surface2: #f0f1fa / --surface3: #e8eaf5
--text: #1e1e3a / --text2: #4a4a7a / --text3: #8888b0
```

Typography: `Rajdhani` 700 (headings) + `Plus Jakarta Sans` 400/500/600 (body) from Google Fonts.

## Critical Rules (Do Not Revert)

1. **Passwords are never hashed in JS** — plaintext goes to the DB; PostgreSQL calls `crypt()` via RPC functions (`fn_login_admin`, `fn_login_parceiro`, `fn_set_senha_*`).
2. **Always read opportunities via `v_oportunidades`** — never `SELECT` directly from the `oportunidades` table.
3. **`DB.saveTasks()` uses a smart diff** — upsert existing tasks (numeric id = from DB), insert new ones (string id = temporary). Never delete-all + reinsert.
4. **Soft delete only** — use `fn_delete_oportunidade()` (logs to `audit_log`) and `DB.softDeletePartner()`. Never hard delete.
5. **Always wrap user content with `esc()`** — any DB data rendered via `innerHTML` must pass through `esc()`.
6. **`fechamento` is always a `DATE`** — save as `YYYY-MM-01` using `monthToDate()`. Never save as `"YYYY-MM"` string.
7. **No loose globals** — all state goes in `APP.*`.

## Implemented Features

- Login/logout with session in localStorage (`cp_session_v2`), two roles: `admin` and `partner`
- Collapsible sidebar with tooltips in collapsed mode; Gmail-style user menu in topbar
- Dashboard: 4 stat cards, donut chart, bar by partner, line chart by fechamento — all with drill-down
- Opportunities table: column sort, filters, column picker (persisted to DB), CSV export, double-click to edit
- Kanban drag & drop with optimistic update + rollback on error
- Reports: by produto, parceiro conversion, status tiles — all with drill-down
- Opportunity modal: new + edit, real-time duplicate detection, auto-logo from `site_empresa`
- Approval flow: Pendente → Aprovado | Rejeitado (reason required); admin can revert Rejeitado → Aprovado
- Tasks per opportunity: create, complete, delete — alert if approved 60+ days with no task
- Admin CRUD: funil status, partners (with edit), products/services
- Soft delete via `fn_delete_oportunidade()` (audit_log); soft delete for partners via `DB.softDeletePartner()`

## Pending Backlog

- [ ] "Change my password" screen for admin and partners (`fn_set_senha_*` RPCs already exist in DB)
- [ ] Table pagination via Supabase `.range()`
- [ ] Email notifications (Supabase Edge Functions + Resend/SendGrid): new pending opportunity, approval/rejection, 60-day task alert
- [ ] Realtime dashboard updates via `supabase.channel()`
- [ ] Exportable PDF report
- [ ] Opportunity movement timeline/history
- [ ] Date range filter on dashboard
- [ ] Partner-specific dashboard (own metrics only)
- [ ] Estimated deal value field (for financial pipeline)
- [ ] Multiple admin levels/permissions

## Deployment

No build step. Deploy by uploading the folder contents to Netlify. The `_redirects` file handles SPA routing (`/* /index.html 200`).

## SQL Files

| File | Description |
|------|-------------|
| `cultpartners_schema_v2.sql` | Full schema: DROP → CREATE → RLS → Triggers → Functions → Seed |
| `cultpartners_seed.sql` | 10 partners + 50 varied opportunities + demo tasks |
