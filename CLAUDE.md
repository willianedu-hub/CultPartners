# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CultPartners** is a single-page web portal for managing commercial opportunities for partners/resellers of CULTSEC (Brazilian cybersecurity company). Partners register deals, admins approve/reject them, and approved deals flow through a kanban pipeline with tasks.

- **Frontend:** Plain HTML + CSS + JS (no framework, no build step)
- **Backend/DB:** Supabase (PostgreSQL) with custom auth (no Supabase Auth)
- **Hosting:** Netlify (drag-and-drop deploy)

## Architecture

### Data flow
All Supabase calls are centralized in `js/data.js` via the `DB` object — no other file calls `sb.from()` directly. The frontend always reads opportunities through the `v_oportunidades` view (never the raw `oportunidades` table). The view denormalizes produto, status, parceiro, and admin approver/rejecter.

### Global state
Everything lives in the `APP` object defined in `js/config.js`:
```javascript
APP.cu          // current user: { role: 'admin'|'partner', pid, name, ini, site }
APP.opps        // loaded opportunities (from v_oportunidades)
APP.statusList / APP.partners / APP.products  // reference data
APP.visCols     // visible table columns (persisted to DB)
APP.editId      // ID of opportunity being edited (null = new)
APP.editTasks   // tasks being edited in modal
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
| `ops.js` | Opportunity modal, approval flow, tasks CRUD |
| `admin.js` | Admin CRUD for status/partners/products |

## Key Conventions

### Function naming
- `render*()` — writes HTML to DOM
- `build*()` — builds reusable structures (filters, col picker)
- `open*()`/`close*()` — modal control
- `save*()`/`delete*()` — async DB operations
- `_fn()` — module-private (not called externally)

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

## Critical Rules (Do Not Revert)

1. **Passwords are never hashed in JS** — plaintext goes to the DB; PostgreSQL calls `crypt()` via RPC functions (`fn_login_admin`, `fn_login_parceiro`, `fn_set_senha_*`).
2. **Always read opportunities via `v_oportunidades`** — never `SELECT` directly from the `oportunidades` table.
3. **`DB.saveTasks()` uses a smart diff** — upsert existing tasks (numeric id = from DB), insert new ones (string id = temporary). Never delete-all + reinsert.
4. **Soft delete only** — use `fn_delete_oportunidade()` (logs to `audit_log`) and `DB.softDeletePartner()`. Never hard delete.
5. **Always wrap user content with `esc()`** — any DB data rendered via `innerHTML` must pass through `esc()`.
6. **`fechamento` is always a `DATE`** — save as `YYYY-MM-01` using `monthToDate()`. Never save as `"YYYY-MM"` string.
7. **No loose globals** — all state goes in `APP.*`.

## Database Notes

- Auth: two roles via separate tables (`admins`, `parceiros`), login via RPC
- Partner data isolation: enforced in JS with `.eq('parceiro_id', cu.pid)` — RLS is `allow_all`
- `fechamento` field: always first day of month (`YYYY-MM-01`)
- `audit_log` table tracks all soft deletes and sensitive operations

## Deployment

No build step. Deploy by uploading the folder contents to Netlify. The `_redirects` file handles SPA routing (`/* /index.html 200`).
