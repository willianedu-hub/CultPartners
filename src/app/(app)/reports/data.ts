import "server-only";

// Carga da tela de RELATÓRIOS.
//
// Duas responsabilidades:
//   1. Os AGREGADOS já vêm prontos de `reportsData` (src/lib/domain/leitura.ts) — cartões,
//      barras por produto/parceiro, conversão, valor e tiles por etapa, tudo no escopo e no
//      período. Não recalculamos nada aqui.
//   2. A lista CRUA de oportunidades no escopo/período, achatada para o DRILL-DOWN client-side
//      (mesma ideia do SPA legado, que fazia tudo sobre `APP.opps`). Escopo sempre no servidor
//      via `oportunidadeScopeWhere`; `deletedAt = null` sempre; BigInt → Number na saída.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { oportunidadeScopeWhere, type SessionUser } from "@/lib/rbac";
import { reportsData } from "@/lib/domain/leitura";
import { janelaPeriodo, type Periodo } from "@/lib/mcp/dados";

/** Uma oportunidade achatada para o drill-down (sem dado sensível). */
export type DrillOpp = {
  id: number;
  empresa: string;
  cnpj: string | null;
  parceiroId: number | null;
  parceiroNome: string | null;
  statusNome: string | null;
  statusCor: string | null;
  aprovacao: "Pendente" | "Aprovado" | "Rejeitado";
  valor: number; // reais (0 quando ausente)
  fechamento: string | null; // "YYYY-MM-DD"
  produtoIds: number[];
};

function decToReais(d: Prisma.Decimal | null | undefined): number {
  if (d == null) return 0;
  const n = Number(d.toString());
  return Number.isFinite(n) ? n : 0;
}

/** Oportunidades no escopo do usuário e na janela do período, achatadas para o drill. */
async function loadDrillOpps(user: SessionUser, periodo: Periodo): Promise<DrillOpp[]> {
  const janela = janelaPeriodo(periodo);
  const where: Prisma.OportunidadeWhereInput = {
    AND: [
      oportunidadeScopeWhere(user),
      { deletedAt: null },
      ...(janela.inicio || janela.fim
        ? [{ createdAt: { ...(janela.inicio ? { gte: janela.inicio } : {}), ...(janela.fim ? { lt: janela.fim } : {}) } }]
        : []),
    ],
  };

  const rows = await prisma.oportunidade.findMany({
    where,
    select: {
      id: true,
      empresa: true,
      cnpj: true,
      parceiroId: true,
      aprovacao: true,
      valorEstimado: true,
      fechamento: true,
      produtoId: true,
      status: { select: { nome: true, cor: true } },
      parceiro: { select: { nome: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const oppIds = rows.map((r) => Number(r.id));
  const vinculos = oppIds.length
    ? await prisma.oportunidadeProduto.findMany({
        where: { oportunidadeId: { in: oppIds } },
        select: { oportunidadeId: true, produtoId: true },
      })
    : [];
  const prodPorOpp = new Map<number, number[]>();
  for (const v of vinculos) {
    const lista = prodPorOpp.get(v.oportunidadeId) ?? [];
    lista.push(v.produtoId);
    prodPorOpp.set(v.oportunidadeId, lista);
  }

  return rows.map((o) => {
    const oid = Number(o.id);
    const produtoIds = prodPorOpp.get(oid) ?? (o.produtoId != null ? [Number(o.produtoId)] : []);
    return {
      id: oid,
      empresa: o.empresa,
      cnpj: o.cnpj,
      parceiroId: o.parceiroId != null ? Number(o.parceiroId) : null,
      parceiroNome: o.parceiro?.nome ?? null,
      statusNome: o.status?.nome ?? null,
      statusCor: o.status?.cor ?? null,
      aprovacao: o.aprovacao,
      valor: decToReais(o.valorEstimado),
      fechamento: o.fechamento ? o.fechamento.toISOString().slice(0, 10) : null,
      produtoIds,
    };
  });
}

export type ReportsView = {
  report: Awaited<ReturnType<typeof reportsData>>;
  opps: DrillOpp[];
};

/** Agregados (leitura.ts) + lista crua para o drill, no mesmo escopo/período. */
export async function getReportsView(user: SessionUser, periodo: Periodo): Promise<ReportsView> {
  const [report, opps] = await Promise.all([reportsData(user, periodo), loadDrillOpps(user, periodo)]);
  return { report, opps };
}
