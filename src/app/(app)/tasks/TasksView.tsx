"use client";

// Tela de TAREFAS (client island). Espelha o comportamento de tarefas do SPA legado
// (legacy/js/ops.js): concluir/reabrir, editar (descrição/prazo/responsável) e remover —
// tudo via `saveTasks` no servidor (actions.ts), que reaplica escopo e permissão.
//
// Atrasadas e as de hoje ficam em destaque; concluídas ficam num bloco recolhível para
// permitir reabrir. Executivo de canal é somente-leitura: os controles ficam desativados
// (e o servidor recusaria de qualquer forma).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Check, CalendarClock, User2, Pencil, Trash2, ChevronRight, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { toggleTaskDone, editTaskAction, removeTaskAction } from "./actions";
import type { TaskRow, TasksData } from "./data";

const FIELD =
  "h-9 w-full rounded-lg border border-border bg-field px-3 text-sm text-text shadow-[var(--field-inset)] outline-none transition-colors focus:border-[color:var(--accent)] placeholder:text-faint";
const LABEL = "mb-1 block text-xs font-medium text-muted";

function fmtData(iso: string | null): string {
  if (!iso) return "sem prazo";
  return iso.split("-").reverse().join("/");
}

// ───────────────────────────── item ─────────────────────────────

function TaskItem({
  t,
  hoje,
  canWrite,
  onChanged,
  onEdit,
}: {
  t: TaskRow;
  hoje: string;
  canWrite: boolean;
  onChanged: () => void;
  onEdit: (t: TaskRow) => void;
}) {
  const [pending, startTransition] = useTransition();
  const atrasada = !t.concluida && t.prazo && t.prazo < hoje;

  function toggle() {
    startTransition(async () => {
      const r = await toggleTaskDone(t.oportunidadeId, t.id, !t.concluida);
      if (r.ok) {
        toast.success(!t.concluida ? "Tarefa concluída." : "Tarefa reaberta.");
        onChanged();
      } else {
        toast.error(r.error);
      }
    });
  }

  function remover() {
    startTransition(async () => {
      const r = await removeTaskAction(t.oportunidadeId, t.id);
      if (r.ok) {
        toast.success("Tarefa removida.");
        onChanged();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-[var(--shadow-sm)] transition-colors max-sm:min-h-12 ${
        pending ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!canWrite || pending}
        aria-pressed={t.concluida}
        title={t.concluida ? "Reabrir" : "Concluir"}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors disabled:opacity-50 ${
          t.concluida ? "border-transparent bg-[color:var(--tom-bom)] text-white" : "border-border text-transparent hover:border-faint"
        }`}
      >
        <Check className="h-4 w-4" aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm ${t.concluida ? "text-faint line-through" : "text-text"}`}>{t.descricao}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-faint">
          <Link
            href={`/opportunities?opp=${t.oportunidadeId}`}
            className="inline-flex items-center gap-1 truncate transition-colors hover:text-[color:var(--accent-blue)]"
            title={t.empresa}
          >
            <Building2 className="h-3 w-3 shrink-0" aria-hidden />
            {t.empresa}
          </Link>
          {t.prazo && (
            <span className={atrasada ? "font-medium text-[color:var(--tom-critico)]" : ""}>
              <CalendarClock className="mr-0.5 inline h-3 w-3" aria-hidden />
              {atrasada ? "Vencida: " : ""}
              {fmtData(t.prazo)}
            </span>
          )}
          {t.responsavel && (
            <span>
              <User2 className="mr-0.5 inline h-3 w-3" aria-hidden />
              {t.responsavel}
            </span>
          )}
        </div>
      </div>

      {canWrite && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(t)}
            disabled={pending}
            aria-label="Editar tarefa"
            className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-surface2 hover:text-text disabled:opacity-50"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={remover}
            disabled={pending}
            aria-label="Remover tarefa"
            className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-surface2 hover:text-[color:var(--tom-critico)] disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}
    </li>
  );
}

// ───────────────────────────── grupo ─────────────────────────────

function Group({
  title,
  tone,
  tasks,
  empty,
  hoje,
  canWrite,
  onChanged,
  onEdit,
  collapsible,
}: {
  title: string;
  tone: string;
  tasks: TaskRow[];
  empty: string;
  hoje: string;
  canWrite: boolean;
  onChanged: () => void;
  onEdit: (t: TaskRow) => void;
  collapsible?: boolean;
}) {
  const [aberto, setAberto] = useState(!collapsible);
  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => collapsible && setAberto((v) => !v)}
        className={`flex w-full items-center gap-2 ${collapsible ? "cursor-pointer" : "cursor-default"}`}
      >
        {collapsible && <ChevronRight className={`h-4 w-4 text-faint transition-transform ${aberto ? "rotate-90" : ""}`} aria-hidden />}
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${tasks.length ? tone : "text-muted"}`}>
          {title} <span className="tabular-nums">({tasks.length})</span>
        </h2>
      </button>
      {aberto && (
        <ul className="mt-3 space-y-2">
          {tasks.map((t) => (
            <TaskItem key={t.id} t={t} hoje={hoje} canWrite={canWrite} onChanged={onChanged} onEdit={onEdit} />
          ))}
          {tasks.length === 0 && (
            <li className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-faint">{empty}</li>
          )}
        </ul>
      )}
    </section>
  );
}

// ───────────────────────────── editar (modal) ─────────────────────────────

function EditModal({ t, onClose, onSaved }: { t: TaskRow; onClose: () => void; onSaved: () => void }) {
  const [descricao, setDescricao] = useState(t.descricao);
  const [prazo, setPrazo] = useState(t.prazo ?? "");
  const [responsavel, setResponsavel] = useState(t.responsavel ?? "");
  const [pending, startTransition] = useTransition();

  function salvar() {
    if (!descricao.trim()) {
      toast.error("Descreva a tarefa.");
      return;
    }
    startTransition(async () => {
      const r = await editTaskAction(t.oportunidadeId, t.id, {
        descricao: descricao.trim(),
        prazo: prazo || null,
        responsavel: responsavel.trim() || null,
      });
      if (r.ok) {
        toast.success("Tarefa atualizada.");
        onSaved();
        onClose();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle>Editar tarefa</DialogTitle>
          <DialogDescription>{t.empresa}</DialogDescription>
        </div>
        <div className="px-5 py-4">
          <div className="mb-3">
            <label className={LABEL}>Descrição *</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={FIELD} placeholder="O que precisa ser feito" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Prazo</label>
              <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>Responsável</label>
              <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={FIELD} placeholder="Nome" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface2">
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={pending}
            className="rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-all hover:brightness-110 active:translate-y-px disabled:opacity-60"
          >
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── principal ─────────────────────────────

export function TasksView({ data, canWrite }: { data: TasksData; canWrite: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState<TaskRow | null>(null);
  const onChanged = () => router.refresh();

  const nenhuma = data.totalAbertas === 0 && data.concluidas.length === 0;

  if (nenhuma) {
    return (
      <EmptyState
        title="Nenhuma tarefa por aqui"
        hint="As tarefas nascem dentro de uma oportunidade — abra um registro e adicione a próxima ação para acompanhá-la aqui."
        action={
          <Link
            href="/opportunities"
            className="inline-flex items-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface2"
          >
            Ir para oportunidades
          </Link>
        }
      />
    );
  }

  return (
    <>
      <Group title="Atrasadas" tone="text-[color:var(--tom-critico)]" tasks={data.atrasadas} empty="Nenhuma tarefa atrasada." hoje={data.hoje} canWrite={canWrite} onChanged={onChanged} onEdit={setEditando} />
      <Group title="Hoje" tone="text-[color:var(--accent-blue)]" tasks={data.doDia} empty="Nada para hoje." hoje={data.hoje} canWrite={canWrite} onChanged={onChanged} onEdit={setEditando} />
      <Group title="Próximas" tone="text-text" tasks={data.proximas} empty="Nada agendado." hoje={data.hoje} canWrite={canWrite} onChanged={onChanged} onEdit={setEditando} />
      {data.concluidas.length > 0 && (
        <Group title="Concluídas" tone="text-muted" tasks={data.concluidas} empty="Nada concluído ainda." hoje={data.hoje} canWrite={canWrite} onChanged={onChanged} onEdit={setEditando} collapsible />
      )}

      {editando && <EditModal t={editando} onClose={() => setEditando(null)} onSaved={onChanged} />}
    </>
  );
}
