-- ═══════════════════════════════════════════════════════════════════════════════
-- CultPartners — SEED de identidade interna (RBAC)
-- Schema: cultpartners   |   Projeto Supabase: xqrudhwtdwzmgwstcyoh
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PARA QUE SERVE
-- O login por Microsoft (Entra) é DENY-BY-DEFAULT: uma conta Microsoft válida que não
-- tenha uma linha ATIVA em `cultpartners.usuarios_internos` é recusada com
-- "sem_usuario_interno" (ver src/lib/auth.ts). Sem este seed, ninguém entra no portal.
--
-- ORDEM: rode DEPOIS de `prisma/manual/2026_auth_mcp_oauth.sql`.
-- Onde: SQL Editor do Supabase (usuário dono postgres). Idempotente.
--
-- ⚠️ VOCÊ PRECISA PREENCHER: o e-mail e o nome do primeiro admin (marcado << ... >>
--    abaixo). É por esse e-mail que o login federado casa a conta Microsoft com a linha
--    interna — tem que ser EXATAMENTE o e-mail corporativo do Entra do admin CULTSEC.
--    NÃO deixe o placeholder; o login não vai casar com "trocar@...".
--
-- IDs: o app gera ids com cuid (String @id). Aqui, como é seed manual e o @id é String
-- livre, usamos ids textuais fixos e rotulados (seed_*) — únicos e legíveis. Se preferir
-- ids opacos, troque por gen_random_uuid()::text (também é String válida). O que NÃO pode
-- é colidir com um id já existente.

-- ── 1) Permissão admin.full + Role admin (isSystem), e o vínculo entre elas ──────
-- O app trata como administrador quem tem a role 'admin' OU a permissão 'admin.full'
-- (src/lib/rbac.ts). Criamos as duas e ligamos, para cobrir os dois caminhos.
insert into "cultpartners"."permissions" ("id", "key", "scope", "description")
select 'seed_perm_admin_full', 'admin.full', 'ALL', 'Acesso total ao portal'
where not exists (select 1 from "cultpartners"."permissions" where "key" = 'admin.full');

insert into "cultpartners"."roles" ("id", "name", "description", "isSystem")
select 'seed_role_admin', 'admin', 'Administrador do portal (acesso total)', true
where not exists (select 1 from "cultpartners"."roles" where "name" = 'admin');

insert into "cultpartners"."role_permissions" ("roleId", "permissionId")
select r."id", p."id"
from "cultpartners"."roles" r, "cultpartners"."permissions" p
where r."name" = 'admin' and p."key" = 'admin.full'
  and not exists (
    select 1 from "cultpartners"."role_permissions" rp
    where rp."roleId" = r."id" and rp."permissionId" = p."id"
  );

-- ── 2) Role exec_canal (isSystem), SEM permissões ────────────────────────────────
-- O escopo do executivo de canal (quais parceiros ele vê) NÃO vem de permissões RBAC:
-- vem das linhas em `exec_parceiros` (ver src/lib/tokenAuth.ts e auth.ts). Qualquer
-- usuário interno que NÃO seja admin já é recortado por `execParceiroIds`. Então esta
-- role existe só como rótulo organizacional e fica sem permissões de propósito — dar
-- 'admin.full' aqui transformaria todo executivo em administrador.
insert into "cultpartners"."roles" ("id", "name", "description", "isSystem")
select 'seed_role_exec_canal', 'exec_canal', 'Executivo de canal (escopo por exec_parceiros)', true
where not exists (select 1 from "cultpartners"."roles" where "name" = 'exec_canal');

-- ── 3) Primeiro usuário admin ────────────────────────────────────────────────────
-- passwordHash fica NULL: entra só por Microsoft. (Porta de emergência opcional: gere um
-- bcrypt e coloque no lugar do null — o app aceita senha local para o admin.)
-- >>>>>>>>>>>>>>>>>>>>>>>>>  PREENCHA OS DOIS CAMPOS  <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- NOTA: "updatedAt" é NOT NULL e NÃO tem default (o Prisma preenche em código; num
-- INSERT cru é obrigatório informar). Por isso vai CURRENT_TIMESTAMP explícito.
insert into "cultpartners"."usuarios_internos" ("id", "name", "email", "passwordHash", "active", "updatedAt")
select
  'seed_user_admin',
  '<< NOME DO ADMIN >>',                    -- ex.: 'Fulano de Tal'
  '<< email.corporativo@cultsec.com.br >>', -- e-mail EXATO do Entra do admin
  null,
  true,
  CURRENT_TIMESTAMP
where not exists (
  select 1 from "cultpartners"."usuarios_internos"
  where "email" = '<< email.corporativo@cultsec.com.br >>'
);
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ── 4) Liga o admin à role admin ─────────────────────────────────────────────────
insert into "cultpartners"."usuario_roles" ("userId", "roleId")
select u."id", r."id"
from "cultpartners"."usuarios_internos" u, "cultpartners"."roles" r
where u."id" = 'seed_user_admin' and r."name" = 'admin'
  and not exists (
    select 1 from "cultpartners"."usuario_roles" ur
    where ur."userId" = u."id" and ur."roleId" = r."id"
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMO CADASTRAR UM EXECUTIVO DE CANAL (modelo, ajuste os valores)
-- ═══════════════════════════════════════════════════════════════════════════════
-- 3 passos: criar o User, dar a role exec_canal, e listar os parceiros do escopo dele
-- em exec_parceiros (uma linha por parceiro). Sem linhas em exec_parceiros ele não vê
-- nenhum parceiro.
--
--   insert into "cultpartners"."usuarios_internos" ("id","name","email","passwordHash","active","updatedAt")
--   values ('seed_user_exec_maria', 'Maria Exec', 'maria@cultsec.com.br', null, true, CURRENT_TIMESTAMP);
--
--   insert into "cultpartners"."usuario_roles" ("userId","roleId")
--   select 'seed_user_exec_maria', r."id" from "cultpartners"."roles" r where r."name"='exec_canal';
--
--   -- Um parceiro por linha (parceiro_id é bigint, referencia cultpartners.parceiros):
--   insert into "cultpartners"."exec_parceiros" ("userId","parceiro_id")
--   values ('seed_user_exec_maria', 10),
--          ('seed_user_exec_maria', 42);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO (uma consulta) — esperado: 4 linhas OK (o admin com email preenchido)
-- ═══════════════════════════════════════════════════════════════════════════════
with checagens (ordem, checagem, valor, esperado) as (
  select 1, 'permissao admin.full',
         (select count(*)::text from "cultpartners"."permissions" where "key"='admin.full'), '1'
  union all
  select 2, 'role admin com admin.full',
         (select count(*)::text from "cultpartners"."role_permissions" rp
            join "cultpartners"."roles" r on r."id"=rp."roleId"
            join "cultpartners"."permissions" p on p."id"=rp."permissionId"
           where r."name"='admin' and p."key"='admin.full'), '1'
  union all
  select 3, 'role exec_canal existe',
         (select count(*)::text from "cultpartners"."roles" where "name"='exec_canal'), '1'
  union all
  select 4, 'admin ativo ligado a role admin (0 = ainda com placeholder!)',
         (select count(*)::text from "cultpartners"."usuario_roles" ur
            join "cultpartners"."usuarios_internos" u on u."id"=ur."userId"
            join "cultpartners"."roles" r on r."id"=ur."roleId"
           where r."name"='admin' and u."active" and u."email" not like '<<%'), '1'
)
select checagem, valor, esperado,
       case when valor = esperado then 'OK' else '>>> VERIFICAR <<<' end as situacao
  from checagens
 order by ordem;
