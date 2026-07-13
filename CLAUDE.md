# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CultPartners** is a single-page web portal for managing commercial opportunities for partners/resellers of CULTSEC (Brazilian cybersecurity company). Partners register deals, admins approve/reject them, and approved deals flow through a kanban pipeline with tasks.

- **Frontend:** Plain HTML + CSS + JS (no framework, no build step)
- **Backend/DB:** Supabase (PostgreSQL) with custom auth (no Supabase Auth)
- **Hosting:** Netlify (drag-and-drop deploy)
- **Passwords:** bcrypt via PostgreSQL `pgcrypto` — `crypt(senha, gen_salt('bf', 12))`
- **Logos:** Google S2 Favicons API — `https://www.google.com/s2/favicons?sz=32&domain=`

> **DB consolidado (importante):** desde a consolidação, o app aponta para o projeto Supabase de destino e **todas as tabelas do CultPartners vivem no schema dedicado `cultpartners`** (não em `public`). O cliente é criado com `supabase.createClient(url, key, { db: { schema: 'cultpartners' } })` em `js/config.js`, então `.from()` e `.rpc()` miram esse schema automaticamente — o `data.js` usa nomes "crus", sem qualificar schema. Ver a seção **Database Consolidation** e a pasta `migrations/`.

## Architecture

### Data flow
All Supabase calls are centralized in `js/data.js` via the `DB` object — no other file calls `sb.from()` directly. The frontend always reads opportunities through the `v_oportunidades` view (never the raw `oportunidades` table). The view denormalizes produto, status, parceiro, and admin approver/rejecter, and includes `tarefas_total` / `tarefas_pendentes` as subqueries.

**`DB.loadOpps()` enriches each opportunity** beyond the view: it fetches the `oportunidade_produtos` junction (N:N) and `oportunidades.valor_estimado` directly from the base table in parallel, then injects `produtos_ids` (array), `produtos_nomes` (comma-joined string) and `valor_estimado` into each row. Reason `valor_estimado` is read from the base table: a PostgreSQL view with `SELECT *` does **not** auto-pick up new columns — the view was recreated to include it, but the direct fetch also guards against a stale view. Multiple products per opportunity are the norm now; `produto_id` on `oportunidades` is kept only as a legacy/first-product fallback.

### Global state
Everything lives in the `APP` object defined in `js/config.js`:
```javascript
APP.cu          // current user: { role: 'admin'|'partner', pid, name, ini, site, login }
APP.opps        // loaded opportunities (from v_oportunidades)
APP.statusList / APP.partners / APP.products  // reference data
APP.visCols     // visible table columns (persisted to DB)
APP.editId      // ID of opportunity being edited (null = new)
APP.editTasks   // tasks being edited in modal
APP.tSort       // { col: 'empresa', dir: 'asc' }
APP.tPage       // current page index (0-based) for opportunities table
APP.tPageSize   // rows per page (default 30)
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
fmtBRL(v)           // 85000 → "R$ 85.000,00"
fmtBRLShort(v)      // 85000 → "R$ 85K" · 1200000 → "R$ 1,2M"  (compact, for cards/kanban)
maskBRL(el)         // input mask: types digits → "1.234,56"
parseBRL(str)       // "1.234,56" → 1234.56 (null if empty/zero) — use when saving valor_estimado
prodTagsHtml(nomes, max=2) // comma-joined product names → compact tags + "+N" overflow badge
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
- `produtos` — `id, nome (UNIQUE), categoria, descricao, ativo, ordem (SMALLINT)` — 35-product catalog in 5 categories; `ordem` groups the multi-level picker
- `oportunidades` — `id, empresa, cnpj, site_empresa, contato, cargo, obs, produto_id, status_id, fechamento (DATE), parceiro_id, aprovacao (ENUM: Pendente|Aprovado|Rejeitado), approved_by, rejected_by, deleted_at, valor_estimado (NUMERIC(14,2))`
- `oportunidade_produtos` — N:N junction: `oportunidade_id (CASCADE DELETE), produto_id`, PK on both. One opportunity → many products.
- `tarefas` — `id, oportunidade_id (CASCADE DELETE), descricao, prazo, responsavel, concluida, concluida_em`
- `preferencias_usuario` — `user_key (PK), colunas (JSONB)`
- `audit_log` — `id, tabela, registro_id, acao, usuario, dados_antes (JSONB), dados_depois (JSONB)`

**`aprovacao_status`** is a custom ENUM (`Pendente|Aprovado|Rejeitado`). The `empresa` GIN trigram index needs `pg_trgm`; passwords need `pgcrypto` — both installed in the `extensions` schema. All the above tables live in the **`cultpartners`** schema.

### RPC Functions (called via `sb.rpc()`)
```
fn_login_admin(p_login, p_senha)        → admin row without senha_hash
fn_login_parceiro(p_login, p_senha)     → parceiro row without senha_hash
fn_set_senha_parceiro(p_id, p_senha)    → bcrypt hash in DB
fn_set_senha_admin(p_id, p_senha)       → bcrypt hash in DB
fn_delete_oportunidade(p_id, p_usuario) → soft delete + audit_log entry
```

### RLS
All tables use `allow_all` via anon key (in `cultpartners`, RLS is enabled with `allow_all` policies re-created for the schema). Partner data isolation is enforced in JS with `.eq('parceiro_id', cu.pid)` / by loading opps filtered by `parceiro_id` — **not** by row-level policies. The RPC functions are `SECURITY DEFINER` with `SET search_path = cultpartners, extensions, public` so `crypt()`/`gen_salt()` resolve.

## Database Consolidation (schema `cultpartners`)

The CultPartners database was **consolidated into another Supabase project** (the app now points there via `js/config.js`). To avoid mixing tables, all CultPartners objects live in a dedicated **`cultpartners`** schema; the other app keeps its own `public`. Because both share one Postgres, cross-app reads are native cross-schema SQL (no Foreign Data Wrapper).

The migration lives in `migrations/`, run in order in the **destination** project's SQL Editor:
1. `consolidacao_01_schema.sql` — schema, ENUM, extensions, 9 tables, view, 7 functions, triggers, RLS, grants (`anon`/`authenticated`/`service_role`), `NOTIFY pgrst`.
2. `consolidacao_02_dados.sql` — data (179 rows) with `OVERRIDING SYSTEM VALUE` (ids are `GENERATED ALWAYS AS IDENTITY`), FK-safe order, sequence resets, `TRUNCATE … RESTART IDENTITY` at top (rerunnable).
3. **Dashboard step (not SQL):** Settings → API → add `cultpartners` to *Exposed schemas* and *Extra search path*, then reload — required for PostgREST/supabase-js to see the schema.

Other migrations: `multi_produto.sql` (junction + 35-product catalog), `valor_estimado.sql` (column + view recreate), `seed_movti_opps.sql` (sample opps for partner Movti, id 11).

**Gotchas that bit us:** (a) a `SELECT *` view does not auto-add new base columns — recreate it; (b) `CREATE OR REPLACE VIEW` fails if column order changes — use `DROP VIEW` + `CREATE`; (c) identity columns need `OVERRIDING SYSTEM VALUE` on data load; (d) SECURITY DEFINER functions must pin `search_path` to find pgcrypto in `extensions`.

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

- Login/logout with session in localStorage (`cp_session_v2`), two roles: `admin` and `partner`; `APP.cu` includes `login` field
- Collapsible sidebar with tooltips in collapsed mode; Gmail-style user menu in topbar
- Dashboard: 4 stat cards, donut chart, bar by partner, line chart by fechamento — all with drill-down
- Dashboard drill-down modals have inline approve/reject actions for admins (pending rows get ✅/❌; rejected get ↩ Reverter)
- Dashboard 60-day alert: styled table at bottom of dashboard (color-coded: >60d yellow, >90d orange, >120d red); "Ganho" opportunities excluded
- Opportunities table: column sort, filters, column picker (persisted to DB), CSV export, double-click to edit
- **Table pagination**: `buildPagerHTML(total, page, ps, goFn, sizeFn)` in `table.js`; default 30 rows, options 10/30/50/100; drill modals also paginated via closure state (`window._drillGoPage` / `window._drillSetSize`)
- Kanban drag & drop with optimistic update + rollback on error
- Reports: by produto, parceiro conversion, status tiles — all with drill-down
- Opportunity modal: new + edit, real-time duplicate detection, auto-logo from `site_empresa`
- Approval flow: Pendente → Aprovado | Rejeitado (reason required); admin can revert Rejeitado → Aprovado
- Tasks per opportunity: create, complete, delete — alert if approved 60+ days with no task
- Admin CRUD: funil status, partners (with edit), products/services
- Soft delete via `fn_delete_oportunidade()` (audit_log); soft delete for partners via `DB.softDeletePartner()`
- **Change password modal** (`mSenha`): validates current password via login RPC, enforces min 8 chars + uppercase + number + special; strength indicator in real-time
- **Audit log viewer** in Configurações: filterable by action/user, paginated, color-coded admin (purple) vs partner (blue) rows
- `DB.changePassword(role, id, nova)` and `DB.loadAuditLog()` added to `data.js`
- **Multi-product per opportunity**: grouped, collapsible, multi-select picker in the opportunity modal (`_buildProdPicker`/`toggleProdCat`/`_getSelectedProdIds` in `ops.js`); saved via `DB.saveOppProducts(oppId, ids)` into `oportunidade_produtos`. Products shown as compact tags (`prodTagsHtml`) in table/kanban/dashboard/reports; charts group by `produtos_ids`. On edit, product is optional (legacy opps whose products were deactivated still save).
- **Estimated deal value** (`valor_estimado`): masked BRL input in the modal; "Valor Est." column in the table + CSV; value on kanban cards; 3 financial stat cards on the dashboard (Valor Pipeline / Valor Ganhos / Ticket Médio) and 4 on reports (Total Prospectado / Ganhos / Perdidos / Conversão por Valor) + a "Valor por Parceiro/Produto" bar
- **Role-aware charts**: partners never see cross-partner data. `_renderBarPartner`/`_renderConversionBar`/`_renderValorBar` branch on `APP.cu.role` (admin → by partner; partner → by product). Partner filter dropdown emptied for partners in `buildFilters()`.

## Pending Backlog

- [ ] Email notifications (Supabase Edge Functions + Resend/SendGrid): new pending opportunity, approval/rejection, 60-day task alert
- [ ] Realtime dashboard updates via `supabase.channel()`
- [ ] Exportable PDF report
- [ ] Opportunity movement timeline/history
- [ ] Date range filter on dashboard
- [ ] Multiple admin levels/permissions
- [ ] Bidirectional read of the *other* app's schema from within CultPartners (recommended: a view inside `cultpartners` that selects from the other schema, to keep `data.js` bare-name convention)

Done recently (kept for reference): estimated deal value ✅, multi-product per opportunity ✅, partner-specific dashboard/charts ✅.

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | **Current working/production branch** for CultPartners (CULTSEC). Development now happens directly on `main`. |
| `claude/cd-cultpartners-lWyXn` | Former dev branch (fully merged into `main`). |
| `cliente-takoda` | Client deployment — Takoda Data Centers (orange branding, separate Supabase) |

## Client Branch: cliente-takoda

Takoda Data Centers white-label deployment. Key differences from main:
- **Colors**: `--primary: #E85D1A` (orange), `--accent: #F5A623` (gold)
- **Logo**: `assets/takoda-logo.png` (file exists in repo)
- **Title**: "TakodaPartners – Takoda Data Centers"
- **Powered by VSYNC** tagline on login screen
- **Supabase credentials** in `js/config.js` point to Takoda's own project
- **SQL setup files** (run in order on Takoda's Supabase):
  1. `takoda_part1_schema.sql` — tables + view
  2. `takoda_part2_rls_functions.sql` — RLS + RPCs + trigger
  3. `takoda_part3_seed_base.sql` — admin (`admin`/`Takoda@2025!`), status, 12 products, 10 partners (`Parceiro@2025!`)
  4. `takoda_part4_seed_opps_a.sql` — opportunities 1–75
  5. `takoda_part5_seed_opps_b.sql` — opportunities 76–155 + demo tasks
- **Deployed on Vercel** pointing to `cliente-takoda` branch (set as GitHub default branch)
- **Mobile hamburger menu**: `toggleMobileSidebar()` / `closeMobileSidebar()` in `ui.js`; overlay `#sidebarOverlay`; sidebar closes on `nav()` call

## Deployment

No build step. Deploy by uploading the folder contents to Netlify. The `_redirects` file handles SPA routing (`/* /index.html 200`). For Vercel, use `vercel.json` with rewrites to `/index.html`.

## Known Patterns / Gotchas

- **Stream timeout**: When generating large files (SQL, HTML), go directly to `Write` tool — avoid long text responses before tool calls.
- **SQL single quotes**: Use `''` (two apostrophes) to escape, never `\'` — PostgreSQL does not accept backslash escaping in standard strings.
- **Push rejected (non-fast-forward)**: Run `git pull origin <branch> --no-rebase` then `git push`.
- **Edit tool**: File must be `Read` at least once in the session before `Edit` will work.
- **No DB access from the agent environment**: some Claude Code environments block outbound to Supabase (Postgres port 5432 and `*.supabase.co`/`api.supabase.com` over HTTPS) by egress policy. When that happens you **cannot** run `psql`/`pg_dump` or the Management API from the agent — the user runs SQL in the Supabase **SQL Editor** (browser) and pastes results back. To extract data for migration: `SELECT json_build_object('table', (SELECT json_agg(t) FROM public.table t), …)` → paste JSON → generate INSERTs with a local Python script.
- **Credentials**: only the Supabase URL + anon (publishable) key belong in `js/config.js` (they ship to the browser, public by design). Never put the Postgres connection string / service_role key / Personal Access Token in the repo — those stay with the user.
