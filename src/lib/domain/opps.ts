"use server";

// Server Actions de ESCRITA de OPORTUNIDADES + tarefas + produtos do CultPartners.
//
// Espelha as regras do SPA legado (legacy/js/{ops,data}.js), mas com o escopo aplicado
// SEMPRE no servidor (nunca por parâmetro do cliente) e auditoria em cada mutação.
//
// Invariantes deste arquivo:
//
//  1. **Escopo server-side.** Antes de qualquer escrita, a oportunidade é buscada por
//     `findFirst({ where: AND(oportunidadeScopeWhere(user), id, deletedAt:null) })`.
//     Fora do escopo → responde igual a "não existe" (o id não vira oráculo da base).
//  2. **Parceiro só mexe no que é seu.** Na criação/edição o `parceiroId` é FORÇADO para
//     `user.parceiroId` — o valor que vier do cliente é ignorado.
//  3. **Executivo de canal é somente-leitura.** Ele lê no escopo de `execParceiroIds`,
//     mas não cria/edita/aprova (fail-closed).
//  4. **Aprovar/rejeitar/reverter = SÓ admin** (`isAdmin`).
//  5. **Soft delete apenas** (`deletedAt`), nunca hard delete.
//  6. **BigInt nunca vaza** para o cliente: os retornos usam Number.
//
// NOTA sobre `approvedBy`/`rejectedBy` (colunas BigInt do schema legado): os aprovadores
// hoje são usuários internos (`User`, id = cuid string), que não têm id BigInt. Por isso
// gravamos `approvedAt`/`rejectedAt` e registramos o ATOR (nome/email/id cuid) na trilha
// de auditoria; `approvedBy`/`rejectedBy` ficam nulos por impossibilidade de tipo.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, isAdmin, oportunidadeScopeWhere, type SessionUser } from "@/lib/rbac";
import { audit } from "@/lib/audit";

// ───────────────────────────── resultado padrão ─────────────────────────────

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
function done<T>(data?: T, message?: string): { ok: true; message?: string; data?: T } {
  return { ok: true, ...(data !== undefined ? { data } : {}), ...(message ? { message } : {}) };
}

/** Rotas que dependem de oportunidades — revalidadas após cada mutação. */
function revalidarOpps() {
  for (const p of ["/dashboard", "/oportunidades", "/pipeline", "/relatorios", "/tarefas"]) {
    revalidatePath(p);
  }
}

function atorAudit(u: SessionUser) {
  return { userId: u.id, userName: u.name ?? null, userEmail: u.email ?? null };
}

// ───────────────────────────── permissão de escrita ─────────────────────────────

/**
 * Quem pode ESCREVER em oportunidade: admin (qualquer parceiro) e parceiro (só o seu).
 * Executivo de canal é somente-leitura → recusado aqui.
 */
function podeEscrever(u: SessionUser): boolean {
  return isAdmin(u) || u.audience === "partner";
}

/**
 * Confirma que a oportunidade `id` existe DENTRO do escopo do usuário e não está excluída.
 * Devolve a linha mínima (id, parceiroId, aprovacao, empresa) ou `null`.
 */
async function oppNoEscopo(u: SessionUser, id: number) {
  return prisma.oportunidade.findFirst({
    where: { AND: [oportunidadeScopeWhere(u), { id: BigInt(id) }, { deletedAt: null }] },
    select: { id: true, parceiroId: true, aprovacao: true, empresa: true, statusId: true },
  });
}

// ───────────────────────────── validação ─────────────────────────────

const idSchema = z.coerce.number().int().positive();

const oppInput = z.object({
  empresa: z.string().trim().min(1, "Informe a empresa.").max(200),
  cnpj: z.string().trim().max(30).optional().nullable(),
  siteEmpresa: z.string().trim().max(300).optional().nullable(),
  contato: z.string().trim().min(1, "Informe o contato.").max(200),
  cargo: z.string().trim().max(120).optional().nullable(),
  obs: z.string().trim().max(4000).optional().nullable(),
  statusId: z.coerce.number().int().positive("Selecione a etapa."),
  // month input "YYYY-MM" → primeiro dia do mês; ou "" / null.
  fechamento: z.string().trim().optional().nullable(),
  valorEstimado: z.union([z.number(), z.string()]).optional().nullable(),
  // Só usado quando admin; parceiro tem o seu forçado.
  parceiroId: z.coerce.number().int().positive().optional().nullable(),
  produtoIds: z.array(z.coerce.number().int().positive()).optional().default([]),
});

export type OppInput = z.input<typeof oppInput>;

/** "YYYY-MM" (month) → Date no dia 1 (UTC). Vazio/erro → null. */
function monthToDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(v.trim());
  if (!m) {
    // aceita "YYYY-MM-DD" também
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
}

/** valor em reais → Prisma.Decimal-compatible (number) ou null. */
function valorToDecimal(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ───────────────────────────── checkDuplicate ─────────────────────────────

/**
 * Procura oportunidade duplicada por empresa (nome igual, case-insensitive) OU CNPJ
 * (14 dígitos iguais), dentro do escopo do usuário e ignorando `excludeId`. Espelha
 * `DB.checkDuplicate` do SPA. Devolve a duplicata (com parceiro) ou `null`.
 */
export async function checkDuplicate(
  empresa: string,
  cnpj: string,
  excludeId?: number | null,
): Promise<ActionResult<{ id: number; empresa: string; cnpj: string | null; parceiroId: number | null; parceiroNome: string | null } | null>> {
  const u = await requireUser();
  const emp = (empresa ?? "").trim();
  const cnpjDigits = (cnpj ?? "").replace(/\D/g, "");
  if (!emp && cnpjDigits.length < 14) return done<null>(null);

  const or: Prisma.OportunidadeWhereInput[] = [];
  if (emp) or.push({ empresa: { equals: emp, mode: "insensitive" } });
  if (cnpjDigits.length >= 14) or.push({ cnpj: { contains: cnpjDigits } });
  if (!or.length) return done<null>(null);

  const linhas = await prisma.oportunidade.findMany({
    where: {
      AND: [
        oportunidadeScopeWhere(u),
        { deletedAt: null },
        ...(excludeId ? [{ id: { not: BigInt(excludeId) } }] : []),
        { OR: or },
      ],
    },
    select: { id: true, empresa: true, cnpj: true, parceiroId: true, parceiro: { select: { nome: true } } },
    take: 20,
  });

  // Confirma o CNPJ pelos dígitos (o `contains` é aproximado por causa de máscara).
  const hit = linhas.find((o) => {
    const matchE = emp && o.empresa.toLowerCase() === emp.toLowerCase();
    const matchC = cnpjDigits.length >= 14 && (o.cnpj || "").replace(/\D/g, "") === cnpjDigits;
    return matchE || matchC;
  });
  if (!hit) return done<null>(null);
  return done({
    id: Number(hit.id),
    empresa: hit.empresa,
    cnpj: hit.cnpj,
    parceiroId: hit.parceiroId != null ? Number(hit.parceiroId) : null,
    parceiroNome: hit.parceiro?.nome ?? null,
  });
}

// ───────────────────────────── createOpp ─────────────────────────────

export async function createOpp(input: OppInput): Promise<ActionResult<{ id: number }>> {
  const u = await requireUser();
  if (!podeEscrever(u)) return fail("Você não tem permissão para criar oportunidades.");

  const parsed = oppInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const d = parsed.data;

  // parceiroId: parceiro tem o SEU forçado; admin escolhe (obrigatório).
  let parceiroId: number | null;
  if (u.audience === "partner") {
    if (u.parceiroId == null) return fail("Sessão sem parceiro associado.");
    parceiroId = u.parceiroId;
  } else {
    if (d.parceiroId == null) return fail("Selecione o parceiro.");
    parceiroId = d.parceiroId;
  }

  if (!d.produtoIds.length) return fail("Selecione pelo menos um produto/serviço.");

  const valor = valorToDecimal(d.valorEstimado);
  const created = await prisma.oportunidade.create({
    data: {
      empresa: d.empresa,
      cnpj: d.cnpj || null,
      siteEmpresa: d.siteEmpresa || null,
      contato: d.contato,
      cargo: d.cargo || null,
      obs: d.obs || null,
      statusId: BigInt(d.statusId),
      fechamento: monthToDate(d.fechamento),
      valorEstimado: valor,
      parceiroId: BigInt(parceiroId),
      produtoId: BigInt(d.produtoIds[0]), // produto "principal" (fallback do legado)
      aprovacao: "Pendente",
    },
    select: { id: true },
  });

  // Produtos N:N (colunas Int).
  await gravarProdutos(Number(created.id), d.produtoIds);

  await audit({
    action: "CREATE",
    entityType: "Oportunidade",
    entityId: String(created.id),
    entityLabel: d.empresa,
    summary: `criou a oportunidade “${d.empresa}” (aguardando aprovação)`,
    fields: { statusId: d.statusId, parceiroId, produtoIds: d.produtoIds, valorEstimado: valor },
    ...atorAudit(u),
  });
  revalidarOpps();
  return done({ id: Number(created.id) }, "Oportunidade registrada. Aguardando aprovação.");
}

// ───────────────────────────── updateOpp ─────────────────────────────

export async function updateOpp(id: number, input: OppInput): Promise<ActionResult> {
  const u = await requireUser();
  if (!podeEscrever(u)) return fail("Você não tem permissão para editar oportunidades.");

  const oppId = idSchema.safeParse(id);
  if (!oppId.success) return fail("Oportunidade inválida.");

  const atual = await oppNoEscopo(u, oppId.data);
  if (!atual) return fail("Oportunidade não encontrada no seu alcance.");

  const parsed = oppInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const d = parsed.data;

  // Parceiro NUNCA muda o dono; admin pode reatribuir.
  let parceiroId: bigint | null = atual.parceiroId;
  if (u.audience === "partner") {
    parceiroId = u.parceiroId != null ? BigInt(u.parceiroId) : atual.parceiroId;
  } else if (d.parceiroId != null) {
    parceiroId = BigInt(d.parceiroId);
  }

  const valor = valorToDecimal(d.valorEstimado);
  await prisma.oportunidade.update({
    where: { id: BigInt(oppId.data) },
    data: {
      empresa: d.empresa,
      cnpj: d.cnpj || null,
      siteEmpresa: d.siteEmpresa || null,
      contato: d.contato,
      cargo: d.cargo || null,
      obs: d.obs || null,
      statusId: BigInt(d.statusId),
      fechamento: monthToDate(d.fechamento),
      valorEstimado: valor,
      parceiroId,
      ...(d.produtoIds.length ? { produtoId: BigInt(d.produtoIds[0]) } : {}),
    },
  });

  if (d.produtoIds.length) await gravarProdutos(oppId.data, d.produtoIds);

  await audit({
    action: "UPDATE",
    entityType: "Oportunidade",
    entityId: String(oppId.data),
    entityLabel: d.empresa,
    summary: `editou a oportunidade “${d.empresa}”`,
    fields: { statusId: d.statusId, produtoIds: d.produtoIds, valorEstimado: valor },
    ...atorAudit(u),
  });
  revalidarOpps();
  return done(undefined, "Oportunidade atualizada.");
}

// ───────────────────────────── aprovação (SÓ admin) ─────────────────────────────

export async function approveOpp(id: number): Promise<ActionResult> {
  const u = await requireUser();
  if (!isAdmin(u)) return fail("Apenas administradores podem aprovar.");
  const oppId = idSchema.safeParse(id);
  if (!oppId.success) return fail("Oportunidade inválida.");

  const atual = await oppNoEscopo(u, oppId.data);
  if (!atual) return fail("Oportunidade não encontrada.");

  await prisma.oportunidade.update({
    where: { id: BigInt(oppId.data) },
    data: {
      aprovacao: "Aprovado",
      approvedAt: new Date(),
      // approvedBy é BigInt (id legado); usuário interno é cuid → registrado na auditoria.
      approvedBy: null,
      motivoRejeicao: null,
      rejectedAt: null,
      rejectedBy: null,
    },
  });
  await audit({
    action: "UPDATE",
    entityType: "Oportunidade",
    entityId: String(oppId.data),
    entityLabel: atual.empresa,
    summary: `aprovou a oportunidade “${atual.empresa}”`,
    meta: { aprovacao: "Aprovado", aprovadoPor: u.name ?? u.email ?? u.id },
    ...atorAudit(u),
  });
  revalidarOpps();
  return done(undefined, "Oportunidade aprovada.");
}

export async function rejectOpp(id: number, motivo: string): Promise<ActionResult> {
  const u = await requireUser();
  if (!isAdmin(u)) return fail("Apenas administradores podem rejeitar.");
  const oppId = idSchema.safeParse(id);
  if (!oppId.success) return fail("Oportunidade inválida.");
  const razao = (motivo ?? "").trim();
  if (!razao) return fail("Informe o motivo da rejeição.");
  if (razao.length > 2000) return fail("Motivo muito longo.");

  const atual = await oppNoEscopo(u, oppId.data);
  if (!atual) return fail("Oportunidade não encontrada.");

  await prisma.oportunidade.update({
    where: { id: BigInt(oppId.data) },
    data: {
      aprovacao: "Rejeitado",
      motivoRejeicao: razao,
      rejectedAt: new Date(),
      rejectedBy: null, // cuid não cabe em BigInt — ator vai na auditoria
    },
  });
  await audit({
    action: "UPDATE",
    entityType: "Oportunidade",
    entityId: String(oppId.data),
    entityLabel: atual.empresa,
    summary: `rejeitou a oportunidade “${atual.empresa}”`,
    meta: { aprovacao: "Rejeitado", motivo: razao, rejeitadoPor: u.name ?? u.email ?? u.id },
    ...atorAudit(u),
  });
  revalidarOpps();
  return done(undefined, "Oportunidade rejeitada.");
}

/** Reverte uma rejeição para Pendente (SÓ admin). Espelha o "↩ Reverter" do SPA. */
export async function reverterRejeicao(id: number): Promise<ActionResult> {
  const u = await requireUser();
  if (!isAdmin(u)) return fail("Apenas administradores podem reverter.");
  const oppId = idSchema.safeParse(id);
  if (!oppId.success) return fail("Oportunidade inválida.");

  const atual = await oppNoEscopo(u, oppId.data);
  if (!atual) return fail("Oportunidade não encontrada.");
  if (atual.aprovacao !== "Rejeitado") return fail("Só é possível reverter uma rejeição.");

  await prisma.oportunidade.update({
    where: { id: BigInt(oppId.data) },
    data: { aprovacao: "Pendente", motivoRejeicao: null, rejectedAt: null, rejectedBy: null },
  });
  await audit({
    action: "REVERT",
    entityType: "Oportunidade",
    entityId: String(oppId.data),
    entityLabel: atual.empresa,
    summary: `reverteu a rejeição da oportunidade “${atual.empresa}” (volta a Pendente)`,
    meta: { revertidoPor: u.name ?? u.email ?? u.id },
    ...atorAudit(u),
  });
  revalidarOpps();
  return done(undefined, "Rejeição revertida — voltou para Pendente.");
}

// ───────────────────────────── moveOppStatus (kanban) ─────────────────────────────

export async function moveOppStatus(id: number, statusId: number): Promise<ActionResult> {
  const u = await requireUser();
  if (!podeEscrever(u)) return fail("Você não tem permissão para mover oportunidades.");
  const oppId = idSchema.safeParse(id);
  const stId = idSchema.safeParse(statusId);
  if (!oppId.success || !stId.success) return fail("Dados inválidos.");

  const atual = await oppNoEscopo(u, oppId.data);
  if (!atual) return fail("Oportunidade não encontrada no seu alcance.");

  const status = await prisma.statusFunil.findFirst({
    where: { id: BigInt(stId.data), ativo: true },
    select: { id: true, nome: true },
  });
  if (!status) return fail("Etapa inválida.");

  await prisma.oportunidade.update({
    where: { id: BigInt(oppId.data) },
    data: { statusId: BigInt(stId.data) },
  });
  await audit({
    action: "UPDATE",
    entityType: "Oportunidade",
    entityId: String(oppId.data),
    entityLabel: atual.empresa,
    summary: `moveu “${atual.empresa}” para a etapa “${status.nome}”`,
    fields: { statusId: Number(status.id) },
    ...atorAudit(u),
  });
  revalidarOpps();
  return done(undefined, `Movida para “${status.nome}”.`);
}

// ───────────────────────────── saveOppProducts ─────────────────────────────

/** Grava a junção N:N (delete + insert). Colunas Int. Interno da criação/edição. */
async function gravarProdutos(oppId: number, produtoIds: number[]) {
  const ids = [...new Set(produtoIds.filter((n) => Number.isInteger(n) && n > 0))];
  await prisma.oportunidadeProduto.deleteMany({ where: { oportunidadeId: oppId } });
  if (ids.length) {
    await prisma.oportunidadeProduto.createMany({
      data: ids.map((pid) => ({ oportunidadeId: oppId, produtoId: pid })),
      skipDuplicates: true,
    });
  }
}

/**
 * Substitui os produtos de uma oportunidade (delete + insert em `oportunidade_produtos`).
 * Aplica escopo: a oportunidade precisa estar no alcance de quem escreve.
 */
export async function saveOppProducts(oppId: number, produtoIds: number[]): Promise<ActionResult> {
  const u = await requireUser();
  if (!podeEscrever(u)) return fail("Você não tem permissão para isso.");
  const id = idSchema.safeParse(oppId);
  if (!id.success) return fail("Oportunidade inválida.");

  const atual = await oppNoEscopo(u, id.data);
  if (!atual) return fail("Oportunidade não encontrada no seu alcance.");

  const parsed = z.array(z.coerce.number().int().positive()).safeParse(produtoIds ?? []);
  if (!parsed.success) return fail("Produtos inválidos.");

  await gravarProdutos(id.data, parsed.data);
  await audit({
    action: "UPDATE",
    entityType: "Oportunidade",
    entityId: String(id.data),
    entityLabel: atual.empresa,
    summary: `atualizou os produtos da oportunidade “${atual.empresa}”`,
    fields: { produtoIds: parsed.data },
    ...atorAudit(u),
  });
  revalidarOpps();
  return done(undefined, "Produtos atualizados.");
}

// ───────────────────────────── saveTasks (diff) ─────────────────────────────

const tarefaInput = z.object({
  // number = existe no banco; string ("new_...") ou ausente = nova.
  id: z.union([z.number(), z.string()]).optional().nullable(),
  descricao: z.string().trim().min(1).max(1000),
  prazo: z.string().trim().optional().nullable(),
  responsavel: z.string().trim().max(200).optional().nullable(),
  concluida: z.boolean().optional().default(false),
});

export type TarefaInput = z.input<typeof tarefaInput>;

function prazoToDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Sincroniza as tarefas de uma oportunidade por DIFF — como `DB.saveTasks` do legado:
 *  - id numérico → tarefa existente: atualiza;
 *  - id ausente/string → tarefa nova: insere;
 *  - tarefas no banco que não estão mais na lista: removidas.
 * Escopo aplicado na oportunidade (a tarefa herda dela).
 */
export async function saveTasks(oppId: number, tarefas: TarefaInput[]): Promise<ActionResult> {
  const u = await requireUser();
  if (!podeEscrever(u)) return fail("Você não tem permissão para isso.");
  const id = idSchema.safeParse(oppId);
  if (!id.success) return fail("Oportunidade inválida.");

  const atual = await oppNoEscopo(u, id.data);
  if (!atual) return fail("Oportunidade não encontrada no seu alcance.");

  const parsed = z.array(tarefaInput).safeParse(tarefas ?? []);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Tarefas inválidas.");
  const lista = parsed.data;

  const existentes = lista.filter((t) => typeof t.id === "number") as (TarefaInput & { id: number })[];
  const novas = lista.filter((t) => typeof t.id !== "number");

  // Ids que estão HOJE no banco para esta oportunidade.
  const doBanco = await prisma.tarefa.findMany({
    where: { oportunidadeId: BigInt(id.data) },
    select: { id: true },
  });
  const idsBanco = doBanco.map((t) => Number(t.id));
  const idsManter = existentes.map((t) => Number(t.id));
  const idsRemover = idsBanco.filter((x) => !idsManter.includes(x));

  await prisma.$transaction(async (tx) => {
    if (idsRemover.length) {
      await tx.tarefa.deleteMany({ where: { id: { in: idsRemover.map((n) => BigInt(n)) } } });
    }
    for (const t of existentes) {
      // Só atualiza se a tarefa realmente pertence a esta oportunidade (fail-closed).
      await tx.tarefa.updateMany({
        where: { id: BigInt(t.id), oportunidadeId: BigInt(id.data) },
        data: {
          descricao: t.descricao,
          prazo: prazoToDate(t.prazo),
          responsavel: t.responsavel || null,
          concluida: !!t.concluida,
          concluidaEm: t.concluida ? new Date() : null,
        },
      });
    }
    if (novas.length) {
      await tx.tarefa.createMany({
        data: novas.map((t) => ({
          oportunidadeId: BigInt(id.data),
          descricao: t.descricao,
          prazo: prazoToDate(t.prazo),
          responsavel: t.responsavel || null,
          concluida: !!t.concluida,
          concluidaEm: t.concluida ? new Date() : null,
        })),
      });
    }
  });

  await audit({
    action: "UPDATE",
    entityType: "Oportunidade",
    entityId: String(id.data),
    entityLabel: atual.empresa,
    summary: `atualizou as tarefas da oportunidade “${atual.empresa}”`,
    meta: { total: lista.length, inseridas: novas.length, removidas: idsRemover.length },
    ...atorAudit(u),
  });
  revalidarOpps();
  return done(undefined, "Tarefas salvas.");
}

// ───────────────────────────── softDeleteOpp ─────────────────────────────

export async function softDeleteOpp(id: number): Promise<ActionResult> {
  const u = await requireUser();
  if (!podeEscrever(u)) return fail("Você não tem permissão para excluir.");
  const oppId = idSchema.safeParse(id);
  if (!oppId.success) return fail("Oportunidade inválida.");

  const atual = await oppNoEscopo(u, oppId.data);
  if (!atual) return fail("Oportunidade não encontrada no seu alcance.");

  await prisma.oportunidade.update({
    where: { id: BigInt(oppId.data) },
    data: { deletedAt: new Date() },
  });
  await audit({
    action: "DELETE",
    entityType: "Oportunidade",
    entityId: String(oppId.data),
    entityLabel: atual.empresa,
    summary: `excluiu (soft delete) a oportunidade “${atual.empresa}”`,
    ...atorAudit(u),
  });
  revalidarOpps();
  return done(undefined, "Oportunidade removida.");
}
