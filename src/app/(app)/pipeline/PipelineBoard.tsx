"use client";

// Quadro (kanban) do PIPELINE — client island. Espelha legacy/js/kanban.js e o quadro
// do CRM: colunas por StatusFunil (na ordem), cartões arrastáveis via @dnd-kit. Soltar
// numa coluna chama `moveOppStatus` (Server Action) com atualização OTIMISTA e rollback
// em caso de erro. O clique abre o OppModal (carregando produtos+tarefas do servidor).

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext, DragOverlay, type DragEndEvent, MouseSensor, TouchSensor,
  useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { Plus, List, LayoutGrid, Building2, CalendarClock, ListChecks, ChevronLeft, ChevronRight } from "lucide-react";
import { OppFiltersBar, FILTROS_VAZIOS, type OppFiltros } from "@/components/dominio/OppFiltersBar";
import { OppModal, type OppParaEdicao, type ProdutoOpt, type StatusOpt, type ParceiroOpt } from "@/components/dominio/OppModal";
import { AprovacaoBadge } from "@/components/dominio/AprovacaoBadge";
import { Avatar } from "@/components/ui/Avatar";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { formatBRLShort } from "@/lib/money";
import { moveOppStatus } from "@/lib/domain/opps";
import { fetchOppForEdit } from "../opportunities/actions";
import type { OppRow } from "../opportunities/OpportunitiesTable";

type StatusOrd = StatusOpt & { cor: string; ordem: number };

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
    if (!(o.empresa.toLowerCase().includes(q) || (o.contato ?? "").toLowerCase().includes(q) || (o.cnpj ?? "").toLowerCase().includes(q))) return false;
  }
  if (f.status && o.status?.nome !== f.status) return false;
  if (f.aprovacao && o.aprovacao !== f.aprovacao) return false;
  if (f.parceiroId && String(o.parceiro?.id ?? "") !== f.parceiroId) return false;
  return true;
}

export function PipelineBoard({
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
  const [cards, setCards] = useState(opps);
  // Reidrata quando o servidor recarrega (após salvar/mover): sincroniza no RENDER
  // (padrão do React p/ "resetar estado quando uma prop muda"), sem efeito em cascata.
  const [oppsRef, setOppsRef] = useState(opps);
  if (opps !== oppsRef) {
    setOppsRef(opps);
    setCards(opps);
  }
  const [filtros, setFiltros] = useState<OppFiltros>(FILTROS_VAZIOS);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<OppParaEdicao | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { ref: quadroRef, pode, rolar } = useScrollArrows(status.length);

  // Mouse: arrasta após 6px. Touch: long-press (~250ms) arrasta; toque curto abre o card.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const etapas = useMemo(() => [...status].sort((a, b) => a.ordem - b.ordem), [status]);
  const filtered = useMemo(() => cards.filter((o) => matchFilters(o, filtros)), [cards, filtros]);

  function openEdit(id: number) {
    startTransition(async () => {
      const full = await fetchOppForEdit(id);
      if (!full) { toast.error("Oportunidade não encontrada no seu alcance."); return; }
      setEditing(full);
    });
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = Number(e.active.id);
    const to = e.over ? Number(e.over.id) : null;
    if (!to) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.status?.id === to) return;
    const prev = card.status;
    const destino = etapas.find((s) => s.id === to) ?? null;
    // Move otimista.
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: destino ? { id: destino.id, nome: destino.nome, cor: destino.cor } : c.status } : c)));
    startTransition(async () => {
      const res = await moveOppStatus(id, to);
      if (!res.ok) {
        setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: prev } : c)));
        setMoveError(res.error);
      } else {
        toast.success(res.message ?? `Movida para “${destino?.nome ?? "nova etapa"}”.`);
        router.refresh();
      }
    });
  }

  const activeCard = activeId != null ? cards.find((c) => c.id === activeId) ?? null : null;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 sm:gap-y-3">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Pipeline</h1>
        <button onClick={() => setCreating(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#e91e8c] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-all max-sm:ml-auto max-sm:min-h-11 hover:bg-[#d81b80] active:translate-y-px sm:order-1">
          <Plus className="h-4 w-4" aria-hidden /> Nova<span className="hidden sm:inline"> oportunidade</span>
        </button>
        <div className="inline-flex rounded-lg border border-border p-0.5 sm:ml-auto">
          <Link href="/opportunities" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm text-muted hover:text-text"><List className="h-4 w-4" aria-hidden /> Lista</Link>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface2 px-3 py-1 text-sm font-medium text-text"><LayoutGrid className="h-4 w-4" aria-hidden /> Quadro</span>
        </div>
      </div>

      <div className="mb-3 shrink-0">
        <OppFiltersBar value={filtros} onChange={setFiltros} statusOptions={status} parceiroOptions={parceiros} showParceiro={showParceiro} />
      </div>

      <DndContext
        id="opp-kanban"
        sensors={sensors}
        onDragStart={(e) => setActiveId(Number(e.active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={onDragEnd}
      >
        <div className="relative flex min-h-0 flex-1">
          {pode.esq && <SetaQuadro lado="esq" onClick={() => rolar(-1)} />}
          {pode.dir && <SetaQuadro lado="dir" onClick={() => rolar(1)} />}
          <div ref={quadroRef} className="flex min-h-0 flex-1 snap-x snap-mandatory items-stretch gap-3 scroll-x-visible pb-3 max-sm:-mx-4 max-sm:scroll-pl-4 max-sm:px-4 sm:snap-none sm:gap-5">
            {etapas.map((s) => (
              <Column
                key={s.id}
                stage={s}
                cards={filtered.filter((c) => c.status?.id === s.id)}
                onOpen={openEdit}
                activeId={activeId}
                showParceiro={showParceiro}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeCard ? <CardView card={activeCard} showParceiro={showParceiro} dragging /> : null}
        </DragOverlay>
      </DndContext>

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

      {moveError && <AlertDialog title="Não foi possível mover" message={moveError} onClose={() => setMoveError(null)} />}
    </div>
  );
}

// ───────────────────────────── coluna ─────────────────────────────

function Column({ stage, cards, onOpen, activeId, showParceiro }: {
  stage: StatusOrd; cards: OppRow[]; onOpen: (id: number) => void; activeId: number | null; showParceiro: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = cards.reduce((s, c) => s + (c.valorEstimado ?? 0), 0);
  return (
    <div
      ref={setNodeRef}
      className={`flex h-full w-[80vw] max-w-[22rem] flex-none snap-start flex-col overflow-hidden rounded-xl border bg-sunken sm:w-auto sm:max-w-none sm:min-w-[16.5rem] sm:flex-1 ${isOver ? "border-[#e91e8c]" : "border-border"}`}
    >
      <div className="h-1 w-full shrink-0" style={{ background: stage.cor }} />
      <div className="shrink-0 border-b border-border bg-sunken px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: stage.cor }} aria-hidden />
          <div className="min-w-0 flex-1 truncate text-sm font-bold leading-tight text-text">{stage.nome}</div>
          <span className="grid shrink-0 place-items-center rounded-lg border border-border bg-surface px-2 py-1 leading-none">
            <span className="text-sm font-bold tabular-nums text-text">{cards.length}</span>
            <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-faint max-sm:text-[11px]">opts</span>
          </span>
        </div>
        {total > 0 && (
          <div className="mt-1.5 text-right text-[11px] font-medium tabular-nums text-[color:var(--tom-bom)]">{formatBRLShort(total)}</div>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2.5">
        {cards.map((c) => <Card key={c.id} card={c} onOpen={onOpen} dimmed={c.id === activeId} showParceiro={showParceiro} />)}
        {cards.length === 0 && <div className="px-1 py-8 text-center text-xs text-faint">—</div>}
      </div>
    </div>
  );
}

function Card({ card, onOpen, dimmed, showParceiro }: { card: OppRow; onOpen: (id: number) => void; dimmed: boolean; showParceiro: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={() => onOpen(card.id)} className={dimmed || isDragging ? "opacity-40" : ""}>
      <CardView card={card} showParceiro={showParceiro} />
    </div>
  );
}

/** Apresentação pura do cartão (coluna + DragOverlay). */
function CardView({ card, showParceiro, dragging = false }: { card: OppRow; showParceiro: boolean; dragging?: boolean }) {
  const prods = card.produtos;
  const visiveis = prods.slice(0, 2);
  const extra = prods.length - visiveis.length;
  const stripe = card.status?.cor ?? "#64748b";
  return (
    <div
      className={`group rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow)] transition-all ${dragging ? "rotate-2 cursor-grabbing shadow-[var(--shadow-lg)]" : "cursor-grab hover:-translate-y-1 hover:border-faint/60 hover:shadow-[var(--shadow-lg)]"} ${card.aprovacao === "Rejeitado" ? "opacity-75" : ""}`}
      style={{ borderLeft: `3px solid ${stripe}` }}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={card.empresa} size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-tight text-text max-sm:whitespace-normal max-sm:line-clamp-2">{card.empresa}</div>
          {showParceiro && card.parceiro && (
            <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted">
              <Building2 className="h-3 w-3 shrink-0 text-faint" aria-hidden /> <span className="truncate">{card.parceiro.nome}</span>
            </div>
          )}
        </div>
        {card.aprovacao === "Pendente" && <AprovacaoBadge aprovacao="Pendente" className="shrink-0" />}
      </div>

      {prods.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visiveis.map((p) => <span key={p.id} className="rounded bg-surface2 px-1.5 py-0.5 text-[10px] text-text">{p.nome}</span>)}
          {extra > 0 && <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10px] text-faint">+{extra}</span>}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2 text-[10px] tabular-nums text-faint">
        <span className="font-semibold text-[color:var(--tom-bom)]">{card.valorEstimado != null ? formatBRLShort(card.valorEstimado) : "—"}</span>
        <span className="flex items-center gap-2">
          {card.tarefas.pendentes > 0 && <span className="inline-flex items-center gap-0.5"><ListChecks className="h-3 w-3" aria-hidden />{card.tarefas.pendentes}</span>}
          <span className="inline-flex items-center gap-0.5"><CalendarClock className="h-3 w-3" aria-hidden />{fmtMonth(card.fechamento)}</span>
        </span>
      </div>
    </div>
  );
}

// ───────────────────────────── setas de rolagem ─────────────────────────────

function useScrollArrows(deps: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [pode, setPode] = useState({ esq: false, dir: false });

  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setPode({ esq: el.scrollLeft > 8, dir: el.scrollLeft + el.clientWidth < el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(medir);
    el.addEventListener("scroll", medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => { cancelAnimationFrame(id); el.removeEventListener("scroll", medir); ro.disconnect(); };
  }, [medir, deps]);

  const rolar = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    const coluna = el.firstElementChild?.getBoundingClientRect().width ?? el.clientWidth * 0.8;
    el.scrollBy({ left: dir * (coluna + 20), behavior: "smooth" });
  };

  return { ref, pode, rolar };
}

function SetaQuadro({ lado, onClick }: { lado: "esq" | "dir"; onClick: () => void }) {
  const Icon = lado === "esq" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={lado === "esq" ? "Ver colunas à esquerda" : "Ver colunas à direita"}
      className={`absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface/90 text-muted shadow-[var(--shadow)] backdrop-blur transition-colors hover:bg-surface2 hover:text-text sm:grid ${lado === "esq" ? "-left-1" : "-right-1"}`}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}
