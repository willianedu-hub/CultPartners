import "server-only";

// Camada de LEITURA para dashboard e relatórios — as agregações que o SPA fazia no
// cliente (dashboard.js / reports.js), agora no servidor, sempre com escopo aplicado.
//
// Reutiliza o mesmo recorte de `oportunidadeScopeWhere` e a serialização de `dados.ts`.
// Nada aqui expõe `senhaHash`. Ids em Number; valores em reais; BRL já formatado onde
// faz sentido para a tela.
//
// As três invariantes de `dados.ts` valem também aqui: escopo no servidor,
// `deletedAt = null` sempre, BigInt → Number na saída.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAdmin, oportunidadeScopeWhere, type SessionUser } from "@/lib/rbac";
import { formatBRL, formatBRLShort, reaisToCents } from "@/lib/money";
import { janelaPeriodo, parceiroScopeIds, type Periodo } from "@/lib/mcp/dados";

// ───────────────────────────── carga base (agregação) ─────────────────────────────

/** Uma oportunidade "achatada" para agregação — o que dashboard/relatórios precisam. */
export type OppAgg = {
  id: number;
  empresa: string;
  siteEmpresa: string | null;
  cnpj: string | null;
  contato: string | null;
  parceiroId: number | null;
  parceiroNome: string | null;
  parceiroSite: string | null;
  statusId: number | null;
  statusNome: string | null;
  statusCor: string | null;
  aprovacao: "Pendente" | "Aprovado" | "Rejeitado";
  approvedAt: string | null;
  fechamento: string | null; // "YYYY-MM-DD"
  valor: number; // reais (0 quando ausente)
  produtoIds: number[];
  tarefasPendentes: number;
};

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}
function decToReais(d: Prisma.Decimal | null | undefined): number {
  if (d == null) return 0;
  const n = Number(d.toString());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Carrega TODAS as oportunidades no escopo (sem paginar) já achatadas para agregação,
 * incluindo produtos (junção N:N) e contagem de tarefas pendentes. Aceita janela de
 * período opcional sobre `createdAt` (relatórios).
 */
async function loadOppsAgg(user: SessionUser, periodo: Periodo = "TUDO"): Promise<OppAgg[]> {
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
      siteEmpresa: true,
      cnpj: true,
      contato: true,
      parceiroId: true,
      aprovacao: true,
      approvedAt: true,
      fechamento: true,
      valorEstimado: true,
      produtoId: true,
      status: { select: { id: true, nome: true, cor: true } },
      parceiro: { select: { id: true, nome: true, site: true } },
      tarefas: { select: { concluida: true } },
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
      siteEmpresa: o.siteEmpresa,
      cnpj: o.cnpj,
      contato: o.contato,
      parceiroId: o.parceiroId != null ? Number(o.parceiroId) : null,
      parceiroNome: o.parceiro?.nome ?? null,
      parceiroSite: o.parceiro?.site ?? null,
      statusId: o.status ? Number(o.status.id) : null,
      statusNome: o.status?.nome ?? null,
      statusCor: o.status?.cor ?? null,
      aprovacao: o.aprovacao,
      approvedAt: iso(o.approvedAt),
      fechamento: o.fechamento ? o.fechamento.toISOString().slice(0, 10) : null,
      valor: decToReais(o.valorEstimado),
      produtoIds,
      tarefasPendentes: (o.tarefas ?? []).filter((t) => !t.concluida).length,
    };
  });
}

// ───────────────────────────── catálogos auxiliares ─────────────────────────────

/** Etapas ativas, na ordem — para donut/tiles (inclui cor). */
async function statusOrdenados() {
  const rows = await prisma.statusFunil.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, cor: true, ordem: true },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });
  return rows.map((s) => ({ id: Number(s.id), nome: s.nome, cor: s.cor, ordem: s.ordem }));
}

/** Parceiros no escopo (sem `senhaHash`). Usado nas barras "por parceiro" (admin). */
async function parceirosNoEscopo(user: SessionUser) {
  const ids = parceiroScopeIds(user);
  const rows = await prisma.parceiro.findMany({
    where: {
      AND: [{ ativo: true }, { deletedAt: null }, ...(ids === null ? [] : [{ id: { in: ids.map((n) => BigInt(n)) } }])],
    },
    select: { id: true, nome: true, site: true },
    orderBy: { nome: "asc" },
  });
  return rows.map((p) => ({ id: Number(p.id), nome: p.nome, site: p.site }));
}

/** Produtos ativos, na ordem — para barras "por produto". */
async function produtosOrdenados() {
  const rows = await prisma.produto.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });
  return rows.map((p) => ({ id: Number(p.id), nome: p.nome }));
}

// ───────────────────────────── 60 dias sem tarefa ─────────────────────────────

const DIA_MS = 86_400_000;
function daysSince(isoDate: string | null): number {
  if (!isoDate) return 0;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / DIA_MS);
}

/** Espelha `needsTaskWarning`: aprovada, não Ganha, sem tarefa pendente, aprovada há +60d. */
function precisaAtencao(o: OppAgg): boolean {
  if (o.aprovacao !== "Aprovado") return false;
  if (o.statusNome === "Ganho") return false;
  if (o.tarefasPendentes > 0) return false;
  return daysSince(o.approvedAt) > 60;
}

/**
 * Oportunidades paradas: aprovadas há mais de 60 dias sem tarefa ativa. Ordenadas do
 * mais parado ao menos, com `dias` e severidade (>120 crítico, >90 alto). Espelha o
 * bloco de alertas do dashboard legado.
 */
export async function alertas60Dias(user: SessionUser) {
  const opps = await loadOppsAgg(user);
  const paradas = opps
    .filter(precisaAtencao)
    .map((o) => {
      const dias = daysSince(o.approvedAt);
      return {
        ...o,
        dias,
        severidade: (dias > 120 ? "critico" : dias > 90 ? "alto" : "normal") as "critico" | "alto" | "normal",
      };
    })
    .sort((a, b) => b.dias - a.dias);
  return { total: paradas.length, itens: paradas };
}

// ───────────────────────────── dashboard ─────────────────────────────

/**
 * Tudo que o dashboard precisa, em uma passada: cartões (total/andamento/ganhos/
 * pendentes), cartões financeiros (pipeline/ganhos/ticket), donut por etapa, barras
 * por parceiro (admin) ou por produto (parceiro), série por mês de fechamento, e os
 * alertas de 60 dias. Espelha `dashboard.js`.
 */
export async function dashboardData(user: SessionUser) {
  const [opps, status, parceiros, produtos] = await Promise.all([
    loadOppsAgg(user),
    statusOrdenados(),
    parceirosNoEscopo(user),
    produtosOrdenados(),
  ]);
  const admin = isAdmin(user);

  const total = opps.length;
  const emAndamento = opps.filter((o) => !["Ganho", "Perdido"].includes(o.statusNome ?? "")).length;
  const ganhos = opps.filter((o) => o.statusNome === "Ganho").length;
  const pendentes = opps.filter((o) => o.aprovacao === "Pendente").length;

  // Financeiros
  const comValor = opps.filter((o) => o.valor > 0);
  const pipeline = opps.filter((o) => !["Ganho", "Perdido"].includes(o.statusNome ?? "") && o.valor > 0);
  const ganhosComValor = opps.filter((o) => o.statusNome === "Ganho" && o.valor > 0);
  const somaPipeline = pipeline.reduce((s, o) => s + o.valor, 0);
  const somaGanhos = ganhosComValor.reduce((s, o) => s + o.valor, 0);
  const ticket = comValor.length ? comValor.reduce((s, o) => s + o.valor, 0) / comValor.length : 0;

  // Donut por etapa (na ordem do funil)
  const donut = status
    .map((st) => ({ ...st, quantidade: opps.filter((o) => o.statusNome === st.nome).length }))
    .filter((d) => d.quantidade > 0);

  // Barras: admin → por parceiro; parceiro → por produto
  let barras: { rotulo: string; site?: string | null; valor: number; refId: number | null; tipo: "parceiro" | "produto" }[];
  if (admin) {
    barras = parceiros
      .map((p) => ({ rotulo: p.nome, site: p.site, valor: opps.filter((o) => o.parceiroId === p.id).length, refId: p.id, tipo: "parceiro" as const }))
      .filter((b) => b.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  } else {
    barras = produtos
      .map((p) => ({ rotulo: p.nome, valor: opps.filter((o) => o.produtoIds.includes(p.id)).length, refId: p.id, tipo: "produto" as const }))
      .filter((b) => b.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }

  // Série por mês de fechamento (YYYY-MM)
  const meses = new Map<string, number>();
  for (const o of opps) {
    if (!o.fechamento) continue;
    const ym = o.fechamento.slice(0, 7);
    meses.set(ym, (meses.get(ym) ?? 0) + 1);
  }
  const serie = [...meses.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ym, qtd]) => ({ ym, quantidade: qtd }));

  const alertas = opps
    .filter(precisaAtencao)
    .map((o) => ({ ...o, dias: daysSince(o.approvedAt), severidade: (daysSince(o.approvedAt) > 120 ? "critico" : daysSince(o.approvedAt) > 90 ? "alto" : "normal") as "critico" | "alto" | "normal" }))
    .sort((a, b) => b.dias - a.dias);

  return {
    admin,
    cartoes: {
      total,
      emAndamento,
      ganhos,
      pendentes,
      taxaGanhoPct: total ? Math.round((ganhos / total) * 100) : 0,
    },
    financeiro: {
      pipeline: somaPipeline,
      pipelineBRL: formatBRLShort(somaPipeline),
      pipelineQtd: pipeline.length,
      ganhos: somaGanhos,
      ganhosBRL: formatBRLShort(somaGanhos),
      ganhosQtd: ganhosComValor.length,
      ticketMedio: ticket,
      ticketMedioBRL: formatBRLShort(ticket),
      comValorQtd: comValor.length,
    },
    donut,
    barras,
    serie,
    alertas: { total: alertas.length, itens: alertas },
  };
}

// ───────────────────────────── relatórios ─────────────────────────────

/**
 * Dados da página de relatórios, no escopo e período. Espelha `reports.js`: cartões de
 * ganhos/perdidos/conversão, cartões financeiros (prospectado/ganho/perdido/conv. por
 * valor), barra por produto, barra de conversão (parceiro p/ admin, produto p/ parceiro),
 * barra de valor e os tiles por etapa.
 */
export async function reportsData(user: SessionUser, periodo: Periodo = "TUDO") {
  const [opps, status, parceiros, produtos] = await Promise.all([
    loadOppsAgg(user, periodo),
    statusOrdenados(),
    parceirosNoEscopo(user),
    produtosOrdenados(),
  ]);
  const admin = isAdmin(user);
  const janela = janelaPeriodo(periodo);

  const total = opps.length;
  const ganhos = opps.filter((o) => o.statusNome === "Ganho").length;
  const perdidos = opps.filter((o) => o.statusNome === "Perdido").length;
  const taxa = total ? Math.round((ganhos / total) * 100) : 0;

  // Financeiros
  const comValor = opps.filter((o) => o.valor > 0);
  const somaTotal = comValor.reduce((s, o) => s + o.valor, 0);
  const somaGanhos = opps.filter((o) => o.statusNome === "Ganho" && o.valor > 0).reduce((s, o) => s + o.valor, 0);
  const somaPerdidos = opps.filter((o) => o.statusNome === "Perdido" && o.valor > 0).reduce((s, o) => s + o.valor, 0);
  const taxaValor = somaTotal ? Math.round((somaGanhos / somaTotal) * 100) : 0;

  // Barra por produto (quantidade)
  const barProduto = produtos
    .map((p) => ({ id: p.id, nome: p.nome, quantidade: opps.filter((o) => o.produtoIds.includes(p.id)).length }))
    .filter((b) => b.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade);

  // Conversão: admin → por parceiro; parceiro → por produto
  let conversao: { rotulo: string; site?: string | null; pct: number; refId: number; tipo: "parceiro" | "produto" }[];
  if (admin) {
    conversao = parceiros.map((p) => {
      const t = opps.filter((o) => o.parceiroId === p.id).length;
      const g = opps.filter((o) => o.parceiroId === p.id && o.statusNome === "Ganho").length;
      return { rotulo: p.nome, site: p.site, pct: t ? Math.round((g / t) * 100) : 0, refId: p.id, tipo: "parceiro" as const };
    });
  } else {
    conversao = produtos
      .filter((p) => opps.some((o) => o.produtoIds.includes(p.id)))
      .map((p) => {
        const t = opps.filter((o) => o.produtoIds.includes(p.id)).length;
        const g = opps.filter((o) => o.produtoIds.includes(p.id) && o.statusNome === "Ganho").length;
        return { rotulo: p.nome, pct: t ? Math.round((g / t) * 100) : 0, refId: p.id, tipo: "produto" as const };
      });
  }

  // Barra de valor: admin → por parceiro; parceiro → por produto
  let barValor: { rotulo: string; site?: string | null; valor: number; valorBRL: string; refId: number; tipo: "parceiro" | "produto" }[];
  if (admin) {
    barValor = parceiros
      .map((p) => ({
        rotulo: p.nome,
        site: p.site,
        valor: opps.filter((o) => o.parceiroId === p.id && o.valor > 0).reduce((s, o) => s + o.valor, 0),
        refId: p.id,
        tipo: "parceiro" as const,
      }))
      .filter((b) => b.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .map((b) => ({ ...b, valorBRL: formatBRLShort(b.valor) }));
  } else {
    barValor = produtos
      .map((p) => ({
        rotulo: p.nome,
        valor: opps.filter((o) => o.produtoIds.includes(p.id) && o.valor > 0).reduce((s, o) => s + o.valor, 0),
        refId: p.id,
        tipo: "produto" as const,
      }))
      .filter((b) => b.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .map((b) => ({ ...b, valorBRL: formatBRLShort(b.valor) }));
  }

  // Tiles por etapa
  const tiles = status.map((st) => {
    const cnt = opps.filter((o) => o.statusNome === st.nome).length;
    return { id: st.id, nome: st.nome, cor: st.cor, quantidade: cnt, pct: total ? Math.round((cnt / total) * 100) : 0 };
  });

  return {
    admin,
    periodo: { chave: janela.chave, rotulo: janela.rotulo },
    cartoes: { ganhos, perdidos, conversaoPct: taxa },
    financeiro: {
      prospectado: somaTotal,
      prospectadoBRL: formatBRLShort(somaTotal),
      comValorQtd: comValor.length,
      ganhos: somaGanhos,
      ganhosBRL: formatBRLShort(somaGanhos),
      perdidos: somaPerdidos,
      perdidosBRL: formatBRLShort(somaPerdidos),
      conversaoValorPct: taxaValor,
    },
    barProduto,
    conversao,
    barValor,
    tiles,
    totais: {
      quantidade: total,
      valorProspectadoBRL: formatBRL(reaisToCents(somaTotal)),
    },
  };
}
