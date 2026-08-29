# HANDOFF — CultPartners

> Documento de transferência para outra instância do Claude Code continuar o
> desenvolvimento **sem perda de contexto**. Leia isto **depois** do `CLAUDE.md`
> (que descreve arquitetura, convenções e o schema). Aqui está o "estado vivo":
> o que foi feito recentemente, decisões, credenciais, pendências e como operar.

---

## Migração para Next.js + MCP/OAuth/API (2026-08)

> **Seção nova, no topo.** Tudo abaixo desta seção é o handoff **do SPA** e continua
> válido como histórico do banco/consolidação e das regras de negócio. Leia **primeiro**
> o `CLAUDE.md` (reescrito para o novo stack) e depois esta seção.

### O que mudou (SPA → Next.js)

O CultPartners deixou de ser um SPA estático (HTML/CSS/JS puro + `@supabase/supabase-js`) e
virou um app **Next.js 16 (App Router) + React 19 + Prisma 7 + Auth.js (next-auth v5) +
Tailwind 4/shadcn**, espelhando o CRM (`crm-cultsec`). O SPA inteiro foi preservado em
**`legacy/`** como referência (não é buildado nem servido).

Além da conversão de telas, entraram **três superfícies de máquina** (as mesmas do CRM):

- **MCP** (`/api/mcp`) — servidor MCP remoto, **somente leitura**, JSON-RPC 2.0 à mão,
  tokens `cp_` (SHA-256, fail-closed), 9 ferramentas `cp_*`.
- **OAuth 2.1** (`/api/oauth/*` + os dois `.well-known`) — o **CultPartners é o
  Authorization Server**, federando o login para a **Microsoft/Entra**.
- **API REST** (`/api/v1/*`) — 9 endpoints de leitura + `openapi.json` (aberto), que
  **reaproveitam o `run()` das ferramentas MCP** (número igual ao do MCP e da tela).

Duas audiências de login convivem: **INTERNO** (admins/executivos de canal via Microsoft
Entra + senha de emergência; tabela `usuarios_internos`/model `User` + RBAC) e **PARCEIRO**
(login+senha próprio, preservado; tabela `parceiros`). Escopo sempre server-side
(`oportunidadeScopeWhere`): parceiro só o seu, executivo por `exec_parceiros`, admin tudo.

O banco continua no projeto Supabase consolidado **`xqrudhwtdwzmgwstcyoh`**, schema
**`cultpartners`**, mas o app agora fala Postgres **direto via Prisma** (`DATABASE_URL`),
não mais pelo `@supabase/supabase-js`.

### Fases entregues (F0–F8)

- **F0 — Fundação:** projeto Next.js 16 + React 19, Tailwind 4, kit shadcn (Radix, cmdk,
  lucide, sonner), Prisma 7 com adapter PrismaPg e schema multiSchema `cultpartners`.
- **F1 — Modelagem/DB:** `prisma/schema.prisma` espelhando as tabelas do SPA + as novas de
  auth/RBAC/OAuth/MCP; SQL manual `prisma/manual/2026_auth_mcp_oauth.sql` (idempotente).
- **F2 — Auth.js (duas audiências):** login Microsoft/Entra (deny-by-default por
  `usuarios_internos`) + login por senha; contrato `SessionUser`
  (audience/parceiroId/execParceiroIds/roles/permissions) montado do banco.
- **F3 — RBAC + escopo:** `rbac.ts` (gates, `oportunidadeScopeWhere`), `sessionPolicy.ts`
  (revogação/`sessionsValidFrom`), `audit.ts`.
- **F4 — Telas do portal:** dashboard, opportunities, pipeline (dnd-kit), reports, tasks,
  partners, settings/{produtos,funil,perfil} — RSC + server actions, role-aware.
- **F5 — MCP:** protocolo (`rpc.ts`/`handler.ts`), catálogo `cp_*`, `tokenAuth.ts`
  (fail-closed), envelope anti-injeção, `forbidden.test.ts`, tela `/settings/mcp`.
- **F6 — OAuth 2.1 (AS):** `.well-known/*`, `register/authorize/token/revoke`,
  `/oauth/consent`, PKCE S256, refresh com rotação, tokens opacos.
- **F7 — API REST:** `/api/v1/*` reusando o `run()` das tools, schema de saída em zod
  (`saidas.ts`), `openapi.json` aberto.
- **F8 — Documentação + go-live:** este handoff, `CLAUDE.md` reescrito, `README.md`, e o
  `prisma/manual/LEIA-ME.md`.

### Branch

Todo o trabalho está na branch **`feat/nextjs-mcp`**. A **`main` ainda serve o SPA no
Netlify** — o cutover para a Vercel acontece quando a verificação abaixo passar (e/ou no
merge da branch). Ver "Checklist de go-live".

### CHECKLIST DE GO-LIVE (ações do usuário)

Estas etapas **dependem do usuário** (segredos, painéis, deploy). O agente não tem acesso.

1. **Banco (SQL Editor do Supabase, destino `xqrudhwtdwzmgwstcyoh`, schema `cultpartners`):**
   - Rodar `prisma/manual/2026_auth_mcp_oauth.sql` (idempotente; se avisar RLS, "Run without
     RLS"; conferir as 15 linhas de verificação OK).
   - Rodar `prisma/seed-auth.sql` **preenchendo nome e e-mail do admin do Entra** (os campos
     `<< ... >>`). O e-mail tem que ser **exatamente** o e-mail corporativo do Entra do admin
     — é a chave do casamento no login federado. (Alternativa: `seed-auth.ts` via `tsx`.)
   - Conferir em Settings → API que `cultpartners` está em *Exposed schemas* / *Extra search
     path* (as tabelas novas não precisam ser expostas — o app as acessa só server-side).
2. **App Registration no Entra (Azure Portal → Microsoft Entra ID → App registrations):**
   - Novo registro dedicado ("CultPartners"), contas **só deste diretório**.
   - **Redirect URI (Web):** `https://SEU-DOMINIO/api/auth/callback/microsoft-entra-id`.
   - Permissões delegadas: **`openid`, `profile`, `email`** — só isso (sem Graph).
   - Anotar **tenant ID**, **client ID** e **client secret** (value).
   - **Issuer** tem que ser o do **tenant**, nunca `/common/`:
     `https://login.microsoftonline.com/<tenant-id>/v2.0`.
3. **Env vars na Vercel** (nunca no repo — ver `.env.example`):
   - `DATABASE_URL` — connection string do **Transaction Pooler (6543)** para produção
     serverless (o Session pooler 5432 é para migrações).
   - `AUTH_SECRET` (aleatório longo).
   - `AUTH_MICROSOFT_ENTRA_ID_ID` / `_SECRET` / `_ISSUER`.
   - `NEXT_PUBLIC_APP_URL` (trava issuer/resource do OAuth num domínio próprio).
4. **Deploy na Vercel a partir da branch `feat/nextjs-mcp`.** Cutover **Netlify → Vercel**
   só quando a verificação abaixo passar (a `main` segue servindo o SPA até o merge).
5. **Roteiro de verificação (pós-deploy):**
   - `GET /.well-known/oauth-authorization-server` e `.../oauth-protected-resource` respondem.
   - `GET /api/mcp` (sem credencial) → **401** com header **`WWW-Authenticate`**.
   - `claude mcp add cultpartners --transport http https://SEU-DOMINIO/api/mcp` → fluxo
     **OAuth (login Microsoft)** → chamar `cp_whoami` e `cp_list_opportunities`.
   - Emitir um token `cp_` em **`/settings/mcp`** e testar `/api/v1/me`, `/api/v1/opportunities`,
     `/api/v1/openapi.json`.
   - Conferir **escopo**: admin vê tudo; executivo de canal vê só os seus parceiros
     (`exec_parceiros`); parceiro só as suas oportunidades; **`senhaHash` nunca aparece** em
     nenhuma resposta.

### Backlog v2

- **Persistir o aprovador.** Hoje `approvedBy`/`rejectedBy` são `BigInt` legado (herdados do
  SPA, apontavam para a tabela `admins` antiga) e o ator real da aprovação/rejeição vai na
  **auditoria** (`auditoria`), não numa FK. Migrar essas colunas para **texto/cuid** (id de
  `usuarios_internos`) ou torná-las **FK para `usuarios_internos`**, e passar a gravar o ator
  na própria oportunidade além da trilha.
- Notificações por e-mail, dashboard realtime, relatório PDF, timeline da oportunidade,
  filtro por intervalo de datas — herdados do backlog do SPA (seção 8 abaixo).

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
