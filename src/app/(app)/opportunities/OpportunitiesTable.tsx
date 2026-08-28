"use client";

// Tabela de OPORTUNIDADES (client island). Espelha o CRM (table-kit) e o SPA legado
// (legacy/js/table.js): filtros (OppFiltersBar), ordenação por cabeçalho, seleção de
// colunas, paginação, export CSV, duplo-clique/botão para editar (OppModal) e ações de
// aprovação/rejeição/reversão para admin.
//
// A fonte da verdade é o servidor: filtragem/ordenação/paginação são só de apresentação
// sobre as linhas já escopadas por `loadOpps`. Toda escrita chama as Server Actions de
// `@/lib/domain/opps` (o escopo/permite é reaplicado lá). `router.refresh()` recarrega.

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Briefcase, Building2, Tags, Milestone, ShieldCheck, CircleDollarSign,
  CalendarDays, ListChecks, Pencil, Check, X, RotateCcw, Download, Plus, LayoutGrid,
} from "lucide-react";
import {
  useClientTable, useLocalCols, ListHeader, ColumnChooser, HeaderCell, Pagination,
  type ColDef,
} from "@/components/ui/table-kit";
import { OppFiltersBar, FILTROS_VAZIOS, type OppFiltros } from "@/components/dominio/OppFiltersBar";
import { StatusBadge } from "@/components/dominio/StatusBadge";
import { AprovacaoBadge } from "@/components/dominio/AprovacaoBadge";
import { OppModal, type OppParaEdicao, type ProdutoOpt, type StatusOpt, type ParceiroOpt } from "@/components/dominio/OppModal";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/Avatar";
import { formatBRL, reaisToCents } from "@/lib/money";
import { approveOpp, rejectOpp, reverterRejeicao } from "@/lib/domain/opps";
import { fetchOppForEdit } from "./actions";

// ───────────────────────────── tipos ─────────────────────────────

/** Forma "resumida" de oportunidade que a página injeta (saída de `loadOpps`). */
export type OppRow = {
  id: number;
  empresa: string;
  cnpj: string | null;
  siteEmpresa: string | null;
  contato: string | null;
  cargo: string | null;
  obs: string | null;
  aprovacao: "Pendente" | "Aprovado" | "Rejeitado";
  status: { id: number; nome: string; cor: string } | null;
  parceiro: { id: number; nome: string } | null;
  produtos: { id: number; nome: string }[];
  valorEstimado: number | null;
  valorEstimadoBRL: string | null;
  fechamento: string | null;
  criadaEm: string | null;
  tarefas: { total: number; pendentes: number };
};

type StatusOrd = StatusOpt & { cor: string; ordem: number };

const SIZE_OPTS = [10, 30, 50, 100];
const COLS_STORAGE = "cultpartners.opps.columns.v1";

// ───────────────────────────── helpers ─────────────────────────────

function fmtMonth(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return "—";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[Number(m[2]) - 1]}/${m[1]}`;
}

function matchFilters(o: OppRow, f: OppFiltros): boolean {
  if (f.busca) {
    const q = f.busca.toLowerCase();
    const hit =
      o.empresa.toLowerCase().includes(q) ||
      (o.contato ?? "").toLowerCase().includes(q) ||
      (o.cnpj ?? "").toLowerCase().includes(q);
    if (!hit) return false;
  }
  if (f.status && o.status?.nome !== f.status) return false;
  if (f.aprovacao && o.aprovacao !== f.aprovacao) return false;
  if (f.parceiroId && String(o.parceiro?.id ?? "") !== f.parceiroId) return false;
  return true;
}

// ───────────────────────────── componente ─────────────────────────────

export function OpportunitiesTable({
  opps, status, produtos, parceiros, isAdmin, audience, showParceiro,
}: {
  opps: OppRow[];
  status: StatusOrd[];
  produtos: ProdutoOpt[];
  parceiros: ParceiroOpt[];
  isAdmin: boolean;
  audience: "internal" | "partner";
  showParceiro: boolean;
}) {
  const router = useRouter();
  const [filtros, setFiltros] = useState<OppFiltros>(FILTROS_VAZIOS);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<OppParaEdicao | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<number | null>(null);
  const [rejectFor, setRejectFor] = useState<OppRow | null>(null);
  const [, startTransition] = useTransition();

  // Colunas configuráveis (parceiro só quando faz sentido ver).
  const ALL_COLUMNS: ColDef[] = useMemo(() => {
    const cols: ColDef[] = [];
    if (showParceiro) cols.push({ key: "parceiro", label: "Parceiro", Icon: Building2 });
    cols.push(
      { key: "produto", label: "Produtos", Icon: Tags, noSort: true },
      { key: "status", label: "Status", Icon: Milestone },
      { key: "aprovacao", label: "Aprovação", Icon: ShieldCheck },
      { key: "valor", label: "Valor est.", Icon: CircleDollarSign, right: true },
      { key: "fechamento", label: "Fechamento", Icon: CalendarDays },
      { key: "tarefas", label: "Tarefas", Icon: ListChecks, center: true, noSort: true },
    );
    return cols;
  }, [showParceiro]);

  const DEFAULT_COLS = useMemo(() => ALL_COLUMNS.map((c) => c.key), [ALL_COLUMNS]);
  const [visibleCols, setVisibleCols] = useLocalCols(COLS_STORAGE, DEFAULT_COLS);

  const filtered = useMemo(() => opps.filter((o) => matchFilters(o, filtros)), [opps, filtros]);

  const sortAccessor = useCallback((o: OppRow, key: string): string | number | null => {
    switch (key) {
      case "empresa": return o.empresa;
      case "parceiro": return o.parceiro?.nome ?? null;
      case "status": return o.status?.nome ?? null;
      case "aprovacao": return o.aprovacao;
      case "valor": return o.valorEstimado ?? -1;
      case "fechamento": return o.fechamento;
      case "criadaEm": return o.criadaEm;
      default: return null;
    }
  }, []);

  const t = useClientTable<OppRow>({
    rows: filtered, fields: [], sortAccessor, initialSort: "criadaEm", initialDir: "desc", defaultSize: 30,
  });

  const cols = ALL_COLUMNS.filter((c) => visibleCols.includes(c.key));
  const colCount = 1 + cols.length + 1; // empresa + configuráveis + ações

  // ── abrir edição: carrega a oportunidade completa (produtos + tarefas) ──
  function openEdit(id: number) {
    setLoadingEdit(id);
    startTransition(async () => {
      const full = await fetchOppForEdit(id);
      setLoadingEdit(null);
      if (!full) {
        toast.error("Oportunidade não encontrada no seu alcance.");
        return;
      }
      setEditing(full);
    });
  }

  // ── ações de aprovação (admin) ──
  function aprovar(o: OppRow) {
    startTransition(async () => {
      const r = await approveOpp(o.id);
      if (r.ok) { toast.success(r.message ?? "Aprovada."); router.refresh(); }
      else toast.error(r.error);
    });
  }
  function reverter(o: OppRow) {
    startTransition(async () => {
      const r = await reverterRejeicao(o.id);
      if (r.ok) { toast.success(r.message ?? "Revertida."); router.refresh(); }
      else toast.error(r.error);
    });
  }
  function confirmarRejeicao(motivo: string) {
    if (!rejectFor) return;
    const alvo = rejectFor;
    startTransition(async () => {
      const r = await rejectOpp(alvo.id, motivo);
      setRejectFor(null);
      if (r.ok) { toast.success(r.message ?? "Rejeitada."); router.refresh(); }
      else toast.error(r.error);
    });
  }

  // ── export CSV (respeita os filtros, ignora a paginação) — espelha exportCSV do SPA ──
  function exportCSV() {
    const headers = [
      "ID", "Empresa", "Site", "CNPJ", "Contato", "Cargo", "Produtos", "Status",
      "Fechamento", "Valor Estimado", "Parceiro", "Aprovação",
      "Tarefas Total", "Tarefas Pendentes",
    ];
    const linhas = filtered.map((o) => [
      o.id, o.empresa, o.siteEmpresa ?? "", o.cnpj ?? "", o.contato ?? "", o.cargo ?? "",
      o.produtos.map((p) => p.nome).join(", "), o.status?.nome ?? "",
      o.fechamento ? o.fechamento.slice(0, 7) : "",
      o.valorEstimado != null ? o.valorEstimado.toFixed(2).replace(".", ",") : "",
      o.parceiro?.nome ?? "", o.aprovacao,
      o.tarefas.total, o.tarefas.pendentes,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`));
    const csv = "﻿" + [headers.map((h) => `"${h}"`).join(","), ...linhas.map((r) => r.join(","))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `cultpartners_oportunidades_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("CSV exportado.");
  }

  const newBtn = (
    <button
      onClick={() => setCreating(true)}
      aria-label="Nova oportunidade"
      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#e91e8c] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-all hover:bg-[#d81b80] active:translate-y-px max-md:min-h-11 max-md:min-w-11 max-sm:px-0"
    >
      <Plus className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline md:hidden">Nova</span>
      <span className="hidden md:inline">Nova oportunidade</span>
    </button>
  );

  return (
    <div className="flex h-full flex-col max-md:h-auto">
      <div className="shrink-0">
        <ListHeader title="Oportunidades" count={t.total} Icon={Briefcase} primary={newBtn} backHref="/dashboard">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface2 hover:text-text"
          >
            <Download className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Exportar CSV</span>
          </button>
          <ColumnChooser all={ALL_COLUMNS} visible={visibleCols} onChange={setVisibleCols} />
          <div className="inline-flex rounded-lg border border-border p-0.5">
            <span className="rounded-md bg-surface2 px-3 py-1 text-sm font-medium text-text">Lista</span>
            <Link href="/pipeline" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm text-muted hover:text-text">
              <LayoutGrid className="h-4 w-4" aria-hidden /> Quadro
            </Link>
          </div>
        </ListHeader>
      </div>

      <div className="mt-4 shrink-0">
        <OppFiltersBar
          value={filtros}
          onChange={setFiltros}
          statusOptions={status}
          parceiroOptions={parceiros}
          showParceiro={showParceiro}
        />
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-sm)] max-md:flex-none max-md:overflow-visible">
        {/* Desktop: tabela */}
        <div className="hidden min-h-0 flex-1 overflow-auto md:block">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface2 text-left text-[11px] uppercase tracking-wider text-text shadow-[0_1px_0_var(--border)]">
              <tr>
                <HeaderCell col={{ key: "empresa", label: "Empresa", Icon: Briefcase }} sort={t.sort} dir={t.dir} onSort={(k) => t.sortBy(k)} conditions={[]} onReplaceField={() => {}} fields={{}} enumOptions={() => []} />
                {cols.map((c) => (
                  <HeaderCell key={c.key} col={c} sort={t.sort} dir={t.dir} onSort={(k) => t.sortBy(k, c.key === "valor")} conditions={[]} onReplaceField={() => {}} fields={{}} enumOptions={() => []} />
                ))}
                <th className="px-4 py-3 text-right font-bold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {t.view.map((o, i) => (
                <tr
                  key={o.id}
                  onDoubleClick={() => openEdit(o.id)}
                  className={`cursor-default transition-colors hover:bg-[#e91e8c]/[0.06] ${i % 2 ? "bg-surface2/30" : ""} ${o.aprovacao === "Rejeitado" ? "opacity-70" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={o.empresa} size={30} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-text">{o.empresa}</div>
                        {o.contato && <div className="truncate text-xs text-faint">{o.contato}{o.cargo ? ` · ${o.cargo}` : ""}</div>}
                      </div>
                    </div>
                  </td>
                  {cols.map((c) => (
                    <td key={c.key} className={`px-4 py-2.5 ${c.right ? "text-right tabular-nums" : ""} ${c.center ? "text-center" : ""}`}>
                      {renderCell(c.key, o)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    <RowActions o={o} isAdmin={isAdmin} loading={loadingEdit === o.id} onEdit={() => openEdit(o.id)} onApprove={() => aprovar(o)} onReject={() => setRejectFor(o)} onRevert={() => reverter(o)} />
                  </td>
                </tr>
              ))}
              {t.view.length === 0 && (
                <tr><td colSpan={colCount} className="px-4 py-14 text-center text-sm text-faint">
                  Nenhuma oportunidade {filtered.length === 0 && opps.length ? "no filtro atual" : "ainda"}. Use <strong className="text-muted">+ Nova oportunidade</strong>.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards */}
        <div className="space-y-2 p-2 md:hidden">
          {t.view.map((o) => (
            <div key={o.id} onClick={() => openEdit(o.id)} className="cursor-pointer rounded-xl border border-border bg-surface p-3 transition-colors active:bg-surface2">
              <div className="flex items-start gap-2.5">
                <Avatar name={o.empresa} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-medium text-text">{o.empresa}</div>
                  {showParceiro && o.parceiro && (
                    <div className="flex items-center gap-1 truncate text-xs text-muted">
                      <Building2 className="h-3 w-3 shrink-0" aria-hidden /> <span className="truncate">{o.parceiro.nome}</span>
                    </div>
                  )}
                </div>
                <AprovacaoBadge aprovacao={o.aprovacao} className="shrink-0" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge nome={o.status?.nome} cor={o.status?.cor} />
                {o.produtos.slice(0, 2).map((p) => (
                  <span key={p.id} className="rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-text">{p.nome}</span>
                ))}
                {o.produtos.length > 2 && <span className="text-[11px] text-faint">+{o.produtos.length - 2}</span>}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="font-semibold tabular-nums text-[color:var(--tom-bom)]">{o.valorEstimado != null ? formatBRL(reaisToCents(o.valorEstimado)) : "—"}</span>
                <span className="text-faint">{fmtMonth(o.fechamento)}</span>
              </div>
            </div>
          ))}
          {t.view.length === 0 && (
            <div className="px-4 py-14 text-center text-sm text-faint">Nenhuma oportunidade no momento.</div>
          )}
        </div>

        <Pagination page={t.page} totalPages={t.totalPages} size={t.size} sizeOpts={SIZE_OPTS} from={t.from} to={t.to} total={t.total} onPage={t.setPage} onSize={t.setSize} />
      </div>

      {/* Modal criar/editar */}
      {(creating || editing) && (
        <OppModal
          open
          onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null); } }}
          opp={editing}
          produtos={produtos}
          status={status}
          parceiros={parceiros}
          isAdmin={isAdmin}
          audience={audience}
          onSaved={() => router.refresh()}
        />
      )}

      {/* Rejeição com motivo (admin) */}
      {rejectFor && (
        <RejectDialog empresa={rejectFor.empresa} onCancel={() => setRejectFor(null)} onConfirm={confirmarRejeicao} />
      )}
    </div>
  );
}

// ───────────────────────────── células ─────────────────────────────

function renderCell(key: string, o: OppRow) {
  switch (key) {
    case "parceiro":
      return o.parceiro ? <span className="text-muted">{o.parceiro.nome}</span> : <span className="text-faint">—</span>;
    case "produto":
      return o.produtos.length ? (
        <div className="flex flex-wrap gap-1">
          {o.produtos.map((p) => (
            <span key={p.id} className="rounded bg-[color:color-mix(in_srgb,var(--accent)_12%,transparent)] px-1.5 py-0.5 text-[11px] font-medium text-[color:var(--accent)]">{p.nome}</span>
          ))}
        </div>
      ) : <span className="text-faint">—</span>;
    case "status":
      return <StatusBadge nome={o.status?.nome} cor={o.status?.cor} />;
    case "aprovacao":
      return <AprovacaoBadge aprovacao={o.aprovacao} />;
    case "valor":
      return o.valorEstimado != null
        ? <span className="font-semibold text-[color:var(--tom-bom)]">{formatBRL(reaisToCents(o.valorEstimado))}</span>
        : <span className="text-faint">—</span>;
    case "fechamento":
      return <span className="text-muted">{fmtMonth(o.fechamento)}</span>;
    case "tarefas": {
      const { total, pendentes } = o.tarefas;
      if (!total) return <span className="text-faint">—</span>;
      return (
        <span className="inline-flex items-center gap-2 text-xs tabular-nums">
          <span className="inline-flex items-center gap-0.5 text-[color:var(--tom-bom)]"><Check className="h-3 w-3" aria-hidden />{total - pendentes}</span>
          <span className="inline-flex items-center gap-0.5 text-muted"><ListChecks className="h-3 w-3" aria-hidden />{pendentes}</span>
        </span>
      );
    }
    default: return null;
  }
}

// ───────────────────────────── ações da linha ─────────────────────────────

function RowActions({
  o, isAdmin, loading, onEdit, onApprove, onReject, onRevert,
}: {
  o: OppRow; isAdmin: boolean; loading: boolean;
  onEdit: () => void; onApprove: () => void; onReject: () => void; onRevert: () => void;
}) {
  const btn = "grid h-7 w-7 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface2 disabled:opacity-50";
  return (
    <div className="flex items-center justify-end gap-1" onDoubleClick={(e) => e.stopPropagation()}>
      <button title="Editar" disabled={loading} onClick={onEdit} className={btn + " hover:text-text"}>
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </button>
      {isAdmin && o.aprovacao === "Pendente" && (
        <>
          <button title="Aprovar" onClick={onApprove} className={btn + " hover:text-[color:var(--tom-bom)] hover:border-[color:var(--tom-bom)]"}>
            <Check className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button title="Rejeitar" onClick={onReject} className={btn + " hover:text-[color:var(--tom-critico)] hover:border-[color:var(--tom-critico)]"}>
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </>
      )}
      {isAdmin && o.aprovacao === "Rejeitado" && (
        <button title="Reverter (volta a Pendente)" onClick={onRevert} className={btn + " hover:text-text"}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

// ───────────────────────────── diálogo de rejeição ─────────────────────────────

function RejectDialog({ empresa, onCancel, onConfirm }: { empresa: string; onCancel: () => void; onConfirm: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md" showClose={false}>
        <div className="px-5 py-4">
          <DialogTitle>Rejeitar oportunidade</DialogTitle>
          <DialogDescription className="mt-1">Informe o motivo da rejeição de “{empresa}”.</DialogDescription>
          <textarea
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Descreva o motivo…"
            className="mt-3 w-full rounded-lg border border-border bg-field px-3 py-2 text-sm text-text shadow-[var(--field-inset)] outline-none focus:border-[color:var(--accent)] placeholder:text-faint"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={onCancel} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface2">Cancelar</button>
            <button
              onClick={() => onConfirm(motivo.trim())}
              disabled={!motivo.trim()}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--tom-critico)" }}
            >
              Confirmar rejeição
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
