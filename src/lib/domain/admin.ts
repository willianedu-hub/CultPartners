"use server";

// Server Actions ADMINISTRATIVAS do CultPartners — CRUD de catálogos e parceiros.
// SÓ admin (`requireInternal` + `isAdmin`). Espelha `admin.js`/`data.js` do SPA legado.
//
// Regras de segurança (obrigatórias):
//  - Toda ação exige admin. Interno não-admin e parceiro são recusados (fail-closed).
//  - `senhaHash` de Parceiro NUNCA é retornado nem logado. Senha nova → bcrypt (bcryptjs).
//  - Exclusão de parceiro é SOFT (`deletedAt` + `ativo=false`); status/produto "desativam"
//    (`ativo=false`), preservando o histórico das oportunidades vinculadas.
//  - Toda mutação passa pela auditoria (`audit`).

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireInternal, isAdmin, type SessionUser } from "@/lib/rbac";
import { audit } from "@/lib/audit";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
function done<T>(data?: T, message?: string): { ok: true; message?: string; data?: T } {
  return { ok: true, ...(data !== undefined ? { data } : {}), ...(message ? { message } : {}) };
}

const BCRYPT_ROUNDS = 10;
const idSchema = z.coerce.number().int().positive();

/** Exige admin; devolve o usuário ou lança o redirect de `requireInternal`. */
async function exigirAdmin(): Promise<SessionUser | { ok: false; error: string }> {
  const u = await requireInternal();
  if (!isAdmin(u)) return fail("Apenas administradores têm acesso a esta área.");
  return u;
}

function atorAudit(u: SessionUser) {
  return { userId: u.id, userName: u.name ?? null, userEmail: u.email ?? null };
}

function isAdminUser(x: SessionUser | { ok: false }): x is SessionUser {
  return !(typeof x === "object" && x !== null && "ok" in x && x.ok === false);
}

// ═══════════════════════════ PARCEIROS ═══════════════════════════

const partnerCreate = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(200),
  cnpj: z.string().trim().max(30).optional().nullable(),
  site: z.string().trim().max(300).optional().nullable(),
  login: z.string().trim().min(1, "Informe o login.").max(120),
  email: z.string().trim().email("E-mail inválido.").max(200).optional().or(z.literal("")).nullable(),
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres.").max(200),
});

export type PartnerCreateInput = z.input<typeof partnerCreate>;

/** Forma pública de um parceiro — SEM `senhaHash`. */
type PartnerDTO = { id: number; nome: string; cnpj: string | null; site: string | null; login: string; email: string | null; ativo: boolean };

function toPartnerDTO(p: { id: bigint; nome: string; cnpj: string | null; site: string | null; login: string; email: string | null; ativo: boolean }): PartnerDTO {
  return { id: Number(p.id), nome: p.nome, cnpj: p.cnpj, site: p.site, login: p.login, email: p.email, ativo: p.ativo };
}

const SELECT_PARCEIRO = { id: true, nome: true, cnpj: true, site: true, login: true, email: true, ativo: true } as const;

export async function createPartner(input: PartnerCreateInput): Promise<ActionResult<PartnerDTO>> {
  const u = await exigirAdmin();
  if (!isAdminUser(u)) return u;

  const parsed = partnerCreate.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const d = parsed.data;

  const senhaHash = await bcrypt.hash(d.senha, BCRYPT_ROUNDS);
  try {
    const p = await prisma.parceiro.create({
      data: {
        nome: d.nome,
        cnpj: d.cnpj || null,
        site: d.site || null,
        login: d.login,
        email: d.email || null,
        senhaHash,
      },
      select: SELECT_PARCEIRO,
    });
    await audit({
      action: "CREATE",
      entityType: "Parceiro",
      entityId: String(p.id),
      entityLabel: d.nome,
      summary: `cadastrou o parceiro “${d.nome}” (login ${d.login})`,
      // NUNCA a senha nem o hash.
      fields: { login: d.login, email: d.email || null },
      ...atorAudit(u),
    });
    revalidatePath("/parceiros");
    return done(toPartnerDTO(p), "Parceiro cadastrado.");
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Já existe um parceiro com esse login.");
    }
    throw e;
  }
}

const partnerUpdate = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(200),
  cnpj: z.string().trim().max(30).optional().nullable(),
  site: z.string().trim().max(300).optional().nullable(),
  login: z.string().trim().min(1, "Informe o login.").max(120),
  email: z.string().trim().email("E-mail inválido.").max(200).optional().or(z.literal("")).nullable(),
  // senha opcional: em branco = mantém a atual.
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres.").max(200).optional().or(z.literal("")).nullable(),
});

export type PartnerUpdateInput = z.input<typeof partnerUpdate>;

export async function updatePartner(id: number, input: PartnerUpdateInput): Promise<ActionResult<PartnerDTO>> {
  const u = await exigirAdmin();
  if (!isAdminUser(u)) return u;
  const pid = idSchema.safeParse(id);
  if (!pid.success) return fail("Parceiro inválido.");

  const parsed = partnerUpdate.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const d = parsed.data;

  const atual = await prisma.parceiro.findFirst({
    where: { id: BigInt(pid.data), deletedAt: null },
    select: { id: true, nome: true },
  });
  if (!atual) return fail("Parceiro não encontrado.");

  const data: Prisma.ParceiroUpdateInput = {
    nome: d.nome,
    cnpj: d.cnpj || null,
    site: d.site || null,
    login: d.login,
    email: d.email || null,
  };
  if (d.senha) data.senhaHash = await bcrypt.hash(d.senha, BCRYPT_ROUNDS);

  try {
    const p = await prisma.parceiro.update({ where: { id: BigInt(pid.data) }, data, select: SELECT_PARCEIRO });
    await audit({
      action: "UPDATE",
      entityType: "Parceiro",
      entityId: String(pid.data),
      entityLabel: d.nome,
      summary: `atualizou o parceiro “${d.nome}”${d.senha ? " (senha redefinida)" : ""}`,
      fields: { login: d.login, email: d.email || null, senhaAlterada: !!d.senha },
      ...atorAudit(u),
    });
    revalidatePath("/parceiros");
    return done(toPartnerDTO(p), "Parceiro atualizado.");
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Já existe um parceiro com esse login.");
    }
    throw e;
  }
}

/** Soft delete: `deletedAt` + `ativo=false`. Oportunidades vinculadas são mantidas. */
export async function softDeletePartner(id: number): Promise<ActionResult> {
  const u = await exigirAdmin();
  if (!isAdminUser(u)) return u;
  const pid = idSchema.safeParse(id);
  if (!pid.success) return fail("Parceiro inválido.");

  const atual = await prisma.parceiro.findFirst({
    where: { id: BigInt(pid.data), deletedAt: null },
    select: { id: true, nome: true },
  });
  if (!atual) return fail("Parceiro não encontrado.");

  await prisma.parceiro.update({
    where: { id: BigInt(pid.data) },
    data: { deletedAt: new Date(), ativo: false },
  });
  await audit({
    action: "DELETE",
    entityType: "Parceiro",
    entityId: String(pid.data),
    entityLabel: atual.nome,
    summary: `removeu (soft delete) o parceiro “${atual.nome}”`,
    ...atorAudit(u),
  });
  revalidatePath("/parceiros");
  return done(undefined, "Parceiro removido.");
}

/** Redefine a senha de um parceiro (bcrypt). Nunca retorna/loga o hash. */
export async function setPartnerPassword(id: number, novaSenha: string): Promise<ActionResult> {
  const u = await exigirAdmin();
  if (!isAdminUser(u)) return u;
  const pid = idSchema.safeParse(id);
  if (!pid.success) return fail("Parceiro inválido.");
  const senha = z.string().min(6, "A senha deve ter ao menos 6 caracteres.").max(200).safeParse(novaSenha);
  if (!senha.success) return fail(senha.error.issues[0]?.message ?? "Senha inválida.");

  const atual = await prisma.parceiro.findFirst({
    where: { id: BigInt(pid.data), deletedAt: null },
    select: { id: true, nome: true },
  });
  if (!atual) return fail("Parceiro não encontrado.");

  const senhaHash = await bcrypt.hash(senha.data, BCRYPT_ROUNDS);
  await prisma.parceiro.update({ where: { id: BigInt(pid.data) }, data: { senhaHash } });
  await audit({
    action: "UPDATE",
    entityType: "Parceiro",
    entityId: String(pid.data),
    entityLabel: atual.nome,
    summary: `redefiniu a senha do parceiro “${atual.nome}”`,
    ...atorAudit(u),
  });
  revalidatePath("/parceiros");
  return done(undefined, "Senha redefinida.");
}

// ═══════════════════════════ PRODUTOS ═══════════════════════════

const produtoCreate = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(200),
  categoria: z.string().trim().max(120).optional().nullable(),
  descricao: z.string().trim().max(2000).optional().nullable(),
  ordem: z.coerce.number().int().min(0).max(999).optional().nullable(),
});

export type ProdutoCreateInput = z.input<typeof produtoCreate>;
type ProdutoDTO = { id: number; nome: string; categoria: string | null; descricao: string | null; ativo: boolean; ordem: number };

export async function createProduct(input: ProdutoCreateInput): Promise<ActionResult<ProdutoDTO>> {
  const u = await exigirAdmin();
  if (!isAdminUser(u)) return u;
  const parsed = produtoCreate.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const d = parsed.data;

  try {
    const p = await prisma.produto.create({
      data: {
        nome: d.nome,
        categoria: d.categoria || null,
        descricao: d.descricao || null,
        ...(d.ordem != null ? { ordem: d.ordem } : {}),
      },
      select: { id: true, nome: true, categoria: true, descricao: true, ativo: true, ordem: true },
    });
    await audit({
      action: "CREATE",
      entityType: "Produto",
      entityId: String(p.id),
      entityLabel: d.nome,
      summary: `cadastrou o produto “${d.nome}”`,
      fields: { categoria: d.categoria || null },
      ...atorAudit(u),
    });
    revalidatePath("/oportunidades");
    return done({ ...p, id: Number(p.id) }, "Produto salvo.");
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Já existe um produto com esse nome.");
    }
    throw e;
  }
}

const produtoUpdate = produtoCreate.extend({ ativo: z.boolean().optional() });
export type ProdutoUpdateInput = z.input<typeof produtoUpdate>;

export async function updateProduct(id: number, input: ProdutoUpdateInput): Promise<ActionResult<ProdutoDTO>> {
  const u = await exigirAdmin();
  if (!isAdminUser(u)) return u;
  const pid = idSchema.safeParse(id);
  if (!pid.success) return fail("Produto inválido.");
  const parsed = produtoUpdate.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const d = parsed.data;

  const atual = await prisma.produto.findUnique({ where: { id: BigInt(pid.data) }, select: { id: true } });
  if (!atual) return fail("Produto não encontrado.");

  try {
    const p = await prisma.produto.update({
      where: { id: BigInt(pid.data) },
      data: {
        nome: d.nome,
        categoria: d.categoria || null,
        descricao: d.descricao || null,
        ...(d.ordem != null ? { ordem: d.ordem } : {}),
        ...(d.ativo != null ? { ativo: d.ativo } : {}),
      },
      select: { id: true, nome: true, categoria: true, descricao: true, ativo: true, ordem: true },
    });
    await audit({
      action: "UPDATE",
      entityType: "Produto",
      entityId: String(pid.data),
      entityLabel: d.nome,
      summary: `atualizou o produto “${d.nome}”`,
      ...atorAudit(u),
    });
    revalidatePath("/oportunidades");
    return done({ ...p, id: Number(p.id) }, "Produto atualizado.");
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Já existe um produto com esse nome.");
    }
    throw e;
  }
}

/** Desativa (não apaga) um produto — mantém as oportunidades vinculadas. */
export async function deactivateProduct(id: number): Promise<ActionResult> {
  const u = await exigirAdmin();
  if (!isAdminUser(u)) return u;
  const pid = idSchema.safeParse(id);
  if (!pid.success) return fail("Produto inválido.");

  const atual = await prisma.produto.findUnique({ where: { id: BigInt(pid.data) }, select: { id: true, nome: true } });
  if (!atual) return fail("Produto não encontrado.");

  await prisma.produto.update({ where: { id: BigInt(pid.data) }, data: { ativo: false } });
  await audit({
    action: "UPDATE",
    entityType: "Produto",
    entityId: String(pid.data),
    entityLabel: atual.nome,
    summary: `desativou o produto “${atual.nome}”`,
    ...atorAudit(u),
  });
  revalidatePath("/oportunidades");
  return done(undefined, "Produto desativado.");
}

// ═══════════════════════════ STATUS DO FUNIL ═══════════════════════════

const statusCreate = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(120),
  cor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB).").optional().nullable(),
  ordem: z.coerce.number().int().min(0).max(999).optional().nullable(),
});

export type StatusCreateInput = z.input<typeof statusCreate>;
type StatusDTO = { id: number; nome: string; cor: string; ordem: number; ativo: boolean };

export async function createStatus(input: StatusCreateInput): Promise<ActionResult<StatusDTO>> {
  const u = await exigirAdmin();
  if (!isAdminUser(u)) return u;
  const parsed = statusCreate.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const d = parsed.data;

  try {
    const s = await prisma.statusFunil.create({
      data: {
        nome: d.nome,
        ...(d.cor ? { cor: d.cor } : {}),
        ...(d.ordem != null ? { ordem: d.ordem } : {}),
      },
      select: { id: true, nome: true, cor: true, ordem: true, ativo: true },
    });
    await audit({
      action: "CREATE",
      entityType: "StatusFunil",
      entityId: String(s.id),
      entityLabel: d.nome,
      summary: `criou a etapa “${d.nome}”`,
      ...atorAudit(u),
    });
    revalidatePath("/pipeline");
    return done({ ...s, id: Number(s.id) }, "Etapa salva.");
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Já existe uma etapa com esse nome.");
    }
    throw e;
  }
}

const statusUpdate = statusCreate.extend({ ativo: z.boolean().optional() });
export type StatusUpdateInput = z.input<typeof statusUpdate>;

export async function updateStatus(id: number, input: StatusUpdateInput): Promise<ActionResult<StatusDTO>> {
  const u = await exigirAdmin();
  if (!isAdminUser(u)) return u;
  const sid = idSchema.safeParse(id);
  if (!sid.success) return fail("Etapa inválida.");
  const parsed = statusUpdate.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const d = parsed.data;

  const atual = await prisma.statusFunil.findUnique({ where: { id: BigInt(sid.data) }, select: { id: true } });
  if (!atual) return fail("Etapa não encontrada.");

  try {
    const s = await prisma.statusFunil.update({
      where: { id: BigInt(sid.data) },
      data: {
        nome: d.nome,
        ...(d.cor ? { cor: d.cor } : {}),
        ...(d.ordem != null ? { ordem: d.ordem } : {}),
        ...(d.ativo != null ? { ativo: d.ativo } : {}),
      },
      select: { id: true, nome: true, cor: true, ordem: true, ativo: true },
    });
    await audit({
      action: "UPDATE",
      entityType: "StatusFunil",
      entityId: String(sid.data),
      entityLabel: d.nome,
      summary: `atualizou a etapa “${d.nome}”`,
      ...atorAudit(u),
    });
    revalidatePath("/pipeline");
    return done({ ...s, id: Number(s.id) }, "Etapa atualizada.");
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Já existe uma etapa com esse nome.");
    }
    throw e;
  }
}

/** Reordena etapas: recebe pares {id, ordem} e grava em transação. */
export async function reorderStatus(ordens: { id: number; ordem: number }[]): Promise<ActionResult> {
  const u = await exigirAdmin();
  if (!isAdminUser(u)) return u;
  const parsed = z
    .array(z.object({ id: z.coerce.number().int().positive(), ordem: z.coerce.number().int().min(0).max(999) }))
    .min(1)
    .safeParse(ordens);
  if (!parsed.success) return fail("Ordem inválida.");

  await prisma.$transaction(
    parsed.data.map((o) =>
      prisma.statusFunil.update({ where: { id: BigInt(o.id) }, data: { ordem: o.ordem } }),
    ),
  );
  await audit({
    action: "UPDATE",
    entityType: "StatusFunil",
    entityId: null,
    summary: `reordenou as etapas do funil (${parsed.data.length} itens)`,
    fields: { ordens: parsed.data },
    ...atorAudit(u),
  });
  revalidatePath("/pipeline");
  return done(undefined, "Ordem das etapas salva.");
}

/** Desativa uma etapa (não apaga) — as oportunidades vinculadas são mantidas. */
export async function deactivateStatus(id: number): Promise<ActionResult> {
  const u = await exigirAdmin();
  if (!isAdminUser(u)) return u;
  const sid = idSchema.safeParse(id);
  if (!sid.success) return fail("Etapa inválida.");

  const atual = await prisma.statusFunil.findUnique({ where: { id: BigInt(sid.data) }, select: { id: true, nome: true } });
  if (!atual) return fail("Etapa não encontrada.");

  await prisma.statusFunil.update({ where: { id: BigInt(sid.data) }, data: { ativo: false } });
  await audit({
    action: "UPDATE",
    entityType: "StatusFunil",
    entityId: String(sid.data),
    entityLabel: atual.nome,
    summary: `desativou a etapa “${atual.nome}”`,
    ...atorAudit(u),
  });
  revalidatePath("/pipeline");
  return done(undefined, "Etapa desativada.");
}
