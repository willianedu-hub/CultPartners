<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from
your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing
any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CLAUDE.md

Guia para o Claude Code (claude.ai/code) trabalhar neste repositório.

## Visão geral

**CultPartners** é o portal comercial dos parceiros/revendas da **CULTSEC** (cibersegurança).
Parceiros cadastram oportunidades, administradores aprovam/rejeitam, e os negócios aprovados
correm num pipeline kanban com tarefas.

Foi **convertido de um SPA estático** (HTML/CSS/JS puro + `@supabase/supabase-js`, hoje em
`legacy/`) para um app **Next.js**, espelhando o CRM (`crm-cultsec`). Stack:

- **Next.js 16** (App Router) + **React 19**
- **Prisma 7** (adapter PrismaPg) — schema Postgres dedicado **`cultpartners`** no Supabase
- **Auth.js** (next-auth v5) — login federado Microsoft/Entra + login por senha
- **Tailwind 4** + componentes estilo **shadcn** (Radix, cmdk, lucide-react, sonner)
- **Deploy:** Vercel (o SPA antigo ainda serve pelo Netlify até o cutover — ver `HANDOFF.md`)
- **Banco:** projeto Supabase consolidado `xqrudhwtdwzmgwstcyoh`; app fala Postgres direto
  via `DATABASE_URL` (Prisma), **não** usa `@supabase/supabase-js`.

> **`legacy/`** guarda o SPA inteiro (`index.html` + `js/*` + `css/app.css` + `migrations/`)
> como **referência**, não é buildado nem servido. Regras de negócio, RPCs de senha e o
> catálogo de produtos vieram de lá.

## Banco de dados — schema `cultpartners` (Prisma multiSchema)

As tabelas e enums do app vivem no schema Postgres **`cultpartners`** (não em `public`),
declarado no `prisma/schema.prisma`:

- `datasource db { … schemas = ["cultpartners"] }` — só `cultpartners` é gerenciado pelo
  Prisma (nunca inclua `public`, senão um `db push` futuro poderia dropar objetos do outro
  app que coabita o mesmo Postgres).
- **Todo** `model` e **todo** `enum` tem `@@schema("cultpartners")`. Faltar um só → erro
  `P1012` no `prisma validate`/`generate`.

O Prisma qualifica os nomes como `"cultpartners"."Tabela"`, então funciona pelo Transaction
Pooler do Supabase (6543) **sem** depender de `search_path`. `src/lib/db.ts` (adapter
PrismaPg) não precisa de config de schema.

### Migrações

Usa `prisma db push` (não há `prisma/migrations`). Mudanças que o `db push` declarativo não
faz com segurança ficam versionadas em SQL manual, rodadas **à mão no SQL Editor** do
Supabase — ver `prisma/manual/LEIA-ME.md`. Regra de ouro: **SQL manual primeiro, `db push`
depois** (que deve ficar em "already in sync"; as colunas do SQL espelham o `migrate diff`).
Nunca `--accept-data-loss`/`--force-reset` em produção.

- `prisma/manual/2026_auth_mcp_oauth.sql` — 2 enums + 10 tabelas de auth/RBAC/OAuth/MCP
  (`usuarios_internos`, `roles`, `permissions`, `usuario_roles`, `role_permissions`,
  `exec_parceiros`, `api_tokens`, `oauth_clients`, `oauth_codes`, `auditoria`), RLS + revoke.
- `prisma/seed-auth.sql` / `prisma/seed-auth.ts` — seed de identidade interna (o admin).
  O login Microsoft é **deny-by-default**: sem 1 usuário ativo em `usuarios_internos`,
  ninguém entra.

## Arquitetura

### Rotas de tela — `src/app/(app)/**`

Layout com sidebar persistente (`Sidebar.tsx`, `TopBar.tsx`, `MobileNav.tsx`,
`SessionWatch.tsx`). Cada tela: `page.tsx` (RSC, busca dados via `data.ts`) + um client
component + `actions.ts` (server actions) quando escreve.

| Rota | O que é |
|---|---|
| `dashboard` | cards, donut, barras, tendência — role-aware |
| `opportunities` | tabela com filtros/colunas/CSV + `OppModal` |
| `pipeline` | kanban drag & drop (dnd-kit) |
| `reports` | relatórios por produto/parceiro/status |
| `tasks` | tarefas por oportunidade |
| `partners` | CRUD de parceiros |
| `settings` | índice + `settings/{mcp,produtos,funil,perfil}` |
| `settings/mcp` | emissão/gestão das credenciais de máquina (tokens `cp_`) |

### Rotas de máquina/API — `src/app/api/**` e `src/app/.well-known/**`

- `api/auth/[...nextauth]` — Auth.js (login).
- `api/mcp` — servidor MCP (JSON-RPC 2.0).
- `api/oauth/{register,authorize,token,revoke}` — Authorization Server OAuth 2.1.
- `api/v1/*` — API REST de leitura (ver abaixo).
- `.well-known/oauth-authorization-server` + `.well-known/oauth-protected-resource`
  (com a variante de sufixo `[...caminho]`) — descoberta OAuth.
- `oauth/consent` — tela de consentimento (fora do grupo `(app)`).

### Libs — `src/lib/**`

| Arquivo | Responsabilidade |
|---|---|
| `db.ts` | cliente Prisma (adapter PrismaPg) |
| `auth.ts` | config Auth.js: providers (Entra + Credentials), callbacks `signIn`/`jwt`/`session` |
| `rbac.ts` | `SessionUser`, gates (`isAdmin`, `requireInternal`, `requirePartner`), `oportunidadeScopeWhere` |
| `sessionUser.ts` | monta `SessionUser` **do banco** (`loadSessionUser`/`…ByEmail`/`loadPartnerSession`) |
| `sessionPolicy.ts` | política de sessão (revogação, `sessionsValidFrom`) |
| `audit.ts` | trilha de auditoria |
| `tokenAuth.ts` | credenciais `cp_` (SHA-256, **fail-closed**) para MCP/REST |
| `appUrl.ts` | URL pública (issuer/resource do OAuth) |
| `money.ts` / `filters.ts` | BRL e filtros de oportunidade |
| `mcp/**` | protocolo (`rpc.ts`, `handler.ts`), catálogo (`catalog.ts`, `tools/*`), `envelope.ts`, `dados.ts`, `limites.ts`, `forbidden.test.ts` |
| `oauth/**` | `store.ts`, `pedido.ts`, `rules.ts`, `http.ts` |
| `api/**` | REST: `rota.ts` (casca), `catalogo.ts`, `saidas.ts` (zod), `openapi.ts` |
| `domain/**` | regras compartilhadas (`opps.ts`, `admin.ts`, `perfil.ts`, `leitura.ts`) |
| `textoSeguro.ts` | limpeza de caracteres invisíveis (bidi, tag chars) |
| `rateLimit.ts` | teto por token (Map em memória) |

### Componentes — `src/components/{charts,ui,dominio}`

`charts/` (Donut, BarChart, FunnelChart, RadialGauge, RankBars, Sparkline, TrendArea +
`palette.ts`/`format.ts`); `ui/` (kit shadcn: dialog, popover, command, table-kit, sonner,
combobox, multiselect, badges…); `dominio/` (`OppModal`, `OppFiltersBar`, `StatusBadge`,
`AprovacaoBadge`).

## Duas audiências de login

O contrato central é **`SessionUser`** (`src/lib/rbac.ts`):

```ts
type SessionUser = {
  id: string;
  audience: "internal" | "partner";
  name; email;
  permissions: string[];      // RBAC (só internos)
  roles: string[];            // internos: papéis; parceiro: ['partner']
  parceiroId?: number | null; // só parceiro
  execParceiroIds?: number[] | null; // executivo de canal: parceiros que enxerga; null = admin/todos
};
```

- **INTERNO** (admins e executivos de canal) — login pela **Microsoft (Entra ID)** + **senha
  de emergência**. Linha em `usuarios_internos` (model Prisma `User`) com papéis/permissões
  (RBAC). Provisionamento é **deny-by-default**: só entra quem tem linha **ativa** cujo
  `email` casa exatamente com o e-mail do Entra. `sessionUser.ts` achata papéis+permissões.
- **PARCEIRO** — login+senha próprio (preservado do SPA), tabela `parceiros`. Sem RBAC:
  `permissions: []`, `roles: ['partner']`, `parceiroId` preenchido.

### Escopo — sempre server-side

`oportunidadeScopeWhere(user)` (`src/lib/rbac.ts`) devolve o `where` do Prisma:

- **admin** → `{}` (tudo);
- **parceiro** → só as suas (`parceiroId`; fail-closed com `-1` se ausente);
- **executivo de canal** → `{ parceiroId: { in: execParceiroIds } }` (de `exec_parceiros`).

**Nunca** recorte por parâmetro do cliente. As permissões do `SessionUser` de tela são
congeladas no login (JWT); nas rotas de máquina são lidas do banco a cada chamada.

## MCP — outro chat lendo o CultPartners

`/api/mcp` expõe o CultPartners como servidor MCP remoto, **somente leitura**, credencial por
pessoa herdando o RBAC dela. Espelha o desenho do CRM (`crm-cultsec/docs/mcp.md`).

- **Protocolo:** JSON-RPC 2.0 sem estado, **à mão** (`src/lib/mcp/rpc.ts` + `handler.ts`),
  sem `@modelcontextprotocol/sdk`. Métodos: `initialize`, `notifications/initialized`,
  `tools/list`, `tools/call`, `ping`. Lote e `id:null` → `-32600`; erro de ferramenta é
  `isError` no resultado, não erro de protocolo. GET sem credencial → 401 com
  `WWW-Authenticate`; com credencial → 405.
- **Identidade:** tokens `cp_<prefixo8>_<segredo>` via `tokenAuth.ts` — SHA-256 (`tokenHash`
  `@unique`, comparação no índice), validade explícita, permissões lidas do banco a cada
  chamada, **fail-CLOSED** (banco fora do ar → recusa). Token **só no header**; query string
  nunca autentica. Emitido na tela `/settings/mcp` (segredo mostrado uma única vez).
- **As 9 ferramentas** (`cp_*`, `tools/list` devolve só o que a pessoa pode usar):
  `cp_whoami`, `cp_list_opportunities`, `cp_get_opportunity`, `cp_pipeline_by_stage`,
  `cp_list_partners`, `cp_list_products`, `cp_list_status`, `cp_list_tasks`,
  `cp_reports_summary`.
- **Anti-injeção** (`envelope.ts` + `textoSeguro.ts`): a v1 **não escreve** (o que de fato
  limita o dano), limpeza incondicional de invisíveis em toda string, e cerca com nonce por
  resposta + marca por campo de texto livre.

## OAuth 2.1 — o CultPartners é o Authorization Server

Federando o login para a **Microsoft**. O caminho "Entra como AS" está documentado como
**quebrado** no CRM (conflito de `resource` RFC 8707 × RFC 9728) — não refaça a análise;
**o AS é o CultPartners** e o Entra entra só como IdP do login humano.

- `.well-known/oauth-authorization-server` (RFC 8414, `S256`) e
  `.well-known/oauth-protected-resource` (RFC 9728, com variante de sufixo).
- `POST /api/oauth/register` (RFC 7591, registro dinâmico; `OAUTH_DCR_DISABLED=1` desliga).
- `GET/POST /api/oauth/authorize` (exige sessão; consentimento em `/oauth/consent`;
  recusa sob impersonation — que aqui nem existe).
- `POST /api/oauth/token` (`authorization_code` + `refresh_token` com rotação).
- `POST /api/oauth/revoke` (RFC 7009).
- **PKCE S256 obrigatório**, `redirect_uri` por string exata, código de uso único consumido
  antes do PKCE, refresh rotaciona, tokens **opacos** (SHA-256 no banco, sem JWT). O access
  token é uma linha de `api_tokens` com `kind: "oauth"` — mesmo caminho de validação dos `cp_`.

## API REST — `/api/v1`

Para **programa** (endereço estável), não para modelo escolher ferramenta. Mesma identidade,
escopo e auditoria do MCP. **As rotas reaproveitam o `run` das ferramentas MCP**
(`src/lib/api/rota.ts`) — é isso que garante, por construção, que o número da API é o mesmo
do MCP e da tela. Não copie o molde de uma rota sem o filtro de dono (foi assim que nasceram
vazamentos de escopo no CRM).

| rota | ferramenta |
|---|---|
| `GET /api/v1/me` | `cp_whoami` |
| `GET /api/v1/opportunities` | `cp_list_opportunities` |
| `GET /api/v1/opportunities/{id}` | `cp_get_opportunity` |
| `GET /api/v1/opportunities/pipeline` | `cp_pipeline_by_stage` |
| `GET /api/v1/partners` | `cp_list_partners` |
| `GET /api/v1/products` | `cp_list_products` |
| `GET /api/v1/status` | `cp_list_status` |
| `GET /api/v1/tasks` | `cp_list_tasks` |
| `GET /api/v1/reports` | `cp_reports_summary` |
| `GET /api/v1/openapi.json` | — (**aberto**, sem credencial) |

Diferenças do MCP: sem cerca/marca (corromperia valores num programa), mas **com** limpeza de
invisíveis; escopo em campo estruturado; "não é seu" vira **404** (igual a "não existe");
schema de saída em zod (`saidas.ts`) é a fonte do OpenAPI.

## Regras críticas (não reverter)

1. **MCP é read-only.** `src/lib/mcp/forbidden.test.ts` varre `src/lib/mcp/**` e
   `src/app/api/mcp/**` e **quebra o build** se aparecer verbo de escrita do Prisma, SQL cru,
   `cookies()`, ou uma ferramenta sem `escreve: false`.
2. **Nunca expor `senhaHash`/`senha_hash`** (nem de `parceiros`, nem de `usuarios_internos`)
   em nenhuma superfície de máquina ou payload.
3. **Escopo sempre server-side** via `oportunidadeScopeWhere` — nunca por parâmetro do cliente.
4. **Soft delete only** (`deletedAt`/`deleted_at`); nunca hard delete.
5. **OAuth:** PKCE **S256** obrigatório, `redirect_uri` por string exata, tokens **opacos**
   (SHA-256), refresh rotaciona.
6. **`tokenAuth` é fail-closed** — se não deu para verificar a credencial, recusa.
7. **`service_role` / connection string / secret** só server-side, **nunca no repo nem no
   cliente** — variáveis de ambiente (Vercel). Ver `.env.example`.
8. **Senhas nunca hasheadas no cliente** — bcrypt via `bcryptjs` no servidor (ou RPCs do
   pgcrypto no fluxo legado).

## Convenções

- **RSC por padrão**; `"use client"` só onde há estado/efeito. `page.tsx` busca via `data.ts`;
  escrita em `actions.ts` (server actions).
- **Nomes de arquivo em português** nas libs novas (`dados.ts`, `saidas.ts`, `pedido.ts`) —
  siga o padrão do módulo ao editar; MCP emite chaves em português (`nome`, `empresa`).
- **`SessionUser` vem do banco** nas rotas de máquina; do JWT nas telas.
- **Auditoria:** uma linha por `tools/call`/chamada REST; acima de 50 registros o evento
  sobe de `VIEW` para `EXPORT`.

## Comandos

```bash
npm install                 # postinstall roda prisma generate
npm run dev                 # next dev
npm run build               # next build
npm run start               # next start (produção local)
npm run lint                # eslint
npx prisma generate         # cliente Prisma
npx prisma db push          # aplica schema (deve dizer "already in sync" após o SQL manual)
npx vitest run              # testes (inclui forbidden.test.ts)
```

## Fluxo de banco neste ambiente (importante)

Alguns ambientes de agente **bloqueiam** o egress ao Supabase (Postgres 5432/6543 e
`*.supabase.co`/`api.supabase.com` por política) — 403 no proxy. Quando isso acontece **não**
dá para rodar `psql`/`pg_dump`/Management API nem `prisma db push` a partir do Claude: o
**usuário** roda o SQL no **SQL Editor** (navegador) e cola o resultado. Os SQLs de
`prisma/manual/` foram desenhados para esse fluxo (idempotentes, verificação com linhas
rotuladas). Teste o acesso antes; se bloquear, use o SQL Editor.

## Gotchas

- **SQL single quotes:** escapar com `''` (dois apóstrofos), nunca `\'`.
- **`create index concurrently`** não roda dentro da transação do SQL Editor — evite em SQL
  manual (o CRM tem `sqlManual.test.ts` guardando isso).
- **`prisma db pull`** regenera o schema e apaga comentários/`@@schema` — ajuste à mão.
- **Push rejeitado (non-fast-forward):** `git pull origin <branch> --no-rebase` e `git push`.
- **Edit tool:** o arquivo precisa ser `Read` ao menos uma vez na sessão antes do `Edit`.
- **Identidade Git deste repo:** commitar como `julianafsgpimentel@gmail.com`.

## Documentos irmãos

- `HANDOFF.md` — estado vivo, migração Next.js, checklist de go-live (ações do usuário).
- `README.md` — o que é, stack e como rodar local.
- `crm-cultsec/CLAUDE.md` (→ `AGENTS.md`) e `crm-cultsec/docs/mcp.md` — referência do desenho.
- `legacy/` — SPA antigo (referência histórica).
