"use client";

// Modal de OPORTUNIDADE (criar/editar) — o coração da operação, portado de `ops.js`.
//
// Espelha o SPA:
//  - campos empresa/cnpj(máscara)/site/contato/cargo/obs, etapa (Combobox), fechamento
//    (month), valor estimado (máscara BRL);
//  - seletor de MÚLTIPLOS produtos agrupados por categoria em grupos colapsáveis
//    (espelha `_buildProdPicker`/`toggleProdCat`);
//  - checagem de DUPLICATA debounced (empresa/CNPJ) que bloqueia o salvar;
//  - barra de APROVAÇÃO inline para admin (aprovar / rejeitar com motivo / reverter);
//  - lista de TAREFAS editável (add/concluir/remover), com diff no servidor;
//  - parceiro só aparece para admin (parceiro tem o seu forçado no servidor).
//
// Toda a persistência acontece nas Server Actions de `@/lib/domain/opps` — este arquivo
// NÃO fala com o banco. O escopo e as permissões são reaplicados lá (o que a UI esconde,
// o servidor recusa).

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, Plus, Trash2, AlertTriangle, Check, CalendarClock, User2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/Combobox";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { AprovacaoBadge } from "@/components/dominio/AprovacaoBadge";
import { maskBRLInput, parseBRL } from "@/lib/money";
import {
  createOpp,
  updateOpp,
  saveTasks,
  approveOpp,
  rejectOpp,
  reverterRejeicao,
  softDeleteOpp,
  checkDuplicate,
  type TarefaInput,
} from "@/lib/domain/opps";

// ───────────────────────────── tipos ─────────────────────────────

export type ProdutoOpt = { id: number; nome: string; categoria: string | null };
export type StatusOpt = { id: number; nome: string };
export type ParceiroOpt = { id: number; nome: string };

/** Oportunidade recebida para EDIÇÃO (subconjunto do que a leitura devolve). */
export type OppParaEdicao = {
  id: number;
  empresa: string;
  cnpj?: string | null;
  siteEmpresa?: string | null;
  contato?: string | null;
  cargo?: string | null;
  obs?: string | null;
  statusId?: number | null;
  parceiroId?: number | null;
  fechamento?: string | null; // ISO ou "YYYY-MM-DD"
  valorEstimado?: number | null;
  aprovacao?: "Pendente" | "Aprovado" | "Rejeitado";
  motivoRejeicao?: string | null;
  produtoIds?: number[];
  tarefas?: {
    id: number | string;
    descricao: string | null;
    prazo?: string | null;
    responsavel?: string | null;
    concluida: boolean;
  }[];
};

type TarefaLocal = {
  id: number | string; // number = existe no banco; string ("new_...") = nova
  descricao: string;
  prazo: string | null;
  responsavel: string | null;
  concluida: boolean;
};

// ───────────────────────────── helpers ─────────────────────────────

function isoToMonth(v: string | null | undefined): string {
  if (!v) return "";
  const m = /^(\d{4})-(\d{2})/.exec(v);
  return m ? `${m[1]}-${m[2]}` : "";
}

function maskCnpj(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

const hoje = () => new Date().toISOString().slice(0, 10);

// campos de formulário reutilizáveis
const FIELD =
  "h-9 w-full rounded-lg border border-border bg-field px-3 text-sm text-text shadow-[var(--field-inset)] outline-none transition-colors focus:border-[color:var(--accent)] placeholder:text-faint";
const LABEL = "mb-1 block text-xs font-medium text-muted";

// ───────────────────────────── componente ─────────────────────────────

export type OppModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = criar; objeto = editar */
  opp?: OppParaEdicao | null;
  produtos: ProdutoOpt[];
  status: StatusOpt[];
  parceiros?: ParceiroOpt[];
  isAdmin?: boolean;
  audience?: "internal" | "partner";
  onSaved?: () => void;
};

/**
 * Casca do modal: mantém o `Dialog` (animação de abrir/fechar) e monta o formulário
 * SÓ quando aberto, com `key` na oportunidade. Isso reinicia o estado a cada abertura
 * sem um efeito de "reset" — o estado nasce direto das props via inicializadores.
 */
export function OppModal(props: OppModalProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <OppModalForm key={props.opp?.id ?? "novo"} {...props} />}
    </Dialog>
  );
}

function OppModalForm({
  onOpenChange,
  opp = null,
  produtos,
  status,
  parceiros = [],
  isAdmin = false,
  onSaved,
}: OppModalProps) {
  const editando = !!opp;
  const [pending, startTransition] = useTransition();

  // ── estado do formulário (inicializado a partir das props) ──
  const [empresa, setEmpresa] = useState(opp?.empresa ?? "");
  const [cnpj, setCnpj] = useState(opp?.cnpj ? maskCnpj(opp.cnpj) : "");
  const [site, setSite] = useState(opp?.siteEmpresa ?? "");
  const [contato, setContato] = useState(opp?.contato ?? "");
  const [cargo, setCargo] = useState(opp?.cargo ?? "");
  const [obs, setObs] = useState(opp?.obs ?? "");
  const [statusId, setStatusId] = useState<string>(opp?.statusId != null ? String(opp.statusId) : "");
  const [parceiroId, setParceiroId] = useState<string>(opp?.parceiroId != null ? String(opp.parceiroId) : "");
  const [fechamento, setFechamento] = useState(isoToMonth(opp?.fechamento));
  const [valor, setValor] = useState(opp?.valorEstimado != null ? maskBRLInput(String(Math.round(opp.valorEstimado * 100))) : "");
  const [prodIds, setProdIds] = useState<number[]>(opp?.produtoIds ?? []);
  const [tarefas, setTarefas] = useState<TarefaLocal[]>(
    (opp?.tarefas ?? []).map((t) => ({
      id: t.id,
      descricao: t.descricao ?? "",
      prazo: t.prazo ? t.prazo.slice(0, 10) : null,
      responsavel: t.responsavel ?? null,
      concluida: !!t.concluida,
    })),
  );

  // duplicata
  const [dupe, setDupe] = useState<{ empresa: string; parceiroNome: string | null } | null>(null);

  // ui auxiliar
  const [catAbertas, setCatAbertas] = useState<Set<string>>(new Set());
  const [prodOpen, setProdOpen] = useState(false);
  const [taskForm, setTaskForm] = useState<{ descricao: string; prazo: string; responsavel: string } | null>(null);
  const [rejeitando, setRejeitando] = useState(false);
  const [motivoRej, setMotivoRej] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [alerta, setAlerta] = useState<string | null>(null);

  // ── produtos por categoria (espelha _buildProdPicker) ──
  const categorias = useMemo(() => {
    const grupos = new Map<string, ProdutoOpt[]>();
    for (const p of produtos) {
      const cat = p.categoria || "Outros";
      const lista = grupos.get(cat) ?? [];
      lista.push(p);
      grupos.set(cat, lista);
    }
    return [...grupos.entries()];
  }, [produtos]);

  const nomesSelecionados = useMemo(
    () => prodIds.map((id) => produtos.find((p) => p.id === id)?.nome).filter(Boolean) as string[],
    [prodIds, produtos],
  );

  // ── checagem de duplicata (debounced) ──
  // O setState só acontece DENTRO do timeout (assíncrono), nunca no corpo síncrono
  // do efeito — evita cascata de renders (react-hooks/set-state-in-effect).
  useEffect(() => {
    const emp = empresa.trim();
    const cnpjDigits = cnpj.replace(/\D/g, "");
    const id = setTimeout(async () => {
      if (!emp && cnpjDigits.length < 14) {
        setDupe(null);
        return;
      }
      try {
        const r = await checkDuplicate(emp, cnpjDigits, opp?.id ?? null);
        if (r.ok && r.data) setDupe({ empresa: r.data.empresa, parceiroNome: r.data.parceiroNome });
        else setDupe(null);
      } catch {
        /* silencia erro de rede no check */
      }
    }, 600);
    return () => clearTimeout(id);
  }, [empresa, cnpj, opp?.id]);

  // ── ações de produto ──
  function toggleProd(id: number) {
    setProdIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  function toggleCat(cat: string) {
    setCatAbertas((cur) => {
      const next = new Set(cur);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  // ── tarefas ──
  function addTask() {
    if (!taskForm?.descricao.trim()) {
      setAlerta("Descreva a tarefa antes de adicionar.");
      return;
    }
    setTarefas((cur) => [
      ...cur,
      {
        id: "new_" + Date.now(),
        descricao: taskForm.descricao.trim(),
        prazo: taskForm.prazo || null,
        responsavel: taskForm.responsavel || null,
        concluida: false,
      },
    ]);
    setTaskForm(null);
  }
  function toggleDone(id: number | string) {
    setTarefas((cur) => cur.map((t) => (String(t.id) === String(id) ? { ...t, concluida: !t.concluida } : t)));
  }
  function removeTask(id: number | string) {
    setTarefas((cur) => cur.filter((t) => String(t.id) !== String(id)));
  }

  // ── salvar ──
  function salvar() {
    if (dupe) {
      setAlerta("Resolva a duplicata antes de salvar.");
      return;
    }
    if (!empresa.trim() || !contato.trim() || !statusId) {
      setAlerta("Preencha os campos obrigatórios: empresa, contato e etapa.");
      return;
    }
    if (!prodIds.length && !editando) {
      setAlerta("Selecione pelo menos um produto/serviço.");
      return;
    }
    if (isAdmin && !editando && !parceiroId) {
      setAlerta("Selecione o parceiro.");
      return;
    }

    const input = {
      empresa: empresa.trim(),
      cnpj: cnpj.replace(/\D/g, "") || null,
      siteEmpresa: site.trim() || null,
      contato: contato.trim(),
      cargo: cargo.trim() || null,
      obs: obs.trim() || null,
      statusId: Number(statusId),
      fechamento: fechamento || null,
      valorEstimado: parseBRL(valor),
      parceiroId: isAdmin && parceiroId ? Number(parceiroId) : null,
      produtoIds: prodIds,
    };

    const tarefasInput: TarefaInput[] = tarefas.map((t) => ({
      id: typeof t.id === "number" ? t.id : undefined,
      descricao: t.descricao,
      prazo: t.prazo,
      responsavel: t.responsavel,
      concluida: t.concluida,
    }));

    startTransition(async () => {
      try {
        if (editando && opp) {
          const r = await updateOpp(opp.id, input);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          const rt = await saveTasks(opp.id, tarefasInput);
          if (!rt.ok) {
            toast.error(rt.error);
            return;
          }
          toast.success("Oportunidade atualizada.");
        } else {
          const r = await createOpp(input);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          if (r.data && tarefasInput.length) {
            const rt = await saveTasks(r.data.id, tarefasInput);
            if (!rt.ok) toast.error(rt.error);
          }
          toast.success("Registrada! Aguardando aprovação.");
        }
        onOpenChange(false);
        onSaved?.();
      } catch (e) {
        toast.error("Erro ao salvar: " + (e instanceof Error ? e.message : "tente novamente"));
      }
    });
  }

  // ── aprovação (admin) ──
  function aprovar() {
    if (!opp) return;
    startTransition(async () => {
      const r = await approveOpp(opp.id);
      if (r.ok) {
        toast.success(r.message ?? "Aprovada.");
        onOpenChange(false);
        onSaved?.();
      } else toast.error(r.error);
    });
  }
  function confirmarRejeicao() {
    if (!opp) return;
    if (!motivoRej.trim()) {
      setAlerta("Informe o motivo da rejeição.");
      return;
    }
    startTransition(async () => {
      const r = await rejectOpp(opp.id, motivoRej.trim());
      if (r.ok) {
        toast.success(r.message ?? "Rejeitada.");
        onOpenChange(false);
        onSaved?.();
      } else toast.error(r.error);
    });
  }
  function reverter() {
    if (!opp) return;
    startTransition(async () => {
      const r = await reverterRejeicao(opp.id);
      if (r.ok) {
        toast.success(r.message ?? "Revertida.");
        onOpenChange(false);
        onSaved?.();
      } else toast.error(r.error);
    });
  }
  function excluir() {
    if (!opp) return;
    startTransition(async () => {
      const r = await softDeleteOpp(opp.id);
      if (r.ok) {
        toast.success(r.message ?? "Removida.");
        setConfirmDelete(false);
        onOpenChange(false);
        onSaved?.();
      } else toast.error(r.error);
    });
  }

  const mostrarBarraAprovacao = isAdmin && editando && (opp?.aprovacao === "Pendente" || opp?.aprovacao === "Rejeitado");

  return (
    <>
      <DialogContent className="sm:max-w-2xl">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <DialogTitle>{editando ? "Editar Oportunidade" : "Nova Oportunidade"}</DialogTitle>
              <DialogDescription>
                {editando ? "Ajuste os dados, produtos e tarefas." : "Preencha os dados para registrar uma nova oportunidade."}
              </DialogDescription>
            </div>
            {editando && opp?.aprovacao && <AprovacaoBadge aprovacao={opp.aprovacao} className="mt-1 shrink-0" />}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {/* Estado de aprovação/rejeição (leitura) */}
            {editando && opp?.aprovacao === "Rejeitado" && opp?.motivoRejeicao && (
              <div className="mb-4 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "color-mix(in srgb, var(--tom-critico) 35%, transparent)", background: "color-mix(in srgb, var(--tom-critico) 10%, transparent)", color: "var(--tom-critico)" }}>
                <strong>Rejeitada:</strong> {opp.motivoRejeicao}
              </div>
            )}

            {/* Barra de aprovação (admin) */}
            {mostrarBarraAprovacao && !rejeitando && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface2 px-3 py-2.5">
                <span className="text-sm text-muted">
                  {opp?.aprovacao === "Pendente" ? "Aguardando sua aprovação" : "Rejeição pode ser revertida"}
                </span>
                <div className="flex gap-2">
                  <button type="button" disabled={pending} onClick={aprovar} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-sm)] transition-colors disabled:opacity-60" style={{ background: "var(--tom-bom)" }}>
                    Aprovar
                  </button>
                  {opp?.aprovacao === "Pendente" ? (
                    <button type="button" disabled={pending} onClick={() => setRejeitando(true)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-sm)] transition-colors disabled:opacity-60" style={{ background: "var(--tom-critico)" }}>
                      Rejeitar
                    </button>
                  ) : (
                    <button type="button" disabled={pending} onClick={reverter} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:bg-surface2 disabled:opacity-60">
                      Reverter
                    </button>
                  )}
                </div>
              </div>
            )}
            {mostrarBarraAprovacao && rejeitando && (
              <div className="mb-4 rounded-lg border border-border bg-surface2 px-3 py-3">
                <label className={LABEL}>Motivo da rejeição *</label>
                <textarea value={motivoRej} onChange={(e) => setMotivoRej(e.target.value)} rows={3} className={FIELD + " h-auto py-2"} placeholder="Descreva o motivo…" />
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setRejeitando(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-faint hover:text-text">Cancelar</button>
                  <button type="button" disabled={pending} onClick={confirmarRejeicao} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ background: "var(--tom-critico)" }}>Confirmar rejeição</button>
                </div>
              </div>
            )}

            {/* Duplicata */}
            {dupe && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "color-mix(in srgb, var(--tom-atencao) 40%, transparent)", background: "color-mix(in srgb, var(--tom-atencao) 12%, transparent)", color: "var(--tom-atencao)" }}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <strong>“{dupe.empresa}”</strong> já está registrada{dupe.parceiroNome ? ` para “${dupe.parceiroNome}”` : ""}.
                </span>
              </div>
            )}

            {/* Campos */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={LABEL}>Empresa *</label>
                <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={FIELD} placeholder="Razão social / nome" />
              </div>
              <div>
                <label className={LABEL}>CNPJ</label>
                <input value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} className={FIELD} placeholder="00.000.000/0001-00" inputMode="numeric" />
              </div>
              <div>
                <label className={LABEL}>Site da empresa</label>
                <input value={site} onChange={(e) => setSite(e.target.value)} className={FIELD} placeholder="https://empresa.com.br" />
              </div>
              <div>
                <label className={LABEL}>Contato *</label>
                <input value={contato} onChange={(e) => setContato(e.target.value)} className={FIELD} placeholder="Nome do contato" />
              </div>
              <div>
                <label className={LABEL}>Cargo</label>
                <input value={cargo} onChange={(e) => setCargo(e.target.value)} className={FIELD} placeholder="Cargo do contato" />
              </div>

              {/* Produtos */}
              <div className="sm:col-span-2">
                <label className={LABEL}>Produtos / Serviços {!editando && "*"}</label>
                <button type="button" onClick={() => setProdOpen((v) => !v)} className={FIELD + " flex items-center justify-between text-left"}>
                  <span className={nomesSelecionados.length ? "flex flex-wrap gap-1" : "text-faint"}>
                    {nomesSelecionados.length ? (
                      nomesSelecionados.map((n) => (
                        <span key={n} className="rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-text">{n}</span>
                      ))
                    ) : (
                      "Selecione produtos/serviços…"
                    )}
                  </span>
                  <ChevronRight className={"h-4 w-4 shrink-0 text-faint transition-transform " + (prodOpen ? "rotate-90" : "")} aria-hidden />
                </button>
                {prodOpen && (
                  <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface">
                    {categorias.map(([cat, prods]) => {
                      const aberta = catAbertas.has(cat);
                      const selNaCat = prods.filter((p) => prodIds.includes(p.id)).length;
                      return (
                        <div key={cat} className="border-b border-border last:border-b-0">
                          <button type="button" onClick={() => toggleCat(cat)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-text hover:bg-surface2">
                            <ChevronRight className={"h-3.5 w-3.5 text-faint transition-transform " + (aberta ? "rotate-90" : "")} aria-hidden />
                            <span className="flex-1">{cat}</span>
                            <span className="rounded-full bg-surface2 px-1.5 text-[10px] text-faint">{selNaCat ? `${selNaCat}/${prods.length}` : prods.length}</span>
                          </button>
                          {aberta && (
                            <div className="pb-1">
                              {prods.map((p) => {
                                const checked = prodIds.includes(p.id);
                                return (
                                  <label key={p.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 pl-8 text-sm text-text hover:bg-surface2">
                                    <span className={"grid h-4 w-4 shrink-0 place-items-center rounded border " + (checked ? "border-transparent bg-[color:var(--accent)] text-white" : "border-border")}>
                                      {checked && <Check className="h-3 w-3" aria-hidden />}
                                    </span>
                                    <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleProd(p.id)} />
                                    {p.nome}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Etapa */}
              <div>
                <label className={LABEL}>Etapa *</label>
                <Combobox
                  options={status.map((s) => ({ value: String(s.id), label: s.nome }))}
                  value={statusId}
                  onChange={setStatusId}
                  placeholder="Selecione a etapa"
                  sort={false}
                  className={FIELD}
                />
              </div>

              {/* Parceiro (admin) */}
              {isAdmin && (
                <div>
                  <label className={LABEL}>Parceiro {!editando && "*"}</label>
                  <Combobox
                    options={parceiros.map((p) => ({ value: String(p.id), label: p.nome }))}
                    value={parceiroId}
                    onChange={setParceiroId}
                    placeholder="Selecione o parceiro"
                    className={FIELD}
                  />
                </div>
              )}

              {/* Fechamento */}
              <div>
                <label className={LABEL}>Previsão de fechamento</label>
                <input type="month" value={fechamento} onChange={(e) => setFechamento(e.target.value)} className={FIELD} />
              </div>

              {/* Valor */}
              <div>
                <label className={LABEL}>Valor estimado (R$)</label>
                <input value={valor} onChange={(e) => setValor(maskBRLInput(e.target.value))} className={FIELD} placeholder="0,00" inputMode="numeric" />
              </div>

              {/* Observações */}
              <div className="sm:col-span-2">
                <label className={LABEL}>Observações</label>
                <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={FIELD + " h-auto py-2"} placeholder="Notas internas…" />
              </div>
            </div>

            {/* Tarefas (só na edição — precisa de uma oportunidade salva) */}
            {editando && (
              <div className="mt-5 border-t border-border pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text">Tarefas</h3>
                  <button type="button" onClick={() => setTaskForm({ descricao: "", prazo: "", responsavel: "" })} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text transition-colors hover:bg-surface2">
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Adicionar
                  </button>
                </div>

                {taskForm && (
                  <div className="mb-3 grid grid-cols-1 gap-2 rounded-lg border border-border bg-surface2 p-3 sm:grid-cols-3">
                    <input value={taskForm.descricao} onChange={(e) => setTaskForm({ ...taskForm, descricao: e.target.value })} placeholder="Descrição *" className={FIELD + " sm:col-span-3"} />
                    <input type="date" value={taskForm.prazo} onChange={(e) => setTaskForm({ ...taskForm, prazo: e.target.value })} className={FIELD} />
                    <input value={taskForm.responsavel} onChange={(e) => setTaskForm({ ...taskForm, responsavel: e.target.value })} placeholder="Responsável" className={FIELD} />
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => setTaskForm(null)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-faint hover:text-text">Cancelar</button>
                      <button type="button" onClick={addTask} className="rounded-lg bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-white">Adicionar</button>
                    </div>
                  </div>
                )}

                {tarefas.length === 0 ? (
                  <p className="py-3 text-center text-xs text-faint">Nenhuma tarefa cadastrada.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {tarefas.map((t) => {
                      const atrasada = t.prazo && t.prazo < hoje() && !t.concluida;
                      return (
                        <li key={String(t.id)} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2">
                          <button type="button" onClick={() => toggleDone(t.id)} aria-pressed={t.concluida} className={"grid h-5 w-5 shrink-0 place-items-center rounded border " + (t.concluida ? "border-transparent bg-[color:var(--tom-bom)] text-white" : "border-border text-transparent")}>
                            <Check className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className={"truncate text-sm " + (t.concluida ? "text-faint line-through" : "text-text")}>{t.descricao}</div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-faint">
                              {t.prazo && (
                                <span className={atrasada ? "font-medium text-[color:var(--tom-critico)]" : ""}>
                                  <CalendarClock className="mr-0.5 inline h-3 w-3" aria-hidden />
                                  {atrasada ? "Vencida: " : ""}
                                  {t.prazo.split("-").reverse().join("/")}
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
                          <button type="button" onClick={() => removeTask(t.id)} aria-label="Remover tarefa" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-surface2 hover:text-[color:var(--tom-critico)]">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-3">
            <div>
              {editando && (
                <button type="button" disabled={pending} onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[color:var(--tom-critico)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--tom-critico)_12%,transparent)] disabled:opacity-60">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Excluir
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface2">
                Cancelar
              </button>
              <button type="button" disabled={pending || !!dupe} onClick={salvar} className="rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-all hover:brightness-110 active:translate-y-px disabled:opacity-60">
                {pending ? "Salvando…" : editando ? "Salvar" : "Registrar"}
              </button>
            </div>
          </div>
      </DialogContent>

      {alerta && <AlertDialog message={alerta} onClose={() => setAlerta(null)} />}
      {confirmDelete && opp && (
        <ConfirmDelete empresa={opp.empresa} pending={pending} onCancel={() => setConfirmDelete(false)} onConfirm={excluir} />
      )}
    </>
  );
}

// ── confirmação de exclusão (bottom-sheet/diálogo simples portado) ──
function ConfirmDelete({
  empresa,
  pending,
  onCancel,
  onConfirm,
}: {
  empresa: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm" showClose={false}>
        <div className="px-5 py-4">
          <DialogTitle>Excluir oportunidade</DialogTitle>
          <DialogDescription className="mt-1">
            Remover “{empresa}”? A oportunidade sai das listas (soft delete) e pode ser auditada depois.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface2">
              Cancelar
            </button>
            <button type="button" disabled={pending} onClick={onConfirm} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--tom-critico)" }}>
              {pending ? "Excluindo…" : "Excluir"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
