"use client";

// Troca da própria senha do PARCEIRO. A action (`perfil.changePassword`) valida a senha
// atual e grava o novo hash (bcrypt) no servidor — nada de senha vive aqui além do que o
// usuário digita neste instante.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import type { ActionResult } from "@/lib/domain/perfil";

const fld =
  "w-full rounded-lg border border-border bg-surface2 px-3 py-1.5 text-sm text-text placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/30";
const lbl = "mb-1 block text-[10px] uppercase tracking-wide text-faint";
const btnPrim =
  "inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-b from-[#f0339a] to-[#d81b80] px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-sm)] transition-opacity hover:opacity-95 disabled:opacity-60 max-sm:min-h-11";

export function PerfilClient({
  changePassword,
}: {
  changePassword: (atual: string, nova: string) => Promise<ActionResult>;
}) {
  const [pending, start] = useTransition();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");

  function submeter() {
    if (!atual) {
      toast.warning("Informe a senha atual.");
      return;
    }
    if (nova.length < 6) {
      toast.warning("A nova senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (nova !== confirma) {
      toast.warning("A confirmação não confere com a nova senha.");
      return;
    }
    if (nova === atual) {
      toast.warning("A nova senha deve ser diferente da atual.");
      return;
    }
    start(async () => {
      const r = await changePassword(atual, nova);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Senha alterada com sucesso.");
      setAtual("");
      setNova("");
      setConfirma("");
    });
  }

  return (
    <section className="mt-6 max-w-md rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
        <KeyRound className="h-4 w-4 text-faint" aria-hidden /> Trocar senha
      </h2>
      <p className="mt-1 text-xs text-faint">
        Confirme a senha atual e defina uma nova (mínimo 6 caracteres).
      </p>
      <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submeter(); }}>
        <div>
          <label className={lbl} htmlFor="pf-atual">Senha atual</label>
          <input id="pf-atual" type="password" className={fld} value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" />
        </div>
        <div>
          <label className={lbl} htmlFor="pf-nova">Nova senha</label>
          <input id="pf-nova" type="password" className={fld} value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
        </div>
        <div>
          <label className={lbl} htmlFor="pf-confirma">Confirmar nova senha</label>
          <input id="pf-confirma" type="password" className={fld} value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="mt-1 flex justify-end">
          <button type="submit" disabled={pending} className={btnPrim}>
            {pending ? "Salvando…" : "Alterar senha"}
          </button>
        </div>
      </form>
    </section>
  );
}
