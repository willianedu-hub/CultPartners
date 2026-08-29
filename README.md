# CultPartners

Portal comercial dos parceiros/revendas da **CULTSEC** (cibersegurança). Parceiros cadastram
oportunidades, administradores aprovam/rejeitam, e os negócios aprovados correm num pipeline
kanban com tarefas. Além do portal, expõe o CultPartners como **servidor MCP** (leitura),
**Authorization Server OAuth 2.1** (login Microsoft/Entra) e uma **API REST** `/api/v1`.

> Convertido de um SPA estático (HTML/CSS/JS puro) para Next.js. O SPA antigo está preservado
> em `legacy/` só como referência.

## Stack

- **Next.js 16** (App Router) + **React 19**
- **Prisma 7** (adapter PrismaPg) — schema Postgres dedicado `cultpartners` (Supabase)
- **Auth.js** (next-auth v5) — login Microsoft/Entra (internos) + login por senha (parceiros)
- **Tailwind 4** + componentes estilo **shadcn** (Radix, cmdk, lucide-react, sonner)
- **Deploy:** Vercel

## Rodar localmente

Pré-requisitos: Node 20+ e uma `DATABASE_URL` válida (Supabase, schema `cultpartners`).

```bash
# 1. Variáveis de ambiente
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
#    edite .env: DATABASE_URL e AUTH_SECRET são obrigatórias.
#    Para o login Microsoft, preencha AUTH_MICROSOFT_ENTRA_ID_ID/SECRET/ISSUER
#    (sem elas o provider Entra nem é registrado — o login por senha continua funcionando).

# 2. Dependências (o postinstall roda `prisma generate`)
npm install

# 3. Cliente Prisma (caso precise rodar de novo)
npx prisma generate

# 4. Dev server
npm run dev                 # http://localhost:3000
```

Outros comandos: `npm run build` / `npm run start` (produção), `npm run lint`,
`npx vitest run` (testes, inclui o `forbidden.test.ts` que garante MCP read-only).

> **Schema do banco:** as tabelas vivem no schema `cultpartners`. O SQL de auth/RBAC/OAuth/MCP
> é aplicado à mão no SQL Editor do Supabase — ver `prisma/manual/LEIA-ME.md`. Alguns
> ambientes bloqueiam o egress ao Supabase; nesse caso `prisma db push`/`psql` não rodam do
> agente e o SQL vai pelo SQL Editor.

## Documentação

- **[`CLAUDE.md`](./CLAUDE.md)** — arquitetura, convenções, regras críticas e comandos.
- **[`HANDOFF.md`](./HANDOFF.md)** — estado vivo, migração para Next.js, **checklist de
  go-live** (ações do usuário: SQL, Entra, env vars, deploy, verificação).
- `prisma/manual/LEIA-ME.md` — ordem de execução do SQL manual + App Registration no Entra.
- `.env.example` — todas as variáveis de ambiente, com explicação.
- `legacy/` — SPA antigo (referência histórica).
