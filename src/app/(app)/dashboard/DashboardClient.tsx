"use client";

// Corpo interativo do Dashboard — a ilha client do painel comercial do CultPartners.
//
// Espelha `dashboard.js` do SPA legado e o visual do dashboard do CRM:
//  - cartões de estatística (total / em andamento / ganhos / aguardando aprovação),
//    CLICÁVEIS para drill-down (como os cards do legado);
//  - cartões financeiros (pipeline / ganhos / ticket médio);
//  - donut por etapa, ranking por parceiro (admin) ou por produto (parceiro),
//    linha (área) por mês de fechamento, medidor de conversão;
//  - alerta de "paradas há +60 dias" no rodapé, com linhas que abrem a oportunidade;
//  - drill-down em modal reusando a `OppModal` para editar/aprovar/rejeitar.
//
// Todos os números chegam prontos do servidor (`dashboardData` + `dashboardOpps`), já no
// escopo da audiência. Este componente NÃO fala com o banco: escritas passam pelas Server
// Actions de `@/lib/domain/opps` (que reaplicam escopo e permissão).

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase, CircleDollarSign, Trophy, Clock, Target, Gauge, Activity,
  CalendarClock, Filter, Plus, TriangleAlert, ChevronLeft, ChevronRight,
  Check, RotateCcw, Pencil, type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/dominio/StatusBadge";
import { AprovacaoBadge } from "@/components/dominio/AprovacaoBadge";
import { OppModal, type ProdutoOpt, type StatusOpt, type ParceiroOpt } from "@/components/dominio/OppModal";
import { Donut } from "@/components/charts/Donut";
import { RankBars } from "@/components/charts/RankBars";
import { TrendArea } from "@/components/charts/TrendArea";
import { RadialGauge } from "@/components/charts/RadialGauge";
import { Sparkline } from "@/components/charts/Sparkline";
import { SERIES, STATUS } from "@/components/charts/palette";
import { approveOpp, reverterRejeicao } from "@/lib/domain/opps";
import type { DrillOpp } from "./data";

// ───────────────────────────── tipos das props ─────────────────────────────

type DonutItem = { id: number; nome: string; cor: string; quantidade: number };
type BarItem = { rotulo: string; site?: string | null; valor: number; refId: number | null; tipo: "parceiro" | "produto" };
type SerieItem = { ym: string; quantidade: number };
type AlertaItem = DrillOpp & { dias: number; severidade: "critico" | "alto" | "normal" };

export type DashboardData = {
  admin: boolean;
  cartoes: { total: number; emAndamento: number; ganhos: number; pendentes: number; taxaGanhoPct: number };
  financeiro: {
    pipeline: number; pipelineBRL: string; pipelineQtd: number;
    ganhos: number; ganhosBRL: string; ganhosQtd: number;
    ticketMedio: number; ticketMedioBRL: string; comValorQtd: number;
  };
  donut: DonutItem[];
  barras: BarItem[];
  serie: SerieItem[];
  alertas: { total: number; itens: { id: number; dias: number; severidade: "critico" | "alto" | "normal" }[] };
};

type Props = {
  data: DashboardData;
  opps: DrillOpp[];
  produtos: ProdutoOpt[];
  status: StatusOpt[];
  parceiros: ParceiroOpt[];
  isAdmin: boolean;
  audience: "internal" | "partner";
  canCreate: boolean;
};

// ───────────────────────────── helpers de formato ─────────────────────────────

const MES_CURTO = new Intl.DateTimeFormat("pt-BR", { month: "short" });
/** "YYYY-MM" → "ago/25". */
function fmtMonth(ym: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(ym);
  if (!m) return ym;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return `${MES_CURTO.format(d).replace(".", "")}/${m[1].slice(2)}`;
}
/** ISO → "DD/MM/AAAA". */
function fmtDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

// ───────────────────────────── cartões / painéis ─────────────────────────────

function Kpi({
  label, value, hint, tone = "text-text", Icon, accent = SERIES[0], spark, onClick,
}: {
  label: string; value: string | number; hint?: string; tone?: string;
  Icon?: LucideIcon; accent?: string; spark?: number[]; onClick?: () => void;
}) {
  const clickable = !!onClick;
  const base = `min-w-0 rounded-2xl border border-border bg-surface p-4 text-left shadow-[var(--shadow-sm)] transition-all ${
    clickable ? "cursor-pointer hover:border-faint/50 hover:shadow-[var(--shadow-lg)] active:translate-y-px" : ""
  }`;
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wider text-faint">{label}</div>
        {Icon && (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <div className={`break-words text-xl leading-tight font-semibold tabular-nums sm:text-2xl ${tone}`}>{value}</div>
        {spark && spark.length > 1 && <span className="hidden shrink-0 sm:block"><Sparkline data={spark} color={accent} /></span>}
      </div>
      {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
    </>
  );
  if (clickable) {
    return <button type="button" onClick={onClick} className={base}>{inner}</button>;
  }
  return <div className={base}>{inner}</div>;
}

function Panel({ title, Icon, sub, children, className = "" }: { title: string; Icon: LucideIcon; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)] ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <Icon className="h-4 w-4 text-faint" aria-hidden /> {title}
        </h2>
        {sub && <span className="shrink-0 text-[11px] text-faint">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <div className="grid h-[160px] place-items-center text-center text-sm text-faint">{text}</div>;
}

// ───────────────────────────── nome + logo ─────────────────────────────

function EntityName({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar name={name} size={size} className="text-[9px]" />
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );
}

function ProdTags({ nomes }: { nomes: string[] }) {
  if (!nomes.length) return <span className="text-faint">—</span>;
  const extra = nomes.length - 2;
  return (
    <span className="flex flex-wrap gap-1">
      {nomes.slice(0, 2).map((n) => (
        <span key={n} className="rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-muted">{n}</span>
      ))}
      {extra > 0 && <span className="rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-faint">+{extra}</span>}
    </span>
  );
}

// ───────────────────────────── componente ─────────────────────────────

export function DashboardClient({ data, opps, produtos, status, parceiros, isAdmin, audience, canCreate }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const oppById = useMemo(() => new Map(opps.map((o) => [o.id, o])), [opps]);

  // modais
  const [drill, setDrill] = useState<{ title: string; list: DrillOpp[] } | null>(null);
  const [editing, setEditing] = useState<DrillOpp | null>(null);
  const [creating, setCreating] = useState(false);

  // séries derivadas
  const sparkFechamento = data.serie.map((s) => s.quantidade);
  const donutData = data.donut.map((d) => ({ label: d.nome, value: d.quantidade, color: d.cor }));
  const rankData = data.barras.map((b) => ({ label: b.tipo === "parceiro" ? b.rotulo.split(" ")[0] : b.rotulo, value: b.valor }));
  const serieData = data.serie.map((s) => ({ label: fmtMonth(s.ym), value: s.quantidade }));
  const alertas: AlertaItem[] = data.alertas.itens
    .map((a) => {
      const full = oppById.get(a.id);
      return full ? { ...full, dias: a.dias, severidade: a.severidade } : null;
    })
    .filter((x): x is AlertaItem => x !== null);

  // drills dos cartões (espelham dashboard.js)
  function drillTotal() { setDrill({ title: "Todas as oportunidades", list: opps }); }
  function drillAndamento() { setDrill({ title: "Em andamento", list: opps.filter((o) => !["Ganho", "Perdido"].includes(o.statusNome ?? "")) }); }
  function drillGanhos() { setDrill({ title: "Ganhos", list: opps.filter((o) => o.statusNome === "Ganho") }); }
  function drillPendentes() { setDrill({ title: "Aguardando aprovação", list: opps.filter((o) => o.aprovacao === "Pendente") }); }

  function abrirEdicao(o: DrillOpp) {
    setDrill(null);
    setEditing(o);
  }

  function aoSalvar() {
    router.refresh();
  }

  const barTitle = isAdmin ? "Oportunidades por Parceiro" : "Meus Resultados por Produto";

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Dashboard</h1>
          <p className="mt-1 text-sm text-faint">Visão geral do portal de parceiros — pipeline, conversão e alertas.</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-all hover:brightness-110 active:translate-y-px max-sm:min-h-11"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Nova oportunidade</span>
            <span className="sm:hidden">Oportunidade</span>
          </button>
        )}
      </div>

      {/* Cartões de estatística (clicáveis → drill) */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total" value={data.cartoes.total} hint="Todas as etapas" Icon={Target} accent={SERIES[0]} spark={sparkFechamento} onClick={drillTotal} />
        <Kpi label="Em Andamento" value={data.cartoes.emAndamento} hint="Pipeline ativo" Icon={Activity} accent={SERIES[5]} onClick={drillAndamento} />
        <Kpi label="Ganhos" value={data.cartoes.ganhos} hint={`Taxa: ${data.cartoes.taxaGanhoPct}%`} tone="text-[color:var(--tom-bom)]" Icon={Trophy} accent={STATUS.good} onClick={drillGanhos} />
        <Kpi label="Aguard. Aprovação" value={data.cartoes.pendentes} hint="Revisão necessária" tone="text-[color:var(--tom-atencao)]" Icon={Clock} accent={STATUS.warning} onClick={drillPendentes} />
      </div>

      {/* Cartões financeiros */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Valor Pipeline" value={data.financeiro.pipelineBRL} hint={`${data.financeiro.pipelineQtd} ativa(s) com valor`} tone="text-[color:var(--accent-blue)]" Icon={CircleDollarSign} accent={SERIES[2]} />
        <Kpi label="Valor Ganhos" value={data.financeiro.ganhosBRL} hint={`${data.financeiro.ganhosQtd} negócio(s) fechado(s)`} tone="text-[color:var(--tom-bom)]" Icon={Trophy} accent={STATUS.good} />
        <Kpi label="Ticket Médio" value={data.financeiro.ticketMedioBRL} hint={`${data.financeiro.comValorQtd} com valor informado`} Icon={Gauge} accent={SERIES[4]} />
      </div>

      {/* Donut por etapa + medidor de conversão */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Oportunidades por Etapa" Icon={Filter} className="lg:col-span-2">
          {donutData.length ? (
            <Donut data={donutData} centerValue={String(data.cartoes.total)} centerLabel="oport." />
          ) : (
            <EmptyMini text="Nenhuma oportunidade no seu alcance." />
          )}
        </Panel>
        <Panel title="Taxa de conversão" Icon={Trophy}>
          <div className="flex items-center justify-center py-2">
            <RadialGauge value={data.cartoes.taxaGanhoPct} color={STATUS.good} label="ganhas" />
          </div>
        </Panel>
      </div>

      {/* Ranking por parceiro/produto + linha por mês */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title={barTitle} Icon={Briefcase} sub={data.barras.length ? "Ranking por quantidade" : undefined}>
          {rankData.length ? (
            <RankBars data={rankData} format="number" max={8} />
          ) : (
            <EmptyMini text="Sem dados para ranquear ainda." />
          )}
        </Panel>
        <Panel title="Oportunidades por mês (fechamento)" Icon={CalendarClock}>
          {serieData.length ? (
            <TrendArea data={serieData} color={SERIES[0]} format="number" height={200} />
          ) : (
            <EmptyMini text="Nenhuma previsão de fechamento informada." />
          )}
        </Panel>
      </div>

      {/* Alerta — paradas há +60 dias */}
      {alertas.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border shadow-[var(--shadow-sm)]" style={{ borderColor: "color-mix(in srgb, var(--tom-atencao) 35%, var(--border))" }}>
          <div className="flex items-start gap-3 border-b border-border bg-[color:color-mix(in_srgb,var(--tom-atencao)_10%,transparent)] px-5 py-4">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--tom-atencao) 18%, transparent)", color: "var(--tom-atencao)" }}>
              <TriangleAlert className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text">Atenção — Oportunidades Paradas</div>
              <div className="mt-0.5 text-xs text-faint">
                {alertas.length} oportunidade{alertas.length > 1 ? "s" : ""} aprovada{alertas.length > 1 ? "s" : ""} há mais de 60 dias sem tarefa ativa. Clique numa linha para agir.
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-4 py-2.5 font-semibold">Empresa</th>
                  {isAdmin && <th className="px-4 py-2.5 font-semibold">Parceiro</th>}
                  <th className="px-4 py-2.5 font-semibold">Produto</th>
                  <th className="px-4 py-2.5 font-semibold">Etapa</th>
                  <th className="px-4 py-2.5 font-semibold">Aprovado em</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Dias parado</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((o) => {
                  const tom = o.severidade === "critico" ? "var(--tom-critico)" : o.severidade === "alto" ? "var(--tom-atencao)" : "var(--faint)";
                  return (
                    <tr key={o.id} onClick={() => abrirEdicao(o)} className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-surface2" title="Clique para abrir">
                      <td className="px-4 py-2.5"><EntityName name={o.empresa} /></td>
                      {isAdmin && <td className="px-4 py-2.5">{o.parceiroNome ? <EntityName name={o.parceiroNome} /> : <span className="text-faint">—</span>}</td>}
                      <td className="px-4 py-2.5"><ProdTags nomes={o.produtosNomes} /></td>
                      <td className="px-4 py-2.5"><StatusBadge nome={o.statusNome} cor={o.statusCor} /></td>
                      <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-muted">{fmtDate(o.approvedAt)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums" style={{ color: tom, background: `color-mix(in srgb, ${tom} 14%, transparent)` }}>
                          {o.dias}d
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drill-down modal */}
      {drill && (
        <DrillModal
          title={drill.title}
          list={drill.list}
          isAdmin={isAdmin}
          pending={pending}
          onClose={() => setDrill(null)}
          onEdit={abrirEdicao}
          onApprove={(id) => startTransition(async () => {
            const r = await approveOpp(id);
            if (r.ok) { toast.success(r.message ?? "Aprovada."); setDrill(null); router.refresh(); }
            else toast.error(r.error);
          })}
          onRevert={(id) => startTransition(async () => {
            const r = await reverterRejeicao(id);
            if (r.ok) { toast.success(r.message ?? "Revertida."); setDrill(null); router.refresh(); }
            else toast.error(r.error);
          })}
        />
      )}

      {/* Modal de oportunidade (criar/editar) — reusa a fundação */}
      <OppModal
        open={creating || !!editing}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        opp={editing}
        produtos={produtos}
        status={status}
        parceiros={parceiros}
        isAdmin={isAdmin}
        audience={audience}
        onSaved={aoSalvar}
      />
    </div>
  );
}

// ───────────────────────────── drill modal ─────────────────────────────

const PAGE_SIZE = 8;

function DrillModal({
  title, list, isAdmin, pending, onClose, onEdit, onApprove, onRevert,
}: {
  title: string;
  list: DrillOpp[];
  isAdmin: boolean;
  pending: boolean;
  onClose: () => void;
  onEdit: (o: DrillOpp) => void;
  onApprove: (id: number) => void;
  onRevert: (id: number) => void;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const cur = Math.min(page, totalPages - 1);
  const view = list.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <div className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{list.length} oportunidade{list.length !== 1 ? "s" : ""} · clique numa linha para abrir</DialogDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {list.length === 0 ? (
            <div className="grid place-items-center px-5 py-16 text-center text-sm text-faint">Nenhuma oportunidade nesta seleção.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-4 py-2.5 font-semibold">Empresa</th>
                  <th className="px-4 py-2.5 font-semibold">Produto</th>
                  <th className="px-4 py-2.5 font-semibold">Etapa</th>
                  <th className="px-4 py-2.5 font-semibold">Fechamento</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Valor Est.</th>
                  {isAdmin && <th className="px-4 py-2.5 font-semibold">Parceiro</th>}
                  <th className="px-4 py-2.5 font-semibold">Aprovação</th>
                  {isAdmin && <th className="px-4 py-2.5 text-right font-semibold">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {view.map((o) => {
                  const rejeitada = o.aprovacao === "Rejeitado";
                  return (
                    <tr key={o.id} onClick={() => onEdit(o)} className={`cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-surface2 ${rejeitada ? "bg-[color:color-mix(in_srgb,var(--tom-critico)_6%,transparent)]" : ""}`} title="Clique para abrir">
                      <td className="px-4 py-2.5"><EntityName name={o.empresa} /></td>
                      <td className="px-4 py-2.5"><ProdTags nomes={o.produtosNomes} /></td>
                      <td className="px-4 py-2.5"><StatusBadge nome={o.statusNome} cor={o.statusCor} /></td>
                      <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-muted">{o.fechamento ? fmtMonth(o.fechamento) : "—"}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right font-semibold tabular-nums text-[color:var(--tom-bom)]">{o.valorBRL ?? "—"}</td>
                      {isAdmin && <td className="px-4 py-2.5">{o.parceiroNome ? <EntityName name={o.parceiroNome} /> : <span className="text-faint">—</span>}</td>}
                      <td className="px-4 py-2.5"><AprovacaoBadge aprovacao={o.aprovacao} /></td>
                      {isAdmin && (
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            {o.aprovacao === "Pendente" && (
                              <button disabled={pending} onClick={() => onApprove(o.id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white transition-colors disabled:opacity-60" style={{ background: "var(--tom-bom)" }} title="Aprovar">
                                <Check className="h-3.5 w-3.5" aria-hidden /> Aprovar
                              </button>
                            )}
                            {rejeitada && (
                              <button disabled={pending} onClick={() => onRevert(o.id)} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-semibold text-text transition-colors hover:bg-surface2 disabled:opacity-60" title="Reverter">
                                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reverter
                              </button>
                            )}
                            <button onClick={() => onEdit(o)} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text" title="Ver/editar">
                              <Pencil className="h-3.5 w-3.5" aria-hidden /> Ver
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5 text-sm">
            <span className="text-xs tabular-nums text-faint">Página {cur + 1} de {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(cur - 1)} disabled={cur <= 0} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface2 hover:text-text disabled:pointer-events-none disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <button onClick={() => setPage(cur + 1)} disabled={cur >= totalPages - 1} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface2 hover:text-text disabled:pointer-events-none disabled:opacity-40">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
