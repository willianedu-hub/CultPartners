-- ═══════════════════════════════════════════════════════════════════════════════
-- CultPartners — Auth / RBAC / OAuth 2.1 / MCP  (tabelas e enums NOVOS)
-- Schema de destino: cultpartners   |   Projeto Supabase: xqrudhwtdwzmgwstcyoh
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- O QUE ESTE ARQUIVO FAZ
-- Cria SÓ o que os modelos Prisma novos adicionaram sobre o domínio que já está em
-- produção: 2 enums e 10 tabelas de identidade interna, RBAC, OAuth e trilha de
-- auditoria. O domínio existente (parceiros, produtos, status_funil, admins,
-- oportunidades, tarefas, oportunidade_produtos, preferencias_usuario, audit_log)
-- NÃO é tocado.
--
--   Enums (2):   PermissionScope, AuditAction
--   Tabelas (10): usuarios_internos (User), roles, permissions, usuario_roles,
--                 role_permissions, exec_parceiros, api_tokens, oauth_clients,
--                 oauth_codes, auditoria
--
-- ORDEM DE APLICAÇÃO: **este SQL PRIMEIRO, o deploy DEPOIS.** As rotas de auth/OAuth/MCP
-- consultam estas tabelas; na ordem certa não há janela de erro (o código antigo ignora
-- o que é novo). Depois deste arquivo, rode o seed (`seed-auth.sql` / `seed-auth.ts`).
--
-- COMO RODAR (SQL Editor do Supabase, projeto xqrudhwtdwzmgwstcyoh, usuário dono postgres):
--   1. Confirme que o schema `cultpartners` já está em Settings → API → "Exposed schemas"
--      NÃO precisa estar exposto (o app fala direto por DATABASE_URL); mas o "Extra search
--      path" foi ajustado na consolidação. Nada a fazer aqui — só conferir.
--   2. Cole o arquivo INTEIRO e rode de uma vez. Ele roda inteiro porque **NÃO há
--      `create index concurrently`** — o SQL Editor abre uma transação para o script todo,
--      e `concurrently` falharia com "ERROR: 25001: CREATE INDEX CONCURRENTLY cannot run
--      inside a transaction block". Todas as tabelas nascem vazias aqui, então um
--      `create index` comum trava por microssegundos — `concurrently` não compraria nada.
--   3. Se aparecer o aviso "Potential issue detected / Row Level Security", escolha
--      **"Run without RLS"**: a PARTE 2 já liga a RLS em todas as tabelas E a PARTE 3
--      revoga anon/authenticated — o botão não faz isso.
--   4. Confira as 15 linhas OK da tabela de verificação (PARTE 4).
--   5. Rode o seed de identidade (`prisma/seed-auth.sql`) — sem ao menos 1 User o login
--      Microsoft é deny-by-default e ninguém entra.
--   6. Depois, `npx prisma db push` DEVE dizer **"already in sync"**. Se não disser, as
--      colunas divergiram do que o Prisma espera — AJUSTE as colunas para casar com o
--      Prisma, NÃO "melhore" o schema (divergência vira drift e o próximo push altera
--      tabela em produção).
--
-- As colunas espelham EXATAMENTE o que `prisma migrate diff` gerou a partir do
-- schema.prisma (inclusive `text[]` anulável — como o Prisma materializa lista de escalar
-- — e `CURRENT_TIMESTAMP` em vez de `now()`, e os nomes de índice/constraint que o Prisma
-- introspecta por nome). Não altere sem regenerar o diff.
--
-- Idempotente: pode rodar quantas vezes quiser.

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 1 — enums, tabelas, índices e chaves estrangeiras
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1.1  Enums (idempotentes) ───────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'PermissionScope' and n.nspname = 'cultpartners') then
    create type "cultpartners"."PermissionScope" as enum ('OWN', 'TEAM', 'ALL');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'AuditAction' and n.nspname = 'cultpartners') then
    create type "cultpartners"."AuditAction" as enum (
      'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'VIEW', 'EXPORT',
      'CREATE', 'UPDATE', 'DELETE', 'REVERT', 'PURGE'
    );
  end if;
end $$;

-- ── 1.2  Tabelas ────────────────────────────────────────────────────────────────
-- Identidade interna. `passwordHash` é anulável de propósito: quem entra só por SSO
-- (Microsoft/Entra) não carrega senha local — senha que existe e nunca é usada é senha
-- que ninguém troca. O admin pode manter a dele como porta de emergência se o Entra cair.
create table if not exists "cultpartners"."usuarios_internos" (
  "id"                text         not null,
  "name"              text         not null,
  "email"             text         not null,
  "passwordHash"      text,
  "active"            boolean      not null default true,
  "createdAt"         timestamp(3) not null default CURRENT_TIMESTAMP,
  "updatedAt"         timestamp(3) not null,
  "sessionsValidFrom" timestamp(3),
  constraint "usuarios_internos_pkey" primary key ("id")
);

create table if not exists "cultpartners"."roles" (
  "id"          text         not null,
  "name"        text         not null,
  "description" text,
  "isSystem"    boolean      not null default false,
  "createdAt"   timestamp(3) not null default CURRENT_TIMESTAMP,
  constraint "roles_pkey" primary key ("id")
);

create table if not exists "cultpartners"."permissions" (
  "id"          text                              not null,
  "key"         text                              not null,
  "scope"       "cultpartners"."PermissionScope"  not null default 'ALL',
  "description" text,
  constraint "permissions_pkey" primary key ("id")
);

create table if not exists "cultpartners"."usuario_roles" (
  "userId" text not null,
  "roleId" text not null,
  constraint "usuario_roles_pkey" primary key ("userId", "roleId")
);

create table if not exists "cultpartners"."role_permissions" (
  "roleId"       text not null,
  "permissionId" text not null,
  constraint "role_permissions_pkey" primary key ("roleId", "permissionId")
);

-- Escopo do executivo de canal: quais parceiros ele enxerga. Aplicado SEMPRE no
-- servidor. Admin não precisa de linha aqui (vê tudo).
create table if not exists "cultpartners"."exec_parceiros" (
  "userId"      text         not null,
  "parceiro_id" bigint       not null,
  "created_at"  timestamp(3) not null default CURRENT_TIMESTAMP,
  constraint "exec_parceiros_pkey" primary key ("userId", "parceiro_id")
);

-- Credencial de máquina (MCP, kind='pat') + token OAuth (kind='oauth') na mesma linha.
-- `tokenHash`/`refreshTokenHash` guardam SHA-256 do segredo, nunca o segredo. São
-- `unique` para que a verificação seja um findUnique (igualdade dentro do índice).
create table if not exists "cultpartners"."api_tokens" (
  "id"               text         not null,
  "userId"           text         not null,
  "name"             text         not null,
  "prefix"           text         not null,
  "tokenHash"        text         not null,
  "scopes"           text[],
  "expiresAt"        timestamp(3) not null,
  "lastUsedAt"       timestamp(3),
  "revokedAt"        timestamp(3),
  "windowStart"      timestamp(3) not null default CURRENT_TIMESTAMP,
  "windowCount"      integer      not null default 0,
  "createdAt"        timestamp(3) not null default CURRENT_TIMESTAMP,
  "kind"             text         not null default 'pat',
  "clientId"         text,
  "refreshTokenHash" text,
  "refreshExpiresAt" timestamp(3),
  constraint "api_tokens_pkey" primary key ("id")
);

-- OAuth 2.1 — o CultPartners como SERVIDOR DE AUTORIZAÇÃO, federando ao Entra.
create table if not exists "cultpartners"."oauth_clients" (
  "id"               text         not null,
  "clientId"         text         not null,
  "clientSecretHash" text,
  "name"             text         not null,
  "redirectUris"     text[],
  "scopes"           text[],
  "origem"           text         not null default 'dcr',
  "disabled"         boolean      not null default false,
  "createdAt"        timestamp(3) not null default CURRENT_TIMESTAMP,
  "lastUsedAt"       timestamp(3),
  constraint "oauth_clients_pkey" primary key ("id")
);

create table if not exists "cultpartners"."oauth_codes" (
  "id"                  text         not null,
  "codeHash"            text         not null,
  "clientId"            text         not null,
  "userId"              text         not null,
  "redirectUri"         text         not null,
  "codeChallenge"       text         not null,
  "codeChallengeMethod" text         not null default 'S256',
  "scopes"              text[],
  "resource"            text,
  "expiresAt"           timestamp(3) not null,
  "usedAt"              timestamp(3),
  "createdAt"           timestamp(3) not null default CURRENT_TIMESTAMP,
  constraint "oauth_codes_pkey" primary key ("id")
);

-- Trilha de auditoria da camada MCP/OAuth/API (append-only). Ator e rótulo do registro
-- são desnormalizados de propósito: a trilha precisa continuar legível depois que o
-- usuário ou o registro forem apagados — por isso não há FK para usuarios_internos.
create table if not exists "cultpartners"."auditoria" (
  "id"          text                          not null,
  "createdAt"   timestamp(3)                  not null default CURRENT_TIMESTAMP,
  "action"      "cultpartners"."AuditAction"  not null,
  "userId"      text,
  "userName"    text,
  "userEmail"   text,
  "entityType"  text                          not null,
  "entityId"    text,
  "entityLabel" text,
  "summary"     text,
  "fields"      jsonb,
  "snapshot"    jsonb,
  "meta"        jsonb,
  "ip"          text,
  "userAgent"   text,
  "route"       text,
  constraint "auditoria_pkey" primary key ("id")
);

-- ── 1.3  Índices ──────────────────────────────────────────────────────────────
-- SEM `concurrently` (ver cabeçalho): tabelas nascem vazias, índice comum trava por
-- microssegundos e `concurrently` quebraria o script no SQL Editor (erro 25001).
-- O único de refreshTokenHash é seguro mesmo com dados: NULL é distinto no Postgres.
create unique index if not exists "usuarios_internos_email_key"    on "cultpartners"."usuarios_internos" ("email");
create unique index if not exists "roles_name_key"                 on "cultpartners"."roles" ("name");
create unique index if not exists "permissions_key_key"            on "cultpartners"."permissions" ("key");
create        index if not exists "exec_parceiros_parceiro_id_idx" on "cultpartners"."exec_parceiros" ("parceiro_id");
create unique index if not exists "api_tokens_prefix_key"          on "cultpartners"."api_tokens" ("prefix");
create unique index if not exists "api_tokens_tokenHash_key"       on "cultpartners"."api_tokens" ("tokenHash");
create unique index if not exists "api_tokens_refreshTokenHash_key" on "cultpartners"."api_tokens" ("refreshTokenHash");
create        index if not exists "api_tokens_userId_idx"          on "cultpartners"."api_tokens" ("userId");
create        index if not exists "api_tokens_clientId_idx"        on "cultpartners"."api_tokens" ("clientId");
create unique index if not exists "oauth_clients_clientId_key"     on "cultpartners"."oauth_clients" ("clientId");
create unique index if not exists "oauth_codes_codeHash_key"       on "cultpartners"."oauth_codes" ("codeHash");
create        index if not exists "oauth_codes_clientId_idx"       on "cultpartners"."oauth_codes" ("clientId");
create        index if not exists "oauth_codes_expiresAt_idx"      on "cultpartners"."oauth_codes" ("expiresAt");
create        index if not exists "auditoria_createdAt_idx"                    on "cultpartners"."auditoria" ("createdAt" DESC);
create        index if not exists "auditoria_entityType_entityId_createdAt_idx" on "cultpartners"."auditoria" ("entityType", "entityId", "createdAt" DESC);
create        index if not exists "auditoria_userId_createdAt_idx"             on "cultpartners"."auditoria" ("userId", "createdAt" DESC);
create        index if not exists "auditoria_action_createdAt_idx"            on "cultpartners"."auditoria" ("action", "createdAt" DESC);

-- ── 1.4  Chaves estrangeiras (idempotentes) ──────────────────────────────────
-- Cascade em toda parte: apagar a pessoa leva as roles/tokens/escopos dela; apagar o
-- cliente OAuth leva os tokens emitidos para ele (o "desconectar de todo mundo" numa
-- linha). exec_parceiros.parceiro_id referencia a tabela `parceiros` do domínio.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'usuario_roles_userId_fkey') then
    alter table "cultpartners"."usuario_roles" add constraint "usuario_roles_userId_fkey"
      foreign key ("userId") references "cultpartners"."usuarios_internos"("id") on delete cascade on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'usuario_roles_roleId_fkey') then
    alter table "cultpartners"."usuario_roles" add constraint "usuario_roles_roleId_fkey"
      foreign key ("roleId") references "cultpartners"."roles"("id") on delete cascade on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'role_permissions_roleId_fkey') then
    alter table "cultpartners"."role_permissions" add constraint "role_permissions_roleId_fkey"
      foreign key ("roleId") references "cultpartners"."roles"("id") on delete cascade on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'role_permissions_permissionId_fkey') then
    alter table "cultpartners"."role_permissions" add constraint "role_permissions_permissionId_fkey"
      foreign key ("permissionId") references "cultpartners"."permissions"("id") on delete cascade on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'exec_parceiros_userId_fkey') then
    alter table "cultpartners"."exec_parceiros" add constraint "exec_parceiros_userId_fkey"
      foreign key ("userId") references "cultpartners"."usuarios_internos"("id") on delete cascade on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'exec_parceiros_parceiro_id_fkey') then
    alter table "cultpartners"."exec_parceiros" add constraint "exec_parceiros_parceiro_id_fkey"
      foreign key ("parceiro_id") references "cultpartners"."parceiros"("id") on delete cascade on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'api_tokens_userId_fkey') then
    alter table "cultpartners"."api_tokens" add constraint "api_tokens_userId_fkey"
      foreign key ("userId") references "cultpartners"."usuarios_internos"("id") on delete cascade on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'api_tokens_clientId_fkey') then
    alter table "cultpartners"."api_tokens" add constraint "api_tokens_clientId_fkey"
      foreign key ("clientId") references "cultpartners"."oauth_clients"("clientId") on delete cascade on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'oauth_codes_clientId_fkey') then
    alter table "cultpartners"."oauth_codes" add constraint "oauth_codes_clientId_fkey"
      foreign key ("clientId") references "cultpartners"."oauth_clients"("clientId") on delete cascade on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'oauth_codes_userId_fkey') then
    alter table "cultpartners"."oauth_codes" add constraint "oauth_codes_userId_fkey"
      foreign key ("userId") references "cultpartners"."usuarios_internos"("id") on delete cascade on update cascade;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 2 — RLS (a fechadura de dentro)
-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS ligada e SEM política = ninguém lê, ninguém escreve, EXCETO o dono da tabela
-- (postgres), que é isento — e o app conecta como dono por DATABASE_URL, então nada muda
-- para ele. No Supabase o papel `service_role` tem BYPASSRLS, então o backend server-side
-- também passa. anon/authenticated (a API pública/PostgREST) ficam barrados.
--
-- ⚠️ Estas são tabelas de credencial/identidade — NENHUMA recebe policy de leitura
--    pública (allow-all). Não há `create policy` aqui de propósito.
-- ⚠️ NUNCA use `force row level security`: ela remove a isenção do dono e o app passaria
--    a receber zero linhas em toda consulta do Prisma.
alter table "cultpartners"."usuarios_internos" enable row level security;
alter table "cultpartners"."roles"             enable row level security;
alter table "cultpartners"."permissions"       enable row level security;
alter table "cultpartners"."usuario_roles"     enable row level security;
alter table "cultpartners"."role_permissions"  enable row level security;
alter table "cultpartners"."exec_parceiros"    enable row level security;
alter table "cultpartners"."api_tokens"        enable row level security;
alter table "cultpartners"."oauth_clients"     enable row level security;
alter table "cultpartners"."oauth_codes"       enable row level security;
alter table "cultpartners"."auditoria"         enable row level security;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 3 — GRANTs
-- ═══════════════════════════════════════════════════════════════════════════════
-- O app fala com o Postgres por DATABASE_URL como DONO do schema (papel postgres): é ele
-- quem precisa operar, e como dono ele já pode tudo e é isento de RLS. O mais importante
-- aqui é que a PARTE 2 não trave o dono — e não trava.
--
-- Defesa em profundidade para o resto do Supabase:
--   • anon/authenticated (chave pública, PostgREST): REVOGA tudo. Não recebem nada nas
--     tabelas novas — são de auth/oauth/token e só o backend as acessa.
--   • service_role (backend server-side): concede SELECT/INSERT/UPDATE/DELETE. Ele já tem
--     BYPASSRLS no Supabase; o grant explícito garante o privilégio de tabela caso um dia
--     algum caminho use service_role em vez do dono.
-- Os `revoke`/`grant` são condicionais porque anon/authenticated/service_role são papéis
-- do Supabase: num Postgres local eles não existem e o comando cru abortaria o arquivo.
--
-- SEQUENCES: as 10 tabelas novas usam id `text` (cuid gerado pelo app) — NÃO há coluna
-- serial/bigserial, então NÃO há sequence nova para conceder USAGE. (Nada a fazer.)
do $$
declare
  t text;
  novas text[] := array[
    'usuarios_internos', 'roles', 'permissions', 'usuario_roles', 'role_permissions',
    'exec_parceiros', 'api_tokens', 'oauth_clients', 'oauth_codes', 'auditoria'
  ];
begin
  foreach t in array novas loop
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all privileges on table cultpartners.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all privileges on table cultpartners.%I from authenticated', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant select, insert, update, delete on table cultpartners.%I to service_role', t);
    end if;
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 4 — verificação, numa consulta só
-- ═══════════════════════════════════════════════════════════════════════════════
-- Uma consulta e não quinze: o SQL Editor do Supabase mostra apenas o resultado do ÚLTIMO
-- `select`. Esperado: 15 linhas, todas com situacao = OK.
with checagens (ordem, checagem, valor, esperado) as (
  select 1, 'enum PermissionScope existe',
         (select count(*)::text from pg_type t join pg_namespace n on n.oid=t.typnamespace
           where t.typname='PermissionScope' and n.nspname='cultpartners'), '1'
  union all
  select 2, 'enum AuditAction existe',
         (select count(*)::text from pg_type t join pg_namespace n on n.oid=t.typnamespace
           where t.typname='AuditAction' and n.nspname='cultpartners'), '1'
  union all
  select 3, '10 tabelas novas existem',
         (select count(*)::text from information_schema.tables
           where table_schema='cultpartners' and table_name in (
             'usuarios_internos','roles','permissions','usuario_roles','role_permissions',
             'exec_parceiros','api_tokens','oauth_clients','oauth_codes','auditoria')), '10'
  union all
  select 4, 'RLS ligada nas 10',
         (select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='cultpartners' and c.relrowsecurity and c.relname in (
             'usuarios_internos','roles','permissions','usuario_roles','role_permissions',
             'exec_parceiros','api_tokens','oauth_clients','oauth_codes','auditoria')), '10'
  union all
  select 5, 'nenhuma policy nas 10 (allow-all proibido)',
         (select count(*)::text from pg_policies
           where schemaname='cultpartners' and tablename in (
             'usuarios_internos','roles','permissions','usuario_roles','role_permissions',
             'exec_parceiros','api_tokens','oauth_clients','oauth_codes','auditoria')), '0'
  union all
  select 6, 'zero grant p/ anon/authenticated',
         (select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='cultpartners' and c.relacl::text ~ '(anon|authenticated)' and c.relname in (
             'usuarios_internos','roles','permissions','usuario_roles','role_permissions',
             'exec_parceiros','api_tokens','oauth_clients','oauth_codes','auditoria')), '0'
  union all
  select 7, 'FKs das tabelas novas',
         (select count(*)::text from pg_constraint where conname in (
           'usuario_roles_userId_fkey','usuario_roles_roleId_fkey','role_permissions_roleId_fkey',
           'role_permissions_permissionId_fkey','exec_parceiros_userId_fkey','exec_parceiros_parceiro_id_fkey',
           'api_tokens_userId_fkey','api_tokens_clientId_fkey','oauth_codes_clientId_fkey','oauth_codes_userId_fkey')), '10'
  union all
  select 8,  'linhas em usuarios_internos', (select count(*)::text from cultpartners.usuarios_internos), '0'
  union all
  select 9,  'linhas em api_tokens',        (select count(*)::text from cultpartners.api_tokens),        '0'
  union all
  select 10, 'linhas em oauth_clients',     (select count(*)::text from cultpartners.oauth_clients),     '0'
  union all
  select 11, 'linhas em oauth_codes',       (select count(*)::text from cultpartners.oauth_codes),       '0'
  union all
  select 12, 'linhas em auditoria',         (select count(*)::text from cultpartners.auditoria),         '0'
  union all
  select 13, 'linhas em roles',             (select count(*)::text from cultpartners.roles),             '0'
  union all
  select 14, 'linhas em permissions',       (select count(*)::text from cultpartners.permissions),       '0'
  union all
  select 15, 'linhas em exec_parceiros',    (select count(*)::text from cultpartners.exec_parceiros),    '0'
)
select checagem, valor, esperado,
       case when valor = esperado then 'OK' else '>>> VERIFICAR <<<' end as situacao
  from checagens
 order by ordem;
