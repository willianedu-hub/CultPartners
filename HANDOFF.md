# HANDOFF — CultPartners

> Documento de transferência para outra instância do Claude Code continuar o
> desenvolvimento **sem perda de contexto**. Leia isto **depois** do `CLAUDE.md`
> (que descreve arquitetura, convenções e o schema). Aqui está o "estado vivo":
> o que foi feito recentemente, decisões, credenciais, pendências e como operar.

---

## 0. TL;DR (estado atual)

- App: portal SPA (HTML/CSS/JS puro, **sem build**) para gestão de oportunidades comerciais da **CULTSEC**. Frontend em `index.html` + `js/*` + `css/app.css`.
- **Banco:** foi **consolidado** para um novo projeto Supabase; todas as tabelas do CultPartners vivem no schema dedicado **`cultpartners`** (não em `public`). O app já aponta para lá (cutover feito — commit `945daca`).
- **Branch de trabalho: `main`.** Desenvolvimento é feito **direto no `main`**, com **commit + push a cada mudança, sem pedir confirmação** (instrução explícita do usuário nesta sessão).
- Tudo está commitado e no remoto (`willianedu-hub/cultpartners`, branch `main`). O repositório é a fonte da verdade — nenhum estado de sessão precisa ser exportado além deste doc.

---

## 1. Modo de operação (IMPORTANTE)

O usuário definiu explicitamente, nesta sessão:

1. **Trabalhar direto no `main`** (não em branch de feature). O branch antigo `claude/cd-cultpartners-lWyXn` foi 100% mergeado no `main` e aposentado.
2. **Commitar em produção sempre, sem perguntar.** Não pedir permissão antes de commit/push. Fazer, e depois relatar o que foi feito.
3. Continuar sendo transparente no relato (o que mudou, resultado real dos testes), mas sem travar esperando "pode?".

> ⚠️ `main` provavelmente é o branch de produção (deploy Netlify/Vercel). Cada push pode publicar. O usuário aceitou esse modelo — mas mantenha bom senso em mudanças que "viram a chave" (ex.: trocar banco), relatando claramente.

---

## 2. Linha do tempo — o que foi construído nas sessões recentes

Em ordem, tudo já no `main`:

1. **Correção de vazamento de dados entre parceiros** — gráficos de dashboard/relatórios que um parceiro via de outros parceiros foram tornados *role-aware* (`APP.cu.role`): admin vê por parceiro, parceiro vê por produto (só os seus). Dropdown de filtro de parceiro esvaziado para parceiros. Ver `dashboard.js` `_renderBarPartner`, `reports.js` `_renderConversionBar`/`_renderValorBar`, `table.js` `buildFilters`.
2. **Logo** — mantido Google S2 Favicons (`logoUrl` em `ui.js`). Clearbit foi testado e revertido (API descontinuada pós-HubSpot).
3. **Menu multi-produto por oportunidade** — relação N:N `oportunidade_produtos`; seletor agrupado por categoria, colapsável, multi-seleção no modal (`ops.js`: `_buildProdPicker`, `toggleProdCat`, `_getSelectedProdIds`, `_setSelectedProdIds`). Salvo via `DB.saveOppProducts(oppId, ids)`. Exibição como tags compactas com overflow `+N` via `prodTagsHtml` (`ui.js`) em tabela/kanban/dashboard/reports. Catálogo de **35 produtos em 5 categorias** (migration `multi_produto.sql`).
4. **Campo Valor Estimado** (`valor_estimado NUMERIC(14,2)`) — input com máscara BRL no modal (`maskBRL`/`parseBRL`), coluna "Valor Est." na tabela + CSV, valor no card do kanban, **3 cards financeiros** no dashboard (Valor Pipeline / Valor Ganhos / Ticket Médio) e **4 nos relatórios** (Total Prospectado / Ganhos / Perdidos / Conversão por Valor) + barra "Valor por Parceiro/Produto". Formatters `fmtBRL`/`fmtBRLShort` (`ui.js`).
5. **Correções pontuais** — tags de produto que cortavam nos cards; labels dos gráficos de barra alargados/com quebra; INP alto no `confirmDialog` (deferido com `setTimeout(0)`); `saveOp` não bloqueia mais edição quando o picker de produto está vazio (opps legadas).
6. **Consolidação do banco** (a maior mudança) — ver seção 4.

---

## 3. Identidade dos projetos Supabase

| Papel | Project ref | URL | Observações |
|-------|-------------|-----|-------------|
| **Origem** (CultPartners standalone, **antigo**) | `kjzpjuxekzhjoyernxuv` | `https://kjzpjuxekzhjoyernxuv.supabase.co` | **Mantido intacto** como rollback. Não é mais usado pelo app. |
| **Destino** (banco consolidado, **atual**) | `xqrudhwtdwzmgwstcyoh` | `https://xqrudhwtdwzmgwstcyoh.supabase.co` | Onde o app aponta hoje. Tabelas do CultPartners no schema **`cultpartners`**. Contém também o `public` de outro app (não mexer). |
| Takoda (white-label) | (próprio) | — | Branch `cliente-takoda`, **fora de escopo**, banco separado. Não tocar. |

**Anon key do destino (pública, já em `js/config.js`):** `sb_publishable_4aHiAf6rjVHQDB9gNZgX4g_AMby6KQj`

> As anon/publishable keys são públicas por design (vão no cliente). **Nunca** coloque no repo: connection string do Postgres, service_role key, ou Personal Access Token — esses ficam com o usuário.

---

## 4. Consolidação do banco (detalhe completo)

### Objetivo e decisão
O usuário quis **unificar num só banco**: os dados do **CultPartners** (origem) foram **para o projeto de destino** (`xqrudhwtdwzmgwstcyoh`), que passou a ser a casa unificada — **sem misturar tabelas**. Solução: colocar tudo do CultPartners no schema dedicado **`cultpartners`**, separado do `public` do outro app. Como agora tudo vive no mesmo Postgres, o acesso **bidirecional** é consulta nativa entre schemas — **sem Foreign Data Wrapper**.

### O que foi executado (nesta ordem, no SQL Editor do DESTINO)
1. **`migrations/consolidacao_01_schema.sql`** — cria schema `cultpartners`, garante extensões `pgcrypto` e `pg_trgm` (schema `extensions`), o ENUM `aprovacao_status`, as **9 tabelas** (ids `GENERATED ALWAYS AS IDENTITY`), PK/UNIQUE/FK, 12 índices (inclui GIN trigram em `empresa`), a view `v_oportunidades`, as **7 funções** (reescritas `public.`→`cultpartners.` + `SET search_path = cultpartners, extensions, public`), 8 triggers, RLS + políticas `allow_all`, grants para `anon`/`authenticated`/`service_role`, e `NOTIFY pgrst`. ✅ rodado com sucesso.
2. **`migrations/consolidacao_02_dados.sql`** — **179 linhas** migradas com `OVERRIDING SYSTEM VALUE` (necessário por causa de IDENTITY), ordem FK-safe, cast `::jsonb`, `TRUNCATE … RESTART IDENTITY` no topo (rerunnable) e reset de sequences no fim. ✅ rodado; contagem conferida.
3. **Passo de painel (não-SQL):** Settings → API → **Exposed schemas** += `cultpartners` e **Extra search path** += `cultpartners`. ✅ feito pelo usuário. Sem isso o PostgREST/supabase-js dá 404.
4. **Cutover** — `js/config.js` passou a apontar para o destino + `{ db: { schema: 'cultpartners' } }`. Commit `945daca`. ✅

### Contagem verificada pós-migração (esperado)
admins **1**, parceiros **11**, produtos **42**, oportunidades **58** (view mostra **57**, esconde 1 soft-deletada), tarefas **25**, oportunidade_produtos **34**, preferencias_usuario **1**, audit_log **1**.

### Config atual (`js/config.js`)
```js
const SUPABASE_URL  = 'https://xqrudhwtdwzmgwstcyoh.supabase.co';
const SUPABASE_ANON = 'sb_publishable_4aHiAf6rjVHQDB9gNZgX4g_AMby6KQj';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  db: { schema: 'cultpartners' }
});
```
Como `data.js` usa nomes crus, o `db.schema` global faz `.from()` **e** `.rpc()` mirarem `cultpartners` sem outras mudanças.

### Rollback
Reverter o commit `945daca` (`git revert 945daca` no `main`) e redeploy → volta ao banco de origem `kjzpjuxekzhjoyernxuv`, que segue **intacto**.

### Status de verificação / pendências da consolidação
- Testar em produção: **login admin** (`admin`), **login parceiro** (`movti`), abrir Oportunidades/Pipeline (view), criar oportunidade nova (sequence), trocar senha (`gen_salt`). *(Se ainda não confirmado pelo usuário, confirmar antes de considerar 100%.)*
- **Acesso bidirecional (opcional, pedido do usuário):** o outro app já lê `cultpartners` (grants aplicados). Se o CultPartners precisar **mostrar** dados do outro schema, criar uma **view dentro de `cultpartners`** que faz `SELECT` do outro schema (schema-qualificado) e conceder SELECT — mantém a convenção de nomes crus do `data.js`. Ainda **não** implementado.

---

## 5. Como fazer trabalho de banco (fluxo obrigatório neste ambiente)

**Este ambiente de agente bloqueia acesso ao Supabase** (Postgres 5432 e `*.supabase.co`/`api.supabase.com` por política de egress — 403 no proxy). Logo: **não** dá para rodar `psql`/`pg_dump`/Management API a partir do Claude. O ambiente corporativo pode ser igual ou liberar — teste antes; se bloquear, use este fluxo, que funcionou:

1. **Extrair dados/estrutura:** o Claude gera uma query; o **usuário roda no SQL Editor** (navegador) e cola o resultado.
   - DDL: query de introspecção com `pg_get_functiondef`/`pg_get_viewdef`/`pg_get_triggerdef` + reconstrução de tabelas (ver histórico das migrations `consolidacao_01`).
   - Dados: `SELECT json_build_object('tabela', (SELECT json_agg(t) FROM public.tabela t), …)` → cola o JSON → o Claude gera INSERTs com um script Python local (padrão: `OVERRIDING SYSTEM VALUE`, ordem FK-safe, cast jsonb, reset de sequences).
2. **Aplicar:** o Claude gera o `.sql`; o **usuário cola no SQL Editor** do projeto certo.
3. **DDL/alterações de schema** sempre no schema `cultpartners`. Lembre: view `SELECT *` não pega coluna nova (recriar); `CREATE OR REPLACE VIEW` falha se muda ordem de colunas (usar `DROP` + `CREATE`).

---

## 6. Credenciais & segredos

- ✅ **No repo e suficiente:** URL + anon key do destino (em `js/config.js`). São públicas.
- ❌ **Nunca no repo / nunca migrar entre ambientes:** connection strings do Postgres (origem e destino), service_role key, Personal Access Token. Ficam **com o usuário**. Operações privilegiadas = usuário no SQL Editor / painel.
- Os `senha_hash` são **bcrypt** (via `pgcrypto`), one-way. Não é possível recuperar senha em texto; para dar acesso, **resetar**:
  - Admin: `SELECT cultpartners.fn_set_senha_admin(1, 'NovaSenha@2025!');`
  - Parceiro (ex.: movti id 11): `SELECT cultpartners.fn_set_senha_parceiro(11, 'Movti@2025!');`
- Logins conhecidos: admin = `admin`; parceiros padrão usam `Parceiro@2025!` (exceto `movti`, que tem senha própria não registrada → resetar se precisar).

---

## 7. Limpeza de segurança PENDENTE (ação do usuário)

Segredos passaram pelo chat nesta sessão; recomendar/retomar:
1. **Revogar o Personal Access Token** do Supabase (Account → Access Tokens).
2. **Trocar as senhas do Postgres** dos dois projetos (origem e destino).
3. Opcional: trocar a senha do admin do portal.

---

## 8. Backlog / próximos passos

- [ ] View de acesso **bidirecional** (CultPartners lendo o schema do outro app) — ver seção 4.
- [ ] Notificações por e-mail (Edge Functions + Resend/SendGrid): nova oportunidade pendente, aprovação/rejeição, alerta de 60 dias.
- [ ] Dashboard realtime via `supabase.channel()`.
- [ ] Relatório PDF exportável.
- [ ] Timeline/histórico de movimentação da oportunidade.
- [ ] Filtro por intervalo de datas no dashboard.
- [ ] Níveis/permissões múltiplos de admin.
- ✅ Já feitos: valor estimado, multi-produto, dashboard/gráficos por parceiro.

---

## 9. Mapa de arquivos

- `index.html` — markup + carrega supabase-js do CDN e os `js/*` **nesta ordem**: `config → ui → data → auth → nav → dashboard → table → kanban → reports → ops → admin → boot()`.
- `js/config.js` — `APP` (estado global), credenciais Supabase, `db.schema='cultpartners'`, `ALL_COLS`, `CHART_FILLS`.
- `js/data.js` — **único** módulo que fala com o banco (`DB.*`). `loadOpps` enriquece com `produtos_ids`/`produtos_nomes`/`valor_estimado`.
- `js/ui.js` — helpers DOM, formatters (datas + **BRL** + `prodTagsHtml`), toast, modais, `logoUrl`.
- `js/ops.js` — modal de oportunidade, picker multi-produto, aprovação, tarefas.
- `js/dashboard.js` / `reports.js` / `table.js` / `kanban.js` / `admin.js` / `nav.js` / `auth.js` — ver `CLAUDE.md`.
- `css/app.css` — design system (roxo/magenta CULTSEC).
- `migrations/` — `consolidacao_01_schema.sql`, `consolidacao_02_dados.sql`, `multi_produto.sql`, `valor_estimado.sql`, `seed_movti_opps.sql`.
- `CLAUDE.md` — arquitetura, convenções, schema, regras críticas, gotchas.
- `CONTEXT.md` / `contexto-anterior.md` — snapshots antigos (podem conter URL/anon key **desatualizados** — ignore; a verdade é `js/config.js`).

---

## 10. Gotchas (ler antes de mexer)

- **Senhas nunca são hasheadas em JS** — texto puro vai ao banco; PostgreSQL faz `crypt()` via RPC (`fn_login_*`, `fn_set_senha_*`).
- **Sempre ler oportunidades via `v_oportunidades`**, nunca da tabela crua.
- **Soft delete only** — `fn_delete_oportunidade()` (grava em `audit_log`) e `DB.softDeletePartner()`.
- **`esc()`** em todo conteúdo de usuário renderizado via `innerHTML`.
- **`fechamento` é DATE** — salvar `YYYY-MM-01` com `monthToDate()`.
- **Sem globais soltos** — estado só em `APP.*`.
- **View `SELECT *` não pega coluna nova**; recriar. `CREATE OR REPLACE VIEW` falha se muda ordem → `DROP` + `CREATE`.
- **IDENTITY** exige `OVERRIDING SYSTEM VALUE` para inserir ids explícitos.
- **Funções SECURITY DEFINER** precisam de `SET search_path = cultpartners, extensions, public` (senão `crypt`/`gen_salt` do pgcrypto não resolvem).
- **SQL single quotes:** escapar com `''` (dois apóstrofos), nunca `\'`.
- **Ambiente de agente pode bloquear Supabase** — DB via SQL Editor do usuário (seção 5).

---

## 11. Verificação end-to-end do app (roteiro)

1. Login admin (`admin`) → exercita `fn_login_admin` + pgcrypto no schema novo.
2. Login parceiro (`movti`) → confirma isolamento por parceiro.
3. Oportunidades / Pipeline → view + joins (57 visíveis).
4. Criar oportunidade nova → sequence resetada (sem colisão de id) + escrita anon.
5. Trocar senha (menu do usuário) → `gen_salt`/escrita.
6. Cross-schema (SQL Editor destino): `SELECT count(*) FROM cultpartners.oportunidades;` e um join `cultpartners.*` × `public.<tabela_do_outro_app>` para provar acesso bidirecional nativo.
