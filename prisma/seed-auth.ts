/**
 * Seed de identidade interna (RBAC) — alternativa ao prisma/seed-auth.sql para quem
 * prefere rodar por script. Usa o mesmo DATABASE_URL do app.
 *
 * ORDEM: rode DEPOIS de aplicar prisma/manual/2026_auth_mcp_oauth.sql (as tabelas
 * precisam existir). O ambiente atual NÃO alcança o Supabase (egress bloqueado); rode
 * este script de uma máquina com acesso ao banco.
 *
 * Rodar:  DATABASE_URL="postgres://..."  npx tsx prisma/seed-auth.ts
 *
 * ⚠️ PREENCHA ADMIN_EMAIL e ADMIN_NAME abaixo (ou via env) com o e-mail corporativo
 *    Microsoft (Entra) do admin CULTSEC — é por ele que o login federado casa a conta.
 *
 * Idempotente: usa upsert por chave natural (email/name/key).
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// ── PREENCHA AQUI (ou exporte ADMIN_EMAIL / ADMIN_NAME no ambiente) ──────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "<< email.corporativo@cultsec.com.br >>";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "<< NOME DO ADMIN >>";
// ─────────────────────────────────────────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  if (ADMIN_EMAIL.startsWith("<<") || ADMIN_NAME.startsWith("<<")) {
    throw new Error(
      "Preencha ADMIN_EMAIL e ADMIN_NAME (o e-mail EXATO do Entra do admin) antes de rodar.",
    );
  }

  // 1) Permissão admin.full + Role admin (isSystem), ligadas.
  const adminFull = await prisma.permission.upsert({
    where: { key: "admin.full" },
    update: {},
    create: { key: "admin.full", scope: "ALL", description: "Acesso total ao portal" },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: { isSystem: true },
    create: {
      name: "admin",
      description: "Administrador do portal (acesso total)",
      isSystem: true,
    },
  });

  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: adminRole.id, permissionId: adminFull.id } },
    update: {},
    create: { roleId: adminRole.id, permissionId: adminFull.id },
  });

  // 2) Role exec_canal (isSystem), SEM permissões: o escopo do executivo vem de
  //    ExecParceiro, não de permissões RBAC. Ver seed-auth.sql para o racional.
  await prisma.role.upsert({
    where: { name: "exec_canal" },
    update: { isSystem: true },
    create: {
      name: "exec_canal",
      description: "Executivo de canal (escopo por exec_parceiros)",
      isSystem: true,
    },
  });

  // 3) Primeiro usuário admin (passwordHash null = só Microsoft).
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { name: ADMIN_NAME, active: true },
    create: { name: ADMIN_NAME, email: ADMIN_EMAIL, passwordHash: null, active: true },
  });

  // 4) Liga o admin à role admin.
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  console.log(`OK: admin '${ADMIN_NAME}' <${ADMIN_EMAIL}> ligado à role 'admin'.`);
  console.log("Roles 'admin' e 'exec_canal' e permissão 'admin.full' garantidas.");

  // COMO CADASTRAR UM EXECUTIVO DE CANAL (exemplo, adapte):
  //   const maria = await prisma.user.create({
  //     data: { name: "Maria Exec", email: "maria@cultsec.com.br", active: true },
  //   });
  //   const exec = await prisma.role.findUniqueOrThrow({ where: { name: "exec_canal" } });
  //   await prisma.userRole.create({ data: { userId: maria.id, roleId: exec.id } });
  //   // Um parceiro por linha (parceiroId é BigInt):
  //   await prisma.execParceiro.createMany({
  //     data: [
  //       { userId: maria.id, parceiroId: 10n },
  //       { userId: maria.id, parceiroId: 42n },
  //     ],
  //     skipDuplicates: true,
  //   });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
