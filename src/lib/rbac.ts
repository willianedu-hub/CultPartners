import { cache } from "react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSessionRevoked, type LoginReason } from "@/lib/sessionPolicy";

/**
 * Identidade resolvida da sessão — duas audiências no mesmo formato.
 *
 *  - `internal`: admins e executivos de canal (linha em `User`). `permissions`/`roles` vêm
 *    do RBAC; `execParceiroIds` recorta os parceiros que um executivo enxerga (`null` = admin,
 *    vê tudo).
 *  - `partner`: parceiros (linha em `Parceiro`). Sem RBAC: `permissions` vazio, `roles`
 *    `['partner']`, `parceiroId` preenchido.
 */
export type SessionUser = {
  id: string;
  audience: "internal" | "partner";
  name?: string | null;
  email?: string | null;
  permissions: string[];
  roles: string[];
  /** só parceiro (BigInt do banco → number) */
  parceiroId?: number | null;
  /** executivo de canal: ids em escopo. admin/null = todos */
  execParceiroIds?: number[] | null;
  /** epoch (ms) do login que originou o token (ver sessionPolicy) */
  loginAt?: number | null;
};

/**
 * Estado do usuário interno no banco, para decidir se o token ainda vale. `cache` do React
 * dedupe a consulta dentro do mesmo render (layout + página + actions batem aqui).
 */
const userGate = cache(async (userId: string) => {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: { active: true, sessionsValidFrom: true },
    });
  } catch {
    // Banco fora do ar não deve virar logout em massa: nesse caso o token manda.
    return undefined;
  }
});

/** Gate análogo para PARCEIRO: a linha ainda está ativa e não foi excluída? */
const partnerGate = cache(async (parceiroId: number) => {
  try {
    return await prisma.parceiro.findUnique({
      where: { id: BigInt(parceiroId) },
      select: { ativo: true, deletedAt: true },
    });
  } catch {
    return undefined;
  }
});

/**
 * Por que o token não vale mais — `null` quando está tudo certo.
 *
 * O JWT é autocontido, então mudanças no banco DEPOIS que ele foi emitido só têm efeito se
 * forem checadas aqui: interno → usuário sumiu/desativado/sessões revogadas; parceiro →
 * `Parceiro` sumiu/inativo/excluído.
 */
async function sessionRejection(u: SessionUser): Promise<LoginReason | null> {
  if (u.audience === "partner") {
    if (u.parceiroId == null) return "inativa";
    const row = await partnerGate(u.parceiroId);
    if (row === undefined) return null; // falha de leitura → não derruba ninguém
    if (!row) return "inativa"; // parceiro excluído
    if (!row.ativo || row.deletedAt) return "inativa";
    return null;
  }
  const row = await userGate(u.id);
  if (row === undefined) return null; // falha de leitura → não derruba ninguém
  if (!row) return "inativa"; // usuário excluído
  if (!row.active) return "inativa";
  if (isSessionRevoked(u.loginAt, row.sessionsValidFrom)) return "encerrada";
  return null;
}

/** Exige sessão (qualquer audiência); redireciona para /login se não autenticado. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as SessionUser;
  const rejection = await sessionRejection(user);
  if (rejection) redirect(`/login?sessao=${rejection}`);
  return user;
}

/** Exige sessão INTERNA (admin/executivo). Parceiro cai no /login. */
export async function requireInternal(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.audience !== "internal") redirect("/login");
  return user;
}

/** Exige sessão de PARCEIRO. Interno cai no /login. */
export async function requirePartner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.audience !== "partner") redirect("/login");
  return user;
}

/** Usuário logado sem gate (ou `null`). Use só para leitura best-effort. */
export async function getRealUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser) ?? null;
}

export function isAdmin(user: SessionUser): boolean {
  return user.roles.includes("admin") || user.permissions.includes("admin.full");
}

export function hasPermission(user: SessionUser, key: string): boolean {
  return user.permissions.includes("admin.full") || user.permissions.includes(key);
}

/**
 * Filtro Prisma (where) para listagens de OPORTUNIDADES conforme o escopo do usuário.
 *
 *  - admin → sem recorte (`{}`).
 *  - interno executivo de canal → só os parceiros do seu escopo.
 *  - parceiro → só as suas próprias oportunidades.
 *
 * SEMPRE aplicado no servidor, nunca por parâmetro do cliente.
 */
export function oportunidadeScopeWhere(user: SessionUser): Prisma.OportunidadeWhereInput {
  if (isAdmin(user)) return {};
  if (user.audience === "partner") {
    // parceiroId ausente não deveria acontecer; -1 não casa com nenhuma linha (fail-closed).
    return { parceiroId: user.parceiroId != null ? BigInt(user.parceiroId) : BigInt(-1) };
  }
  return { parceiroId: { in: (user.execParceiroIds ?? []).map((n) => BigInt(n)) } };
}
