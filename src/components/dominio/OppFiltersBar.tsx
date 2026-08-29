"use client";

// Barra de filtros das listagens de OPORTUNIDADES (tabela, pipeline). Controlada:
// recebe `value` + `onChange`, não guarda a fonte da verdade. Espelha os filtros do
// SPA (busca, etapa, aprovação, parceiro) com o visual do DS — segmented control para
// aprovação, Combobox para etapa/parceiro, busca com ícone.

import { Search, X } from "lucide-react";
import { Combobox } from "@/components/ui/Combobox";

export type OppFiltros = {
  busca: string;
  status: string; // nome da etapa ("" = todas)
  aprovacao: "" | "Pendente" | "Aprovado" | "Rejeitado";
  parceiroId: string; // id como string ("" = todos)
};

export const FILTROS_VAZIOS: OppFiltros = { busca: "", status: "", aprovacao: "", parceiroId: "" };

const APROVACOES: { value: OppFiltros["aprovacao"]; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "Pendente", label: "Pendentes" },
  { value: "Aprovado", label: "Aprovadas" },
  { value: "Rejeitado", label: "Rejeitadas" },
];

export function OppFiltersBar({
  value,
  onChange,
  statusOptions,
  parceiroOptions,
  showParceiro = false,
  className = "",
}: {
  value: OppFiltros;
  onChange: (next: OppFiltros) => void;
  statusOptions: { id: number; nome: string }[];
  parceiroOptions?: { id: number; nome: string }[];
  showParceiro?: boolean;
  className?: string;
}) {
  const set = (patch: Partial<OppFiltros>) => onChange({ ...value, ...patch });
  const temFiltro = value.busca || value.status || value.aprovacao || value.parceiroId;

  const fieldCls =
    "h-9 w-full rounded-lg border border-border bg-field px-3 text-sm text-text shadow-[var(--field-inset)] outline-none transition-colors focus-within:border-[color:var(--accent)]";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Busca */}
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
        <input
          type="text"
          value={value.busca}
          onChange={(e) => set({ busca: e.target.value })}
          placeholder="Buscar empresa, contato, CNPJ…"
          className="h-9 w-full rounded-lg border border-border bg-field pl-8 pr-3 text-sm text-text shadow-[var(--field-inset)] outline-none transition-colors focus:border-[color:var(--accent)]"
          aria-label="Buscar oportunidades"
        />
      </div>

      {/* Etapa */}
      <div className="min-w-[160px]">
        <Combobox
          options={[{ value: "", label: "Todas as etapas" }, ...statusOptions.map((s) => ({ value: s.nome, label: s.nome }))]}
          value={value.status}
          onChange={(v) => set({ status: v })}
          placeholder="Etapa"
          sort={false}
          className={fieldCls}
        />
      </div>

      {/* Parceiro (admin/exec) */}
      {showParceiro && parceiroOptions && (
        <div className="min-w-[170px]">
          <Combobox
            options={[{ value: "", label: "Todos os parceiros" }, ...parceiroOptions.map((p) => ({ value: String(p.id), label: p.nome }))]}
            value={value.parceiroId}
            onChange={(v) => set({ parceiroId: v })}
            placeholder="Parceiro"
            className={fieldCls}
          />
        </div>
      )}

      {/* Aprovação — segmented control */}
      <div className="inline-flex rounded-lg border border-border bg-surface2 p-0.5" role="tablist" aria-label="Filtrar por aprovação">
        {APROVACOES.map((a) => {
          const active = value.aprovacao === a.value;
          return (
            <button
              key={a.value || "todas"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => set({ aprovacao: a.value })}
              className={
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors " +
                (active ? "bg-surface text-text shadow-[var(--shadow-sm)]" : "text-faint hover:text-text")
              }
            >
              {a.label}
            </button>
          );
        })}
      </div>

      {temFiltro && (
        <button
          type="button"
          onClick={() => onChange(FILTROS_VAZIOS)}
          className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-faint transition-colors hover:bg-surface2 hover:text-text"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Limpar
        </button>
      )}
    </div>
  );
}
