"use client";

// CRUD de PRODUTOS / serviços do catálogo (só admin) — visual do DS, espelhando o bloco
// de produtos de `admin.js`. Formulário em diálogo (novo/editar), tabela de cadastrados,
// desativação (não apaga: preserva as oportunidades vinculadas) e reativação.
//
// Toda a segurança vive no servidor (`admin.ts`): cada ação reexige admin.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Package, EyeOff, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, THead, TH, TBody, TRow, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import type {
  ActionResult,
  ProdutoCreateInput,
  ProdutoUpdateInput,
} from "@/lib/domain/admin";

export type ProductRow = {
  id: number;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
};

type Actions = {
  createProduct: (input: ProdutoCreateInput) => Promise<ActionResult<unknown>>;
  updateProduct: (id: number, input: ProdutoUpdateInput) => Promise<ActionResult<unknown>>;
  deactivateProduct: (id: number) => Promise<ActionResult>;
};

const fld =
  "w-full rounded-lg border border-border bg-surface2 px-3 py-1.5 text-sm text-text placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/30";
const lbl = "mb-1 block text-[10px] uppercase tracking-wide text-faint";
const btn =
  "inline-flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface2 disabled:opacity-60 max-sm:min-h-11";
const btnPrim =
  "inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-b from-[#f0339a] to-[#d81b80] px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-sm)] transition-opacity hover:opacity-95 disabled:opacity-60 max-sm:min-h-11";

type FormState = { nome: string; categoria: string; descricao: string; ordem: string };
const VAZIO: FormState = { nome: "", categoria: "", descricao: "", ordem: "" };

export function ProductsClient({ rows, actions }: { rows: ProductRow[]; actions: Actions }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(VAZIO);

  function abrirNovo() {
    setEditId(null);
    setForm(VAZIO);
    setAberto(true);
  }
  function abrirEdicao(p: ProductRow) {
    setEditId(p.id);
    setForm({
      nome: p.nome,
      categoria: p.categoria ?? "",
      descricao: p.descricao ?? "",
      ordem: String(p.ordem ?? ""),
    });
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
      categoria: form.categoria.trim() || null,
      descricao: form.descricao.trim() || null,
      ordem: form.ordem.trim() === "" ? null : Number(form.ordem),
    };
    start(async () => {
      const r =
        editId == null
          ? await actions.createProduct(payload)
          : await actions.updateProduct(editId, payload);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Produto salvo.");
      fechar();
      router.refresh();
    });
  }

  function toggleAtivo(p: ProductRow) {
    start(async () => {
      const r = p.ativo
        ? await actions.deactivateProduct(p.id)
        : await actions.updateProduct(p.id, {
            nome: p.nome,
            categoria: p.categoria,
            descricao: p.descricao,
            ordem: p.ordem,
            ativo: true,
          });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? (p.ativo ? "Produto desativado." : "Produto reativado."));
      router.refresh();
    });
  }

  return (
    <main className="w-full px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Package className="h-5 w-5 text-faint" aria-hidden /> Produtos e serviços
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Catálogo oferecido pelos parceiros. Desativar um produto não apaga o histórico:
            as oportunidades vinculadas são mantidas.
          </p>
        </div>
        <button type="button" onClick={abrirNovo} className={btnPrim}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Novo produto
        </button>
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title="Nenhum produto cadastrado"
            hint="Cadastre o primeiro produto ou serviço do catálogo."
            action={
              <button type="button" onClick={abrirNovo} className={btnPrim}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Novo produto
              </button>
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>Produto</TH>
              <TH>Categoria</TH>
              <TH>Ordem</TH>
              <TH>Situação</TH>
              <TH right> </TH>
            </THead>
            <TBody>
              {rows.map((p) => (
                <TRow key={p.id}>
                  <TD strong>
                    <span className={p.ativo ? "" : "opacity-60"}>
                      <span className="block">{p.nome}</span>
                      {p.descricao && <span className="block max-w-md truncate text-[11px] font-normal text-faint">{p.descricao}</span>}
                    </span>
                  </TD>
                  <TD>
                    {p.categoria ? (
                      <span
                        className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-ink-magenta"
                        style={{ background: "color-mix(in srgb, var(--brand-magenta) 12%, transparent)" }}
                      >
                        {p.categoria}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </TD>
                  <TD>{p.ordem}</TD>
                  <TD>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: p.ativo ? "var(--tom-bom)" : "var(--tom-atencao)" }}
                    >
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </TD>
                  <TD right>
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(p)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted transition-colors hover:bg-surface2 max-sm:min-h-11"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAtivo(p)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs transition-colors hover:bg-surface2 disabled:opacity-60 max-sm:min-h-11"
                        style={{ color: p.ativo ? "var(--tom-critico)" : "var(--tom-bom)" }}
                        title={p.ativo ? "Desativar" : "Reativar"}
                      >
                        {p.ativo ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
                        {p.ativo ? "Desativar" : "Reativar"}
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
        <DialogContent className="sm:max-w-lg">
          <div className="flex flex-col gap-4 p-5 pt-4">
            <div>
              <DialogTitle>{editId == null ? "Novo produto" : "Editar produto"}</DialogTitle>
              <DialogDescription className="mt-1">
                Produto ou serviço do catálogo oferecido pelos parceiros.
              </DialogDescription>
            </div>
            <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
              <div>
                <label className={lbl} htmlFor="pr-nome">Nome *</label>
                <input id="pr-nome" className={fld} value={form.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex: Conscientização Avançada" maxLength={200} autoFocus />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={lbl} htmlFor="pr-cat">Categoria</label>
                  <input id="pr-cat" className={fld} value={form.categoria} onChange={(e) => set({ categoria: e.target.value })} placeholder="Treinamento, Consultoria…" maxLength={120} />
                </div>
                <div>
                  <label className={lbl} htmlFor="pr-ordem">Ordem</label>
                  <input id="pr-ordem" type="number" min={0} max={999} className={fld} value={form.ordem} onChange={(e) => set({ ordem: e.target.value })} placeholder="Ex: 1" />
                </div>
              </div>
              <div>
                <label className={lbl} htmlFor="pr-desc">Descrição</label>
                <textarea id="pr-desc" rows={3} className={`${fld} resize-y`} value={form.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="Breve descrição do produto" maxLength={2000} />
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
