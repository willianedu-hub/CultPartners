"use client";

// CRUD das ETAPAS do funil (só admin) — visual do DS, espelhando o bloco de status de
// `admin.js`. Cada etapa tem nome, cor (StatusFunil.cor) e ordem. Além de criar/editar,
// permite reordenar (setas) e desativar/reativar sem apagar (preserva o histórico).
//
// Toda a segurança vive no servidor (`admin.ts`): cada ação reexige admin.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, GitBranch, EyeOff, Eye, ArrowUp, ArrowDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, THead, TH, TBody, TRow, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/dominio/StatusBadge";
import type {
  ActionResult,
  StatusCreateInput,
  StatusUpdateInput,
} from "@/lib/domain/admin";

export type StatusRow = {
  id: number;
  nome: string;
  cor: string;
  ordem: number;
  ativo: boolean;
};

type Actions = {
  createStatus: (input: StatusCreateInput) => Promise<ActionResult<unknown>>;
  updateStatus: (id: number, input: StatusUpdateInput) => Promise<ActionResult<unknown>>;
  deactivateStatus: (id: number) => Promise<ActionResult>;
  reorderStatus: (ordens: { id: number; ordem: number }[]) => Promise<ActionResult>;
};

const COR_PADRAO = "#7c3aed";
const fld =
  "w-full rounded-lg border border-border bg-surface2 px-3 py-1.5 text-sm text-text placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/30";
const lbl = "mb-1 block text-[10px] uppercase tracking-wide text-faint";
const btn =
  "inline-flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface2 disabled:opacity-60 max-sm:min-h-11";
const btnPrim =
  "inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-b from-[#f0339a] to-[#d81b80] px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-sm)] transition-opacity hover:opacity-95 disabled:opacity-60 max-sm:min-h-11";
const iconBtn =
  "inline-grid h-7 w-7 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface2 disabled:opacity-40 max-sm:h-9 max-sm:w-9";

type FormState = { nome: string; cor: string; ordem: string };
const VAZIO: FormState = { nome: "", cor: COR_PADRAO, ordem: "" };

export function FunilClient({ rows, actions }: { rows: StatusRow[]; actions: Actions }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(VAZIO);

  function abrirNovo() {
    setEditId(null);
    setForm({ ...VAZIO, ordem: String(rows.length + 1) });
    setAberto(true);
  }
  function abrirEdicao(s: StatusRow) {
    setEditId(s.id);
    setForm({ nome: s.nome, cor: s.cor || COR_PADRAO, ordem: String(s.ordem ?? "") });
    setAberto(true);
  }
  function fechar() {
    setAberto(false);
    setEditId(null);
    setForm(VAZIO);
  }
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  function salvar() {
    const nome = form.nome.trim();
    if (!nome) {
      toast.warning("O nome é obrigatório.");
      return;
    }
    const payload = {
      nome,
      cor: form.cor || COR_PADRAO,
      ordem: form.ordem.trim() === "" ? null : Number(form.ordem),
    };
    start(async () => {
      const r =
        editId == null
          ? await actions.createStatus(payload)
          : await actions.updateStatus(editId, payload);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Etapa salva.");
      fechar();
      router.refresh();
    });
  }

  function toggleAtivo(s: StatusRow) {
    start(async () => {
      const r = s.ativo
        ? await actions.deactivateStatus(s.id)
        : await actions.updateStatus(s.id, { nome: s.nome, cor: s.cor, ordem: s.ordem, ativo: true });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? (s.ativo ? "Etapa desativada." : "Etapa reativada."));
      router.refresh();
    });
  }

  // Move a etapa `idx` para cima/baixo trocando a `ordem` com a vizinha e gravando o par.
  function mover(idx: number, dir: -1 | 1) {
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= rows.length) return;
    const a = rows[idx];
    const b = rows[alvo];
    start(async () => {
      const r = await actions.reorderStatus([
        { id: a.id, ordem: b.ordem },
        { id: b.id, ordem: a.ordem },
      ]);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Ordem atualizada.");
      router.refresh();
    });
  }

  return (
    <main className="w-full px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <GitBranch className="h-5 w-5 text-faint" aria-hidden /> Etapas do funil
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Etapas do pipeline de oportunidades, com cor e ordem. Desativar uma etapa não
            apaga o histórico: as oportunidades vinculadas são mantidas.
          </p>
        </div>
        <button type="button" onClick={abrirNovo} className={btnPrim}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Nova etapa
        </button>
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title="Nenhuma etapa cadastrada"
            hint="Crie a primeira etapa do funil de oportunidades."
            action={
              <button type="button" onClick={abrirNovo} className={btnPrim}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Nova etapa
              </button>
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>Etapa</TH>
              <TH>Cor</TH>
              <TH>Ordem</TH>
              <TH>Situação</TH>
              <TH right> </TH>
            </THead>
            <TBody>
              {rows.map((s, idx) => (
                <TRow key={s.id}>
                  <TD strong>
                    <span className={s.ativo ? "" : "opacity-60"}>
                      <StatusBadge nome={s.nome} cor={s.cor} />
                    </span>
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-4 w-4 rounded" style={{ background: s.cor }} aria-hidden />
                      <code className="font-mono text-[11px] text-faint">{s.cor}</code>
                    </span>
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-1">
                      {s.ordem}
                      <span className="ml-1 inline-flex gap-0.5">
                        <button type="button" onClick={() => mover(idx, -1)} disabled={pending || idx === 0} className={iconBtn} title="Subir" aria-label="Subir">
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button type="button" onClick={() => mover(idx, 1)} disabled={pending || idx === rows.length - 1} className={iconBtn} title="Descer" aria-label="Descer">
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </span>
                    </span>
                  </TD>
                  <TD>
                    <span className="text-xs font-semibold" style={{ color: s.ativo ? "var(--tom-bom)" : "var(--tom-atencao)" }}>
                      {s.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </TD>
                  <TD right>
                    <div className="inline-flex items-center gap-1">
                      <button type="button" onClick={() => abrirEdicao(s)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted transition-colors hover:bg-surface2 max-sm:min-h-11" title="Editar">
                        <Pencil className="h-3.5 w-3.5" aria-hidden /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAtivo(s)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs transition-colors hover:bg-surface2 disabled:opacity-60 max-sm:min-h-11"
                        style={{ color: s.ativo ? "var(--tom-critico)" : "var(--tom-bom)" }}
                        title={s.ativo ? "Desativar" : "Reativar"}
                      >
                        {s.ativo ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
                        {s.ativo ? "Desativar" : "Reativar"}
                      </button>
                    </div>
                  </TD>
                </TRow>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <Dialog open={aberto} onOpenChange={(o) => { if (!o) fechar(); }}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col gap-4 p-5 pt-4">
            <div>
              <DialogTitle>{editId == null ? "Nova etapa" : "Editar etapa"}</DialogTitle>
              <DialogDescription className="mt-1">
                Etapa do funil de oportunidades, com cor de destaque e ordem de exibição.
              </DialogDescription>
            </div>
            <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
              <div>
                <label className={lbl} htmlFor="s-nome">Nome *</label>
                <input id="s-nome" className={fld} value={form.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex: Em Avaliação" maxLength={120} autoFocus />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={lbl} htmlFor="s-cor">Cor</label>
                  <div className="flex items-center gap-2">
                    <input id="s-cor" type="color" value={form.cor} onChange={(e) => set({ cor: e.target.value })} className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-surface2 p-1" />
                    <input aria-label="Cor (hex)" className={`${fld} font-mono text-xs`} value={form.cor} onChange={(e) => set({ cor: e.target.value })} placeholder="#7c3aed" maxLength={7} />
                  </div>
                </div>
                <div>
                  <label className={lbl} htmlFor="s-ordem">Ordem</label>
                  <input id="s-ordem" type="number" min={0} max={999} className={fld} value={form.ordem} onChange={(e) => set({ ordem: e.target.value })} placeholder="Ex: 1" />
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface2/50 px-3 py-2">
                <span className="mb-1.5 block text-[10px] uppercase tracking-wide text-faint">Prévia</span>
                <StatusBadge nome={form.nome.trim() || "Etapa"} cor={form.cor} />
              </div>
              <div className="mt-1 flex justify-end gap-2">
                <button type="button" onClick={fechar} className={btn}>Cancelar</button>
                <button type="submit" disabled={pending} className={btnPrim}>
                  {pending ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
