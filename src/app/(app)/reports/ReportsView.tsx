"use client";

// Tela de RELATÓRIOS (client island). Espelha `legacy/js/reports.js` e o visual do CRM:
//   · cartões de Ganhos / Perdidos / Conversão;
//   · cartões financeiros (prospectado / valor ganho / valor perdido / conversão por valor);
//   · barras por produto, conversão (parceiro p/ admin, produto p/ parceiro) e valor;
//   · Donut + tiles por etapa;
//   · DRILL-DOWN: clicar em qualquer cartão/barra/etapa abre a lista das oportunidades por trás.
//
// Os NÚMEROS chegam prontos de `reportsData` (leitura.ts, escopo aplicado no servidor). A
// lista crua (`opps`) serve só para montar o drill — nenhum recálculo de métrica acontece aqui.

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Donut } from "@/components/charts/Donut";
import { SERIES } from "@/components/charts/palette";
import { StatusBadge } from "@/components/dominio/StatusBadge";
import { AprovacaoBadge } from "@/components/dominio/AprovacaoBadge";
import { formatBRLShort } from "@/lib/money";
import type { ReportsView as ViewData, DrillOpp } from "./data";

// Chaves de período: mesmas de `janelaPeriodo` (src/lib/mcp/dados.ts).
const PERIODOS: { key: string; label: string }[] = [
  { key: "MES", label: "Mês" },
  { key: "MES_PASSADO", label: "Mês passado" },
  { key: "TRIMESTRE", label: "90 dias" },
  { key: "ANO", label: "Ano" },
  { key: "12M", label: "12 meses" },
  { key: "TUDO", label: "Tudo" },
];

const chip = "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors max-sm:min-h-9 max-sm:px-3";
const chipOn = "border-transparent bg-[color:var(--accent)] text-white";
const chipOff = "border-border text-muted hover:bg-surface2";

// ───────────────────────────── cartões ─────────────────────────────

function StatCard({
  label,
  value,
  sub,
  cor,
  onClick,
}: {
  label: string;
  value: string | number;
  sub: string;
  cor: string;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      style={{ borderTopColor: cor }}
      className={`min-w-0 rounded-2xl border border-t-4 border-border bg-surface p-4 text-left shadow-[var(--shadow-sm)] transition-all ${
        clickable ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]" : "cursor-default"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</div>
      <div className="mt-1 break-words text-2xl font-semibold leading-tight tabular-nums" style={{ color: cor }}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-faint">{sub}</div>
    </button>
  );
}

// ───────────────────────────── barras (clicáveis) ─────────────────────────────

type BarRow = { rotulo: string; valor: number; rightLabel: string; onClick?: () => void };

function Bars({ rows, empty }: { rows: BarRow[]; empty: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const topo = Math.max(1, ...rows.map((r) => r.valor));
  if (!rows.length) {
    return <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-faint">{empty}</div>;
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => {
        const pct = (r.valor / topo) * 100;
        const ativo = hover === i;
        const cor = SERIES[i % SERIES.length];
        return (
          <li key={`${r.rotulo}-${i}`} className="min-w-0" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <button
              type="button"
              onClick={r.onClick}
              disabled={!r.onClick}
              className={`w-full text-left ${r.onClick ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-xs text-muted" title={r.rotulo}>
                  {r.rotulo}
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-text">{r.rightLabel}</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-field">
                <div
                  className="h-2 rounded-full transition-all duration-150"
                  style={{ width: `${Math.max(2, pct)}%`, background: cor, opacity: hover === null || ativo ? 1 : 0.55 }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ───────────────────────────── card wrapper ─────────────────────────────

function Card({ title, sub, wide, children }: { title: string; sub?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)] ${wide ? "xl:col-span-2" : ""}`}>
      <header className="mb-4">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
      </header>
      {children}
    </section>
  );
}

// ───────────────────────────── drill-down ─────────────────────────────

function DrillModal({
  titulo,
  opps,
  admin,
  onClose,
}: {
  titulo: string;
  opps: DrillOpp[];
  admin: boolean;
  onClose: () => void;
}) {
  const soma = opps.reduce((s, o) => s + o.valor, 0);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <div className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {opps.length} oportunidade{opps.length !== 1 ? "s" : ""}
            {soma > 0 ? ` · ${formatBRLShort(soma)} em valor estimado` : ""}
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {opps.length === 0 ? (
            <p className="py-8 text-center text-xs text-faint">Nenhuma oportunidade neste recorte.</p>
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Empresa</th>
                    {admin && <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Parceiro</th>}
                    <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Etapa</th>
                    <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Aprovação</th>
                    <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-faint">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {opps.map((o) => (
                    <tr key={o.id} className="border-b border-border/60 last:border-0 hover:bg-surface2/40">
                      <td className="px-2 py-2 font-medium text-text">{o.empresa}</td>
                      {admin && <td className="px-2 py-2 text-muted">{o.parceiroNome ?? "—"}</td>}
                      <td className="px-2 py-2">
                        <StatusBadge nome={o.statusNome} cor={o.statusCor} />
                      </td>
                      <td className="px-2 py-2">
                        <AprovacaoBadge aprovacao={o.aprovacao} />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted">{o.valor > 0 ? formatBRLShort(o.valor) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── principal ─────────────────────────────

export function ReportsView({ data, periodo }: { data: ViewData; periodo: string }) {
  const { report, opps } = data;
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [drill, setDrill] = useState<{ titulo: string; opps: DrillOpp[] } | null>(null);

  const admin = report.admin;

  function irPeriodo(key: string) {
    const p = new URLSearchParams(sp.toString());
    if (key === "TUDO") p.delete("periodo");
    else p.set("periodo", key);
    startTransition(() => router.push(`/reports?${p.toString()}`, { scroll: false }));
  }

  const abrirDrill = (titulo: string, filtro: (o: DrillOpp) => boolean) => setDrill({ titulo, opps: opps.filter(filtro) });

  const { cartoes, financeiro, barProduto, conversao, barValor, tiles } = report;

  // Donut por etapa (só etapas com contagem > 0).
  const donutSlices = useMemo(
    () => tiles.filter((t) => t.quantidade > 0).map((t) => ({ label: t.nome, value: t.quantidade, color: t.cor })),
    [tiles],
  );

  return (
    <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
      {/* Filtro de período */}
      <div className="mb-5 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center gap-1.5">
          <CalendarRange className="mr-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden />
          {PERIODOS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => irPeriodo(o.key)}
              aria-pressed={periodo === o.key}
              className={`${chip} ${periodo === o.key ? chipOn : chipOff}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cartões de conversão */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Ganhos"
          value={cartoes.ganhos}
          sub="Negócios fechados"
          cor="var(--tom-bom)"
          onClick={() => abrirDrill("Ganhos", (o) => o.statusNome === "Ganho")}
        />
        <StatCard
          label="Perdidos"
          value={cartoes.perdidos}
          sub="Não convertidos"
          cor="var(--tom-critico)"
          onClick={() => abrirDrill("Perdidos", (o) => o.statusNome === "Perdido")}
        />
        <StatCard label="Conversão" value={`${cartoes.conversaoPct}%`} sub="Ganhos / total" cor="var(--accent)" />
      </div>

      {/* Cartões financeiros */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Prospectado" value={financeiro.prospectadoBRL} sub={`${financeiro.comValorQtd} com valor informado`} cor="var(--accent)" />
        <StatCard label="Valor Ganhos" value={financeiro.ganhosBRL} sub="Negócios convertidos" cor="var(--tom-bom)" />
        <StatCard label="Valor Perdidos" value={financeiro.perdidosBRL} sub="Oportunidades perdidas" cor="var(--tom-critico)" />
        <StatCard label="Conv. por Valor" value={`${financeiro.conversaoValorPct}%`} sub="Ganho / prospectado" cor="var(--ink-magenta)" />
      </div>

      {/* Grelha de gráficos */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Por produto */}
        <Card title="Oportunidades por Produto" sub="Quantidade — clique para detalhar">
          <Bars
            rows={barProduto.map((b) => ({
              rotulo: b.nome,
              valor: b.quantidade,
              rightLabel: String(b.quantidade),
              onClick: () => abrirDrill(`Produto: ${b.nome}`, (o) => o.produtoIds.includes(b.id)),
            }))}
            empty="Nenhuma oportunidade com produto vinculado."
          />
        </Card>

        {/* Conversão */}
        <Card
          title={admin ? "Conversão por Parceiro" : "Minha Conversão por Produto"}
          sub="% de ganhos — clique para detalhar"
        >
          <Bars
            rows={conversao.map((c) => ({
              rotulo: c.rotulo,
              valor: c.pct,
              rightLabel: `${c.pct}%`,
              onClick: () =>
                abrirDrill(
                  `${c.tipo === "parceiro" ? "Parceiro" : "Produto"}: ${c.rotulo}`,
                  c.tipo === "parceiro"
                    ? (o) => o.parceiroId === c.refId
                    : (o) => o.produtoIds.includes(c.refId),
                ),
            }))}
            empty="Sem dados de conversão no período."
          />
        </Card>

        {/* Valor estimado */}
        <Card
          title={admin ? "Valor Estimado por Parceiro" : "Valor Estimado por Produto"}
          sub="Soma dos valores — clique para detalhar"
        >
          <Bars
            rows={barValor.map((b) => ({
              rotulo: b.rotulo,
              valor: b.valor,
              rightLabel: b.valorBRL,
              onClick: () =>
                abrirDrill(
                  `${b.tipo === "parceiro" ? "Parceiro" : "Produto"}: ${b.rotulo}`,
                  b.tipo === "parceiro"
                    ? (o) => o.parceiroId === b.refId
                    : (o) => o.produtoIds.includes(b.refId),
                ),
            }))}
            empty="Nenhuma oportunidade com valor estimado preenchido."
          />
        </Card>

        {/* Distribuição por etapa: Donut + tiles clicáveis */}
        <Card title="Distribuição por Etapa" sub="Participação de cada etapa — clique num tile para detalhar">
          {donutSlices.length > 0 ? (
            <Donut data={donutSlices} centerLabel="oportunidades" centerValue={String(report.totais.quantidade)} />
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-faint">
              Nenhuma oportunidade no período.
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tiles.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => abrirDrill(t.nome, (o) => o.statusNome === t.nome)}
                style={{ borderTopColor: t.cor }}
                className="rounded-xl border border-t-[3px] border-border bg-field p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
              >
                <div className="truncate text-[11px] font-semibold" style={{ color: t.cor }} title={t.nome}>
                  {t.nome}
                </div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums text-text">{t.quantidade}</div>
                <div className="text-[10px] text-faint">{t.pct}% do total</div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {drill && <DrillModal titulo={drill.titulo} opps={drill.opps} admin={admin} onClose={() => setDrill(null)} />}
    </div>
  );
}
