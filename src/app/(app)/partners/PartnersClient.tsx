"use client";

// Tela de administração de PARCEIROS (só admin) — CRUD com o visual do DS, espelhando
// `admin.js` do SPA legado: formulário em diálogo (novo/editar), tabela de cadastrados,
// redefinição de senha e remoção (soft delete).
//
// Toda a segurança vive no servidor (`admin.ts`): `senhaHash` NUNCA chega aqui, e cada
// ação reexige admin. Este componente só orquestra formulário, diálogos e toasts.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, KeyRound, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, THead, TH, TBody, TRow, TD } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import type {
  ActionResult,
  PartnerCreateInput,
  PartnerUpdateInput,
} from "@/lib/domain/admin";

export type PartnerRow = {
  id: number;
  nome: string;
  cnpj: string | null;
  site: string | null;
  login: string;
  email: string | null;
  ativo: boolean;
};

type Actions = {
  createPartner: (input: PartnerCreateInput) => Promise<ActionResult<unknown>>;
  updatePartner: (id: number, input: PartnerUpdateInput) => Promise<ActionResult<unknown>>;
  softDeletePartner: (id: number) => Promise<ActionResult>;
  setPartnerPassword: (id: number, novaSenha: string) => Promise<ActionResult>;
};

const fld =
  "w-full rounded-lg border border-border bg-surface2 px-3 py-1.5 text-sm text-text placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/30";
const lbl = "mb-1 block text-[10px] uppercase tracking-wide text-faint";
const btn =
  "inline-flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface2 disabled:opacity-60 max-sm:min-h-11";
const btnPrim =
  "inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-b from-[#f0339a] to-[#d81b80] px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-sm)] transition-opacity hover:opacity-95 disabled:opacity-60 max-sm:min-h-11";

type FormState = { nome: string; cnpj: string; site: string; login: string; email: string; senha: string };
const VAZIO: FormState = { nome: "", cnpj: "", site: "", login: "", email: "", senha: "" };

export function PartnersClient({ rows, actions }: { rows: PartnerRow[]; actions: Actions }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // Diálogo de novo/editar. `editId = null` → criação.
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(VAZIO);

  // Diálogo de redefinição de senha.
  const [senhaAlvo, setSenhaAlvo] = useState<PartnerRow | null>(null);
  const [novaSenha, setNovaSenha] = useState("");

  // Confirmação de remoção.
  const [remover, setRemover] = useState<PartnerRow | null>(null);

  function abrirNovo() {
    setEditId(null);
    setForm(VAZIO);
    setAberto(true);
  }

  function abrirEdicao(p: PartnerRow) {
    setEditId(p.id);
    setForm({
      nome: p.nome,
      cnpj: p.cnpj ?? "",
      site: p.site ?? "",
      login: p.login,
      email: p.email ?? "",
      senha: "",
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
    const login = form.login.trim();
    const senha = form.senha.trim();
    if (!nome || !login) {
      toast.warning("Nome e login são obrigatórios.");
      return;
    }
    if (editId == null && !senha) {
      toast.warning("Senha é obrigatória para um novo parceiro.");
      return;
    }
    if (senha && senha.length < 6) {
      toast.warning("A senha deve ter ao menos 6 caracteres.");
      return;
    }

    const payload = {
      nome,
      cnpj: form.cnpj.trim() || null,
      site: form.site.trim() || null,
      login,
      email: form.email.trim() || null,
    };

    start(async () => {
      const r =
        editId == null
          ? await actions.createPartner({ ...payload, senha })
          : await actions.updatePartner(editId, { ...payload, senha: senha || null });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? (editId == null ? "Parceiro cadastrado." : "Parceiro atualizado."));
      fechar();
      router.refresh();
    });
  }

  function confirmarSenha() {
    if (!senhaAlvo) return;
    if (novaSenha.trim().length < 6) {
      toast.warning("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    const alvo = senhaAlvo;
    start(async () => {
      const r = await actions.setPartnerPassword(alvo.id, novaSenha.trim());
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Senha redefinida.");
      setSenhaAlvo(null);
      setNovaSenha("");
    });
  }

  function confirmarRemocao() {
    if (!remover) return;
    const alvo = remover;
    setRemover(null);
    start(async () => {
      const r = await actions.softDeletePartner(alvo.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Parceiro removido.");
      router.refresh();
    });
  }

  return (
    <main className="w-full px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Building2 className="h-5 w-5 text-faint" aria-hidden /> Parceiros
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Cadastro dos parceiros de canal. Remover um parceiro é um arquivamento — as
            oportunidades vinculadas são mantidas.
          </p>
        </div>
        <button type="button" onClick={abrirNovo} className={btnPrim}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Novo parceiro
        </button>
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title="Nenhum parceiro cadastrado"
            hint="Cadastre o primeiro parceiro de canal para começar."
            action={
              <button type="button" onClick={abrirNovo} className={btnPrim}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Novo parceiro
              </button>
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>Parceiro</TH>
              <TH>Login</TH>
              <TH>E-mail</TH>
              <TH right> </TH>
            </THead>
            <TBody>
              {rows.map((p) => (
                <TRow key={p.id}>
                  <TD strong>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={p.nome} email={p.email} size={30} />
                      <span className="min-w-0">
                        <span className="block truncate">{p.nome}</span>
                        {p.cnpj && <span className="block text-[11px] font-normal text-faint">{p.cnpj}</span>}
                      </span>
                    </span>
                  </TD>
                  <TD>
                    <code className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-muted">{p.login}</code>
                  </TD>
                  <TD>{p.email || <span className="text-faint">—</span>}</TD>
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
                        onClick={() => { setSenhaAlvo(p); setNovaSenha(""); }}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted transition-colors hover:bg-surface2 max-sm:min-h-11"
                        title="Redefinir senha"
                      >
                        <KeyRound className="h-3.5 w-3.5" aria-hidden /> Senha
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemover(p)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs transition-colors hover:bg-surface2 max-sm:min-h-11"
                        style={{ color: "var(--tom-critico)" }}
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </TD>
                </TRow>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {/* ── novo / editar ─────────────────────────────────────────── */}
      <Dialog open={aberto} onOpenChange={(o) => { if (!o) fechar(); }}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex flex-col gap-4 p-5 pt-4">
            <div>
              <DialogTitle>{editId == null ? "Novo parceiro" : "Editar parceiro"}</DialogTitle>
              <DialogDescription className="mt-1">
                {editId == null
                  ? "Cadastre um parceiro de canal e defina a senha de acesso ao portal."
                  : "Atualize os dados do parceiro. Deixe a senha em branco para mantê-la."}
              </DialogDescription>
            </div>

            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => { e.preventDefault(); salvar(); }}
            >
              <div>
                <label className={lbl} htmlFor="p-nome">Nome *</label>
                <input id="p-nome" className={fld} value={form.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Razão social" maxLength={200} autoFocus />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={lbl} htmlFor="p-cnpj">CNPJ</label>
                  <input id="p-cnpj" className={fld} value={form.cnpj} onChange={(e) => set({ cnpj: e.target.value })} placeholder="00.000.000/0001-00" maxLength={30} />
                </div>
                <div>
                  <label className={lbl} htmlFor="p-site">Site</label>
                  <input id="p-site" className={fld} value={form.site} onChange={(e) => set({ site: e.target.value })} placeholder="https://parceiro.com.br" maxLength={300} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={lbl} htmlFor="p-login">Login *</label>
                  <input id="p-login" className={fld} value={form.login} onChange={(e) => set({ login: e.target.value })} placeholder="login.parceiro" maxLength={120} autoComplete="off" />
                </div>
                <div>
                  <label className={lbl} htmlFor="p-email">E-mail</label>
                  <input id="p-email" type="email" className={fld} value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="email@parceiro.com.br" maxLength={200} />
                </div>
              </div>
              <div>
                <label className={lbl} htmlFor="p-senha">
                  Senha {editId != null && <span className="normal-case text-faint">(em branco = manter atual)</span>}
                  {editId == null && " *"}
                </label>
                <input id="p-senha" type="password" className={fld} value={form.senha} onChange={(e) => set({ senha: e.target.value })} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
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

      {/* ── redefinir senha ───────────────────────────────────────── */}
      <Dialog open={senhaAlvo != null} onOpenChange={(o) => { if (!o) { setSenhaAlvo(null); setNovaSenha(""); } }}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col gap-4 p-5 pt-4">
            <div>
              <DialogTitle>Redefinir senha</DialogTitle>
              <DialogDescription className="mt-1">
                {senhaAlvo ? <>Nova senha de acesso para <strong className="text-text">{senhaAlvo.nome}</strong>.</> : null}
              </DialogDescription>
            </div>
            <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); confirmarSenha(); }}>
              <div>
                <label className={lbl} htmlFor="p-nova-senha">Nova senha</label>
                <input id="p-nova-senha" type="password" className={fld} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" autoFocus />
              </div>
              <div className="mt-1 flex justify-end gap-2">
                <button type="button" onClick={() => { setSenhaAlvo(null); setNovaSenha(""); }} className={btn}>Cancelar</button>
                <button type="submit" disabled={pending} className={btnPrim}>
                  {pending ? "Salvando…" : "Redefinir"}
                </button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── confirmação de remoção ────────────────────────────────── */}
      <ConfirmRemocao
        alvo={remover}
        onCancel={() => setRemover(null)}
        onConfirm={confirmarRemocao}
        pending={pending}
      />
    </main>
  );
}

// O AlertDialog do DS tem apenas um botão ("Entendi") — serve para avisos, não para
// confirmar/cancelar. Para a remoção usamos um diálogo próprio com dois botões.
function ConfirmRemocao({
  alvo,
  onCancel,
  onConfirm,
  pending,
}: {
  alvo: PartnerRow | null;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={alvo != null} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col gap-4 p-5 pt-4">
          <div>
            <DialogTitle>Remover parceiro</DialogTitle>
            <DialogDescription className="mt-1">
              {alvo ? <>Remover <strong className="text-text">{alvo.nome}</strong>? As oportunidades vinculadas serão mantidas. Esta ação arquiva o parceiro (soft delete).</> : null}
            </DialogDescription>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className={btn}>Cancelar</button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-sm)] transition-opacity hover:opacity-95 disabled:opacity-60 max-sm:min-h-11"
              style={{ background: "var(--tom-critico)" }}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> {pending ? "Removendo…" : "Remover"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
