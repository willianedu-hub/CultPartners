// Montagem de um `SessionUser` a partir do BANCO (não do JWT).
//
// Duas audiências, montadas aqui:
//  - INTERNOS (admins + executivos de canal): linha em `User`, com papéis/permissões
//    achatados no formato que o RBAC consome (`loadSessionUser`/`loadSessionUserByEmail`).
//  - PARCEIROS: linha em `Parceiro`, identidade própria fora do RBAC (`loadPartnerSession`).
//
// SEM impersonation: nenhuma função aqui lê cookie. É o mesmo racional do CRM (manter
// o caminho de montagem separado de quem encarna alguém), levado ao limite — no
// CultPartners não existe encarnação.
//
// **Diferença que importa em relação ao login**: as permissões do JWT são congeladas no
// login (ver `src/lib/auth.ts`). Aqui elas são lidas do banco AGORA.

import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/rbac";

/** Carrega um usuário interno como SessionUser (mesmas permissões/roles do login). */
export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  if (!user || !user.active) return null;
  return sessionUserOf(user);
}

/**
 * Irmão do `loadSessionUser`, mas por E-MAIL — e existe por causa do login federado.
 *
 * No login pela Microsoft o único elo com o CultPartners é o endereço de e-mail. Quem não
 * tiver `User` aqui **não entra** — a decisão de não provisionar automaticamente foi
 * explícita, e é ela que impede que qualquer conta do diretório corporativo (estagiário,
 * prestador, conta de serviço) vire acesso ao portal interno.
 *
 * `null` também quando a pessoa existe mas está inativa: para o login federado os dois casos
 * dão o mesmo resultado, e distinguir só serviria para dizer a quem tenta se o e-mail existe.
 */
export async function loadSessionUserByEmail(email: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    // Minúsculas: o Entra devolve o e-mail com a caixa que a pessoa cadastrou, e o portal
    // guarda normalizado (é o que o login por senha faz antes de consultar).
    where: { email: email.trim().toLowerCase() },
    include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  if (!user || !user.active) return null;
  return sessionUserOf(user);
}

/** Formato do que `loadSessionUser` consulta — para quem já carregou a linha reaproveitar. */
export type UserComPapeis = {
  id: string;
  name: string | null;
  email: string | null;
  roles: { role: { name: string; permissions: { permission: { key: string } }[] } }[];
};

/**
 * Achata papéis e permissões no formato que o RBAC consome. Separado de `loadSessionUser`
 * para quem já trouxe o usuário numa consulta maior não precisar consultar de novo.
 *
 * `execParceiroIds` fica `null` aqui (= "todos", ou seja, não recorta): o escopo real do
 * executivo de canal é carregado no login, em `auth.ts`, a partir de `ExecParceiro`.
 */
export function sessionUserOf(user: UserComPapeis): SessionUser {
  const permissions = [...new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key)))];
  const roles = user.roles.map((ur) => ur.role.name);
  return {
    id: user.id,
    audience: "internal",
    name: user.name,
    email: user.email,
    permissions,
    roles,
    parceiroId: null,
    execParceiroIds: null,
  };
}

/**
 * Monta o `SessionUser` de um PARCEIRO a partir da tabela `parceiros`.
 *
 * Parceiro não tem papéis nem permissões do RBAC interno: `permissions` vazio e
 * `roles: ['partner']` (é o marcador que os gates e a navegação usam). `null` quando o
 * parceiro não existe, está inativo ou foi excluído (soft delete) — os três dão o mesmo
 * resultado, como no gate de login por senha.
 */
export async function loadPartnerSession(parceiroId: number): Promise<SessionUser | null> {
  const p = await prisma.parceiro.findUnique({ where: { id: BigInt(parceiroId) } });
  if (!p || !p.ativo || p.deletedAt) return null;
  return {
    id: `parceiro:${p.id}`,
    audience: "partner",
    name: p.nome,
    email: p.email,
    permissions: [],
    roles: ["partner"],
    parceiroId: Number(p.id),
    execParceiroIds: null,
  };
}
