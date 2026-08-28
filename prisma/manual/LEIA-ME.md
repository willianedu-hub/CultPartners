# prisma/manual — migrações manuais (SQL Editor do Supabase)

Estes SQLs são aplicados **à mão** no SQL Editor do Supabase (projeto de destino
`xqrudhwtdwzmgwstcyoh`, schema `cultpartners`), com o usuário dono (`postgres`). O app
fala com o Postgres por `DATABASE_URL` (Prisma + PrismaPg) como dono do schema — não usa
`@supabase/supabase-js`. Todos os arquivos são **idempotentes**.

## Ordem de execução (antes do deploy)

1. **`2026_auth_mcp_oauth.sql`** — cria os 2 enums (`PermissionScope`, `AuditAction`) e as
   10 tabelas novas de auth/RBAC/OAuth/MCP (`usuarios_internos`, `roles`, `permissions`,
   `usuario_roles`, `role_permissions`, `exec_parceiros`, `api_tokens`, `oauth_clients`,
   `oauth_codes`, `auditoria`), com índices, FKs, RLS ligada e revoke de anon/authenticated.
   Se o editor avisar "Row Level Security", clique **"Run without RLS"**. Confira as 15
   linhas OK da verificação.

2. **Seed de identidade** — o login Microsoft é *deny-by-default*: sem ao menos 1 usuário
   ativo em `usuarios_internos`, ninguém entra. Rode UM dos dois:
   - `../seed-auth.sql` no SQL Editor (**preencha o e-mail e o nome do admin** — os
     campos `<< ... >>`), ou
   - `DATABASE_URL="..." ADMIN_EMAIL="..." ADMIN_NAME="..." npx tsx ../seed-auth.ts`
     de uma máquina com acesso ao banco.

3. **Painel Supabase** — confirmar que `cultpartners` está no *Extra search path* /
   *Exposed schemas* (já feito na consolidação; só conferir em Settings → API). As tabelas
   novas **não** precisam estar expostas — o app as acessa só server-side.

4. **`npx prisma db push`** — deve dizer **"already in sync"**. Se não disser, alguma coluna
   divergiu do que o Prisma espera: ajuste a coluna para casar com o schema Prisma (não
   "melhore"), senão o próximo push tentará alterar a tabela em produção.

## Painel Entra (Microsoft) — App Registration (resumo)

Para o login federado funcionar, além do seed:

1. **Azure Portal → Microsoft Entra ID → App registrations → New registration.**
2. **Redirect URI** (Web): `https://<seu-dominio>/api/auth/callback/microsoft-entra-id`.
3. Anote **Application (client) ID** e **Directory (tenant) ID**.
4. **Certificates & secrets → New client secret**; copie o *value*.
5. Preencha as env vars da Vercel: `AUTH_MICROSOFT_ENTRA_ID_ID`,
   `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER`
   (`https://login.microsoftonline.com/<tenant-id>/v2.0`), `AUTH_SECRET`, `DATABASE_URL`.
6. O e-mail da conta Microsoft do admin **precisa ser exatamente** o `email` cadastrado em
   `usuarios_internos` (passo 2) — é a chave do casamento no `signIn`/`jwt` (`src/lib/auth.ts`).

> Regra de ouro do repo: **SQL manual primeiro, deploy depois, e `prisma db push` fica em
> "already in sync".** As colunas dos SQLs espelham exatamente o `prisma migrate diff`.
