import "server-only";

// Carga de LEITURA específica do drill-down do Dashboard.
//
// O `dashboardData` de `@/lib/domain/leitura` entrega as AGREGAÇÕES (cartões, donut,
// barras, série, alertas). O drill-down do painel, porém, precisa da LISTA achatada de
// oportunidades no escopo — com tudo que a `OppModal` exige para EDITAR direto do clique
// (statusId, parceiroId, produtoIds, tarefas), espelhando o `APP.opps` do SPA legado.
//
// As três invariantes valem aqui igual ao resto da leitura:
//  1. Escopo SEMPRE no servidor (`oportunidadeScopeWhere`), nunca por parâmetro do cliente.
//  2. `deletedAt = null` sempre.
//  3. BigInt → Number na saída; `senhaHash` nunca entra em nenhum `select`.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { oportunidadeScopeWhere, type SessionUser } from "@/lib/rbac";
import { formatBRL, reaisToCents } from "@/lib/money";

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}
function decToReais(d: Prisma.Decimal | null | undefined): number | null {
  if (d == null) return null;
  const n = Number(d.toString());
  return Number.isFinite(n) ? n : null;
}

export type DrillTarefa = {
  id: number;
  descricao: string | null;
  prazo: string | null;
  responsavel: string | null;
  concluida: boolean;
};

/** Oportunidade achatada para a tabela de drill E para abrir a `OppModal` em edição. */
export type DrillOpp = {
  id: number;
  empresa: string;
  siteEmpresa: string | null;
  cnpj: string | null;
  contato: string | null;
  cargo: string | null;
  obs: string | null;
  statusId: number | null;
  statusNome: string | null;
  statusCor: string | null;
  parceiroId: number | null;
  parceiroNome: string | null;
  parceiroSite: string | null;
  aprovacao: "Pendente" | "Aprovado" | "Rejeitado";
  motivoRejeicao: string | null;
  approvedAt: string | null;
  fechamento: string | null; // "YYYY-MM-DD"
  valorEstimado: number | null; // reais
  valorBRL: string | null;
  produtoIds: number[];
  produtosNomes: string[];
  tarefas: DrillTarefa[];
};

const selecao = {
  id: true,
  empresa: true,
  siteEmpresa: true,
  cnpj: true,
  contato: true,
  cargo: true,
  obs: true,
  aprovacao: true,
  motivoRejeicao: true,
  approvedAt: true,
  fechamento: true,
  valorEstimado: true,
  statusId: true,
  produtoId: true,
  status: { select: { id: true, nome: true, cor: true } },
  parceiro: { select: { id: true, nome: true, site: true } },
  produto: { select: { id: true, nome: true } },
  tarefas: {
    select: { id: true, descricao: true, prazo: true, responsavel: true, concluida: true },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

/**
 * Todas as oportunidades no escopo do usuário (não excluídas), achatadas para o drill-down.
 * Produtos resolvidos pela junção N:N (colunas Int, join por query como em `DB.loadOpps`),
 * com fallback no produto único da linha. Sem paginação — o painel opera sobre o conjunto,
 * como o SPA legado.
 */
export async function dashboardOpps(user: SessionUser): Promise<DrillOpp[]> {
  const rows = await prisma.oportunidade.findMany({
    where: { AND: [oportunidadeScopeWhere(user), { deletedAt: null }] },
    select: selecao,
    orderBy: { createdAt: "desc" },
  });

  const oppIds = rows.map((r) => Number(r.id));
  const vinculos = oppIds.length
    ? await prisma.oportunidadeProduto.findMany({
        where: { oportunidadeId: { in: oppIds } },
        select: { oportunidadeId: true, produtoId: true },
      })
    : [];
  const produtoIds = [...new Set(vinculos.map((v) => v.produtoId))];
  const catalogo = produtoIds.length
    ? await prisma.produto.findMany({
        where: { id: { in: produtoIds.map((n) => BigInt(n)) } },
        select: { id: true, nome: true },
      })
    : [];
  const nomePorId = new Map(catalogo.map((p) => [Number(p.id), p.nome]));
  const porOpp = new Map<number, { id: number; nome: string }[]>();
  for (const v of vinculos) {
    const nome = nomePorId.get(v.produtoId);
    if (!nome) continue;
    const lista = porOpp.get(v.oportunidadeId) ?? [];
    lista.push({ id: v.produtoId, nome });
    porOpp.set(v.oportunidadeId, lista);
  }

  return rows.map((o) => {
    const oid = Number(o.id);
    const daJuncao = porOpp.get(oid) ?? [];
    // Sem vínculos N:N, cai no produto único da própria linha (fallback do legado).
    const prods = daJuncao.length
      ? daJuncao
      : o.produto
        ? [{ id: Number(o.produto.id), nome: o.produto.nome }]
        : [];
    const valor = decToReais(o.valorEstimado);
    return {
      id: oid,
      empresa: o.empresa,
      siteEmpresa: o.siteEmpresa,
      cnpj: o.cnpj,
      contato: o.contato,
      cargo: o.cargo,
      obs: o.obs,
      statusId: o.statusId != null ? Number(o.statusId) : o.status ? Number(o.status.id) : null,
      statusNome: o.status?.nome ?? null,
      statusCor: o.status?.cor ?? null,
      parceiroId: o.parceiro ? Number(o.parceiro.id) : null,
      parceiroNome: o.parceiro?.nome ?? null,
      parceiroSite: o.parceiro?.site ?? null,
      aprovacao: o.aprovacao,
      motivoRejeicao: o.motivoRejeicao,
      approvedAt: iso(o.approvedAt),
      fechamento: o.fechamento ? o.fechamento.toISOString().slice(0, 10) : null,
      valorEstimado: valor,
      valorBRL: valor != null ? formatBRL(reaisToCents(valor)) : null,
      produtoIds: prods.map((p) => p.id),
      produtosNomes: prods.map((p) => p.nome),
      tarefas: o.tarefas.map((t) => ({
        id: Number(t.id),
        descricao: t.descricao,
        prazo: iso(t.prazo),
        responsavel: t.responsavel,
        concluida: t.concluida,
      })),
    };
  });
}
