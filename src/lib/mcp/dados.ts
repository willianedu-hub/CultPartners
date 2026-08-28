import "server-only";

// Camada de DADOS do MCP do CultPartners — funções puras de LEITURA sobre o Prisma.
//
// Espelha o papel que, no CRM, `@/app/(app)/reports/data` e `@/lib/searchCrm` cumprem: as
// ferramentas em `tools/` não falam com o Prisma direto, elas chamam daqui. Um lugar só para
// o escopo e o enriquecimento, para tela e chat não divergirem.
//
// Três invariantes deste arquivo:
//
//  1. **Escopo SEMPRE no servidor.** Todo `where` de oportunidade passa por
//     `oportunidadeScopeWhere(user)` (admin = tudo, executivo = seus parceiros, parceiro =
//     as suas). Parceiro/tarefa herdam o mesmo recorte. Nunca por parâmetro do cliente.
//  2. **`deletedAt = null` sempre.** O soft delete do portal não pode reaparecer no chat.
//  3. **BigInt vira Number na saída.** Os ids do domínio são pequenos; `JSON.stringify`
//     quebra em BigInt cru. A conversão acontece aqui, não na ferramenta.
//
// SEGURANÇA: `senhaHash` de Parceiro (e `passwordHash` de User) NUNCA entra num `select`.
// O enriquecimento de oportunidade espelha `DB.loadOpps` do SPA legado (legacy/js/data.js).

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAdmin, oportunidadeScopeWhere, type SessionUser } from "@/lib/rbac";
import { formatBRL, reaisToCents } from "@/lib/money";

// ───────────────────────────── serialização ─────────────────────────────

/** BigInt/number pequeno → Number (nunca BigInt cru, que quebra JSON). */
export function num(x: bigint | number | null | undefined): number | null {
  if (x == null) return null;
  return typeof x === "bigint" ? Number(x) : x;
}

/** Prisma.Decimal (reais) → number, ou `null`. */
function decToReais(d: Prisma.Decimal | null | undefined): number | null {
  if (d == null) return null;
  const n = Number(d.toString());
  return Number.isFinite(n) ? n : null;
}

/** ISO de uma data, ou `null`. */
function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

// ───────────────────────────── página ─────────────────────────────

/** Máximo de registros por página. Igual ao teto de listagem do MCP (`limites.ts`). */
export const TAM_PAGINA = 50;

export type Pagina<T> = {
  itens: T[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
  temMais: boolean;
  aviso?: string;
};

function montarPagina<T>(itens: T[], total: number, pagina: number): Pagina<T> {
  const totalPaginas = Math.max(1, Math.ceil(total / TAM_PAGINA));
  const temMais = pagina < totalPaginas;
  const p: Pagina<T> = {
    itens,
    pagina,
    porPagina: TAM_PAGINA,
    total,
    totalPaginas,
    temMais,
  };
  if (temMais) {
    p.aviso =
      `RESPOSTA PARCIAL: página ${pagina} de ${totalPaginas} (${itens.length} de ${total} registros). ` +
      `Não conclua nada sobre o total a partir desta página — chame de novo com page=${pagina + 1}, ` +
      `ou reduza o escopo com filtros.`;
  }
  return p;
}

// ───────────────────────────── período ─────────────────────────────

export type Periodo = "MES" | "MES_PASSADO" | "TRIMESTRE" | "ANO" | "12M" | "TUDO";

export type Janela = { inicio: Date | null; fim: Date | null; chave: Periodo; rotulo: string };

/**
 * Traduz a chave de período numa janela `[inicio, fim)` sobre `createdAt`. `TUDO` (o padrão)
 * devolve janela aberta — o portal legado lista sem recorte de tempo.
 */
export function janelaPeriodo(periodo: Periodo = "TUDO", agora = new Date()): Janela {
  const y = agora.getFullYear();
  const m = agora.getMonth();
  switch (periodo) {
    case "MES":
      return { inicio: new Date(y, m, 1), fim: new Date(y, m + 1, 1), chave: periodo, rotulo: "Mês corrente" };
    case "MES_PASSADO":
      return { inicio: new Date(y, m - 1, 1), fim: new Date(y, m, 1), chave: periodo, rotulo: "Mês passado" };
    case "TRIMESTRE": {
      const fim = new Date(agora);
      const inicio = new Date(agora);
      inicio.setDate(inicio.getDate() - 90);
      return { inicio, fim, chave: periodo, rotulo: "Últimos 90 dias" };
    }
    case "ANO":
      return { inicio: new Date(y, 0, 1), fim: new Date(y + 1, 0, 1), chave: periodo, rotulo: "Ano corrente" };
    case "12M": {
      const fim = new Date(agora);
      const inicio = new Date(y - 1, m, agora.getDate());
      return { inicio, fim, chave: periodo, rotulo: "Últimos 12 meses" };
    }
    default:
      return { inicio: null, fim: null, chave: "TUDO", rotulo: "Todo o período" };
  }
}

function createdAtWhere(j: Janela): Prisma.OportunidadeWhereInput[] {
  if (!j.inicio && !j.fim) return [];
  return [{ createdAt: { ...(j.inicio ? { gte: j.inicio } : {}), ...(j.fim ? { lt: j.fim } : {}) } }];
}

// ───────────────────────────── escopo de parceiro ─────────────────────────────

/**
 * Ids de parceiro que o usuário alcança: `null` = todos (admin). Executivo de canal vê só os
 * seus (`execParceiroIds`); parceiro vê só a si mesmo. É o análogo de `oportunidadeScopeWhere`
 * para as entidades que não têm `parceiroId` próprio mas SÃO um parceiro (a tabela `parceiros`).
 */
export function parceiroScopeIds(user: SessionUser): number[] | null {
  if (isAdmin(user)) return null;
  if (user.audience === "partner") return user.parceiroId != null ? [user.parceiroId] : [];
  return user.execParceiroIds ?? [];
}

function parceiroScopeWhere(user: SessionUser): Prisma.ParceiroWhereInput {
  const ids = parceiroScopeIds(user);
  if (ids === null) return {};
  return { id: { in: ids.map((n) => BigInt(n)) } };
}

// ───────────────────────────── produtos por oportunidade ─────────────────────────────

/**
 * Resolve os produtos de cada oportunidade pela junção N:N `OportunidadeProduto`.
 *
 * A junção tem colunas `integer` (não bigint), então o join é por QUERY, não por relação
 * Prisma — exatamente como o SPA faz em `DB.loadOpps`. Devolve um mapa oppId→produtos, já
 * com ids convertidos para Number.
 */
async function produtosPorOpp(oppIds: number[]): Promise<Map<number, { id: number; nome: string }[]>> {
  const mapa = new Map<number, { id: number; nome: string }[]>();
  if (!oppIds.length) return mapa;

  const vinculos = await prisma.oportunidadeProduto.findMany({
    where: { oportunidadeId: { in: oppIds } },
    select: { oportunidadeId: true, produtoId: true },
  });
  if (!vinculos.length) return mapa;

  const produtoIds = [...new Set(vinculos.map((v) => v.produtoId))];
  const produtos = await prisma.produto.findMany({
    where: { id: { in: produtoIds.map((n) => BigInt(n)) } },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(produtos.map((p) => [Number(p.id), p.nome]));

  for (const v of vinculos) {
    const nome = nomePorId.get(v.produtoId);
    if (!nome) continue;
    const lista = mapa.get(v.oportunidadeId) ?? [];
    lista.push({ id: v.produtoId, nome });
    mapa.set(v.oportunidadeId, lista);
  }
  return mapa;
}

// ───────────────────────────── oportunidades ─────────────────────────────

const selecaoOpp = {
  id: true,
  empresa: true,
  cnpj: true,
  siteEmpresa: true,
  contato: true,
  cargo: true,
  obs: true,
  aprovacao: true,
  valorEstimado: true,
  fechamento: true,
  createdAt: true,
  updatedAt: true,
  produtoId: true,
  produto: { select: { id: true, nome: true } },
  status: { select: { id: true, nome: true, cor: true, ordem: true } },
  parceiro: { select: { id: true, nome: true } },
} as const;

type OppRow = Prisma.OportunidadeGetPayload<{ select: typeof selecaoOpp }> & {
  tarefas?: { concluida: boolean }[];
};

/** Forma de saída de uma oportunidade — ids em Number, valor em reais e formatado, produtos resolvidos. */
function resumoOpp(o: OppRow, produtos: { id: number; nome: string }[], tarefas: { total: number; pendentes: number }) {
  const valor = decToReais(o.valorEstimado);
  // Sem vínculos N:N, cai no produto único da própria linha (fallback do SPA legado).
  const prods =
    produtos.length > 0
      ? produtos
      : o.produto
        ? [{ id: Number(o.produto.id), nome: o.produto.nome }]
        : [];
  return {
    id: Number(o.id),
    empresa: o.empresa,
    cnpj: o.cnpj,
    siteEmpresa: o.siteEmpresa,
    contato: o.contato,
    cargo: o.cargo,
    obs: o.obs,
    aprovacao: o.aprovacao,
    status: o.status ? { id: Number(o.status.id), nome: o.status.nome, cor: o.status.cor } : null,
    parceiro: o.parceiro ? { id: Number(o.parceiro.id), nome: o.parceiro.nome } : null,
    produtos: prods,
    valorEstimado: valor,
    valorEstimadoBRL: valor != null ? formatBRL(reaisToCents(valor)) : null,
    fechamento: iso(o.fechamento),
    criadaEm: iso(o.createdAt),
    tarefas,
  };
}

export type FiltroOpps = {
  status?: string;
  aprovacao?: "Pendente" | "Aprovado" | "Rejeitado";
  parceiroId?: number;
  periodo?: Periodo;
  busca?: string;
  page?: number;
};

/**
 * Lista oportunidades no escopo do usuário, enriquecidas como em `DB.loadOpps`: produtos
 * (via junção), valor estimado, status (nome/cor), parceiro e contagem de tarefas
 * (total/pendentes). Sempre `deletedAt = null`. Paginação por página fixa de 50.
 */
export async function loadOpps(user: SessionUser, f: FiltroOpps = {}) {
  const pagina = f.page && f.page > 0 ? Math.floor(f.page) : 1;
  const janela = janelaPeriodo(f.periodo ?? "TUDO");

  const where: Prisma.OportunidadeWhereInput = {
    AND: [
      oportunidadeScopeWhere(user),
      { deletedAt: null },
      ...(f.aprovacao ? [{ aprovacao: f.aprovacao }] : []),
      // `parceiroId` do cliente é um recorte ADICIONAL dentro do escopo (o AND com
      // oportunidadeScopeWhere garante que não amplia o alcance de ninguém).
      ...(f.parceiroId != null ? [{ parceiroId: BigInt(f.parceiroId) }] : []),
      ...(f.status ? [{ status: { nome: f.status } }] : []),
      ...createdAtWhere(janela),
      ...(f.busca
        ? [
            {
              OR: [
                { empresa: { contains: f.busca, mode: "insensitive" as const } },
                { contato: { contains: f.busca, mode: "insensitive" as const } },
                { cnpj: { contains: f.busca, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.oportunidade.findMany({
      where,
      select: { ...selecaoOpp, tarefas: { select: { concluida: true } } },
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * TAM_PAGINA,
      take: TAM_PAGINA,
    }),
    prisma.oportunidade.count({ where }),
  ]);

  const mapaProdutos = await produtosPorOpp(rows.map((r) => Number(r.id)));
  const itens = rows.map((o) => {
    const ts = o.tarefas ?? [];
    return resumoOpp(o, mapaProdutos.get(Number(o.id)) ?? [], {
      total: ts.length,
      pendentes: ts.filter((t) => !t.concluida).length,
    });
  });

  return { filtro: { status: f.status ?? null, aprovacao: f.aprovacao ?? null, parceiroId: f.parceiroId ?? null, periodo: janela.chave }, ...montarPagina(itens, total, pagina) };
}

/**
 * Detalhe de UMA oportunidade, com tarefas e produtos. O escopo entra no `where`, não numa
 * checagem depois: assim "não é sua" e "não existe" respondem igual, e o id deixa de ser um
 * oráculo sobre a base. Fora do escopo → `{ encontrada: false }`.
 */
export async function getOpp(user: SessionUser, id: number) {
  const o = await prisma.oportunidade.findFirst({
    where: { AND: [oportunidadeScopeWhere(user), { id: BigInt(id) }, { deletedAt: null }] },
    select: {
      ...selecaoOpp,
      motivoRejeicao: true,
      approvedAt: true,
      rejectedAt: true,
      tarefas: {
        select: { id: true, descricao: true, prazo: true, responsavel: true, concluida: true, concluidaEm: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!o) {
    return { encontrada: false as const, motivo: "Não existe oportunidade com este id dentro do seu alcance." };
  }

  const mapaProdutos = await produtosPorOpp([Number(o.id)]);
  const tarefas = o.tarefas.map((t) => ({
    id: Number(t.id),
    descricao: t.descricao,
    prazo: iso(t.prazo),
    responsavel: t.responsavel,
    concluida: t.concluida,
    concluidaEm: iso(t.concluidaEm),
  }));
  const base = resumoOpp(o, mapaProdutos.get(Number(o.id)) ?? [], {
    total: tarefas.length,
    pendentes: tarefas.filter((t) => !t.concluida).length,
  });

  return {
    encontrada: true as const,
    ...base,
    motivoRejeicao: o.motivoRejeicao,
    aprovadaEm: iso(o.approvedAt),
    rejeitadaEm: iso(o.rejectedAt),
    tarefasDetalhe: tarefas,
  };
}

// ───────────────────────────── parceiros ─────────────────────────────

/** Parceiros ATIVOS no escopo, sem `senhaHash`. Executivo de canal vê só os seus. */
export async function listPartners(user: SessionUser) {
  const parceiros = await prisma.parceiro.findMany({
    where: { AND: [parceiroScopeWhere(user), { ativo: true }, { deletedAt: null }] },
    // `senhaHash` deliberadamente FORA do select — nunca sai deste servidor.
    select: { id: true, nome: true, cnpj: true, site: true, email: true },
    orderBy: { nome: "asc" },
  });
  return parceiros.map((p) => ({ id: Number(p.id), nome: p.nome, cnpj: p.cnpj, site: p.site, email: p.email }));
}

// ───────────────────────────── catálogos ─────────────────────────────

/** Produtos ativos, na ordem do catálogo. */
export async function listProducts() {
  const produtos = await prisma.produto.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, categoria: true, descricao: true, ordem: true },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });
  return produtos.map((p) => ({
    id: Number(p.id),
    nome: p.nome,
    categoria: p.categoria,
    descricao: p.descricao,
    ordem: p.ordem,
  }));
}

/** Etapas do funil ativas, na ordem. */
export async function listStatus() {
  const status = await prisma.statusFunil.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, cor: true, ordem: true },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });
  return status.map((s) => ({ id: Number(s.id), nome: s.nome, cor: s.cor, ordem: s.ordem }));
}

// ───────────────────────────── tarefas ─────────────────────────────

/**
 * Tarefas de uma oportunidade — SÓ se a oportunidade está no escopo. A checagem de escopo é
 * na oportunidade (a tarefa herda dela), no mesmo estilo de `getOpp`: fora do escopo →
 * `{ encontrada: false }`, sem revelar se o id existe.
 */
export async function listTasks(user: SessionUser, oportunidadeId: number) {
  const opp = await prisma.oportunidade.findFirst({
    where: { AND: [oportunidadeScopeWhere(user), { id: BigInt(oportunidadeId) }, { deletedAt: null }] },
    select: { id: true },
  });
  if (!opp) {
    return { encontrada: false as const, motivo: "Não existe oportunidade com este id dentro do seu alcance." };
  }
  const tarefas = await prisma.tarefa.findMany({
    where: { oportunidadeId: BigInt(oportunidadeId) },
    select: { id: true, descricao: true, prazo: true, responsavel: true, concluida: true, concluidaEm: true },
    orderBy: { createdAt: "asc" },
  });
  return {
    encontrada: true as const,
    oportunidadeId,
    tarefas: tarefas.map((t) => ({
      id: Number(t.id),
      descricao: t.descricao,
      prazo: iso(t.prazo),
      responsavel: t.responsavel,
      concluida: t.concluida,
      concluidaEm: iso(t.concluidaEm),
    })),
    total: tarefas.length,
    pendentes: tarefas.filter((t) => !t.concluida).length,
  };
}

// ───────────────────────────── pipeline por etapa ─────────────────────────────

/** Agrega oportunidades (não excluídas, no escopo) por etapa do funil: quantidade + soma de valor. */
export async function pipelineByStage(user: SessionUser) {
  const [etapas, opps] = await Promise.all([
    prisma.statusFunil.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, cor: true, ordem: true },
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    }),
    prisma.oportunidade.findMany({
      where: { AND: [oportunidadeScopeWhere(user), { deletedAt: null }] },
      select: { statusId: true, valorEstimado: true },
    }),
  ]);

  const agg = new Map<number, { quantidade: number; valor: number }>();
  let semEtapa = 0;
  for (const o of opps) {
    const v = decToReais(o.valorEstimado) ?? 0;
    if (o.statusId == null) {
      semEtapa++;
      continue;
    }
    const key = Number(o.statusId);
    const at = agg.get(key) ?? { quantidade: 0, valor: 0 };
    agg.set(key, { quantidade: at.quantidade + 1, valor: at.valor + v });
  }

  const linhas = etapas.map((e) => {
    const v = agg.get(Number(e.id)) ?? { quantidade: 0, valor: 0 };
    return {
      etapaId: Number(e.id),
      etapa: e.nome,
      cor: e.cor,
      ordem: e.ordem,
      quantidade: v.quantidade,
      valorEstimado: v.valor,
      valorEstimadoBRL: formatBRL(reaisToCents(v.valor)),
    };
  });

  return {
    etapas: linhas,
    totais: {
      quantidade: linhas.reduce((s, l) => s + l.quantidade, 0),
      valorEstimado: linhas.reduce((s, l) => s + l.valorEstimado, 0),
      valorEstimadoBRL: formatBRL(reaisToCents(linhas.reduce((s, l) => s + l.valorEstimado, 0))),
    },
    ...(semEtapa
      ? { semEtapa, avisoSemEtapa: `${semEtapa} oportunidade(s) sem etapa definida — não entram nas linhas acima.` }
      : {}),
  };
}

// ───────────────────────────── relatório resumo ─────────────────────────────

/**
 * Totais de prospectado/ganho/perdido e conversão (por valor e por quantidade), no escopo.
 * Espelha `renderReports` do SPA (legacy/js/reports.js): ganho = etapa "Ganho", perdido =
 * etapa "Perdido"; conversão por quantidade = ganhos / total; por valor = valor ganho / valor
 * total prospectado (só oportunidades com valor informado).
 */
export async function reportsSummary(user: SessionUser, periodo: Periodo = "TUDO") {
  const janela = janelaPeriodo(periodo);
  const opps = await prisma.oportunidade.findMany({
    where: { AND: [oportunidadeScopeWhere(user), { deletedAt: null }, ...createdAtWhere(janela)] },
    select: { valorEstimado: true, status: { select: { nome: true } } },
  });

  const total = opps.length;
  let ganhos = 0;
  let perdidos = 0;
  let valorProspectado = 0;
  let valorGanho = 0;
  let valorPerdido = 0;
  let comValor = 0;

  for (const o of opps) {
    const nome = o.status?.nome ?? null;
    const v = decToReais(o.valorEstimado);
    const ehGanho = nome === "Ganho";
    const ehPerdido = nome === "Perdido";
    if (ehGanho) ganhos++;
    if (ehPerdido) perdidos++;
    if (v != null && v > 0) {
      comValor++;
      valorProspectado += v;
      if (ehGanho) valorGanho += v;
      if (ehPerdido) valorPerdido += v;
    }
  }

  const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);

  return {
    periodo: { chave: janela.chave, rotulo: janela.rotulo, inicio: iso(janela.inicio), fimExclusivo: iso(janela.fim) },
    quantidade: {
      total,
      ganhos,
      perdidos,
      emAberto: total - ganhos - perdidos,
      conversaoPct: pct(ganhos, total),
    },
    valor: {
      oportunidadesComValor: comValor,
      prospectado: valorProspectado,
      ganho: valorGanho,
      perdido: valorPerdido,
      prospectadoBRL: formatBRL(reaisToCents(valorProspectado)),
      ganhoBRL: formatBRL(reaisToCents(valorGanho)),
      perdidoBRL: formatBRL(reaisToCents(valorPerdido)),
      conversaoPct: pct(valorGanho, valorProspectado),
    },
    observacao:
      "Ganho/Perdido pela etapa de mesmo nome no funil. Conversão por valor considera só " +
      "oportunidades com valor informado. Números valem apenas para o seu alcance.",
  };
}
