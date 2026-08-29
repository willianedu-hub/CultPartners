"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { OPS, VALUELESS, fieldMaps, type FieldDef, type FilterCond, type FilterOp } from "@/lib/filters";

// max-sm:py-2.5 → alvo de toque ~42px nos campos no celular (no desktop, inalterado).
const fld = "campo rounded-lg px-2.5 py-1.5 text-sm max-sm:py-2.5";

/**
 * Campo de valor da condição — de propósito FORA do modal: como componente interno,
 * o React remontava o input a cada tecla (tipo de componente novo em cada render) e o
 * teclado do celular fechava a cada caractere.
 */
function ValueInput({
  cond, def, options, onChange,
}: {
  cond: FilterCond;
  def: FieldDef | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  if (!def || VALUELESS.includes(cond.op)) return <div className="flex-1 text-xs text-faint max-sm:col-span-2">—</div>;
  if (def.type === "enum") {
    return (
      <select value={cond.value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${fld} flex-1 max-sm:col-span-2`}>
        <option value="">Selecione…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  const type = def.type === "date" ? "date" : def.type === "number" ? "number" : "text";
  return <input type={type} value={cond.value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Valor" className={`${fld} flex-1 max-sm:col-span-2`} />;
}

/** Modal de filtro avançado genérico — múltiplas condições ao mesmo tempo. */
export function DataFilterModal({
  conditions, onApply, onClose, fields, enumOptions, title = "Filtro avançado",
}: {
  conditions: FilterCond[];
  onApply: (conds: FilterCond[]) => void;
  onClose: () => void;
  fields: FieldDef[];
  enumOptions: (field: string) => { value: string; label: string }[];
  title?: string;
}) {
  const { byKey } = useMemo(() => fieldMaps(fields), [fields]);
  const first = fields[0]?.key ?? "";
  const firstCond = (): FilterCond => {
    const type = byKey[first]?.type ?? "text";
    return { field: first, op: OPS[type][0].op, value: "" };
  };
  const [draft, setDraft] = useState<FilterCond[]>(conditions.length ? conditions : [firstCond()]);

  function update(i: number, patch: Partial<FilterCond>) {
    setDraft((d) => d.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function changeField(i: number, field: string) {
    const type = byKey[field].type;
    setDraft((d) => d.map((c, idx) => (idx === i ? { field, op: OPS[type][0].op, value: "" } : c)));
  }
  function changeOp(i: number, op: FilterOp) {
    update(i, { op, value: VALUELESS.includes(op) ? "" : draft[i].value });
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent showClose={false} aria-describedby={undefined} className="sm:max-w-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-text">
            <SlidersHorizontal className="h-5 w-5 text-[#00BCD4]" aria-hidden /> {title}
          </DialogTitle>
          <button onClick={onClose} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-surface2 hover:text-text max-sm:h-10 max-sm:w-10">✕</button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {draft.length === 0 && <p className="py-6 text-center text-sm text-faint">Nenhuma condição. Adicione uma abaixo.</p>}
          {draft.map((c, i) => {
            const type = byKey[c.field]?.type ?? "text";
            return (
              /* Mobile: grade 2 col (rótulo + lixeira na 1ª linha; campos empilhados); desktop: linha única. */
              <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-2 sm:flex">
                <span className="text-[11px] text-faint sm:w-6 sm:shrink-0 sm:text-center">{i === 0 ? "onde" : "e"}</span>
                <select value={c.field} onChange={(e) => changeField(i, e.target.value)} className={`${fld} w-full shrink-0 max-sm:col-span-2 sm:w-40`}>
                  {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <select value={c.op} onChange={(e) => changeOp(i, e.target.value as FilterOp)} className={`${fld} w-full shrink-0 max-sm:col-span-2 sm:w-36`}>
                  {OPS[type].map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
                </select>
                <ValueInput
                  cond={c}
                  def={byKey[c.field]}
                  options={byKey[c.field]?.type === "enum" ? enumOptions(c.field) : []}
                  onChange={(value) => update(i, { value })}
                />
                <button onClick={() => setDraft((d) => d.filter((_, idx) => idx !== i))} aria-label="Remover" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint hover:bg-surface2 hover:text-red-400 max-sm:col-start-2 max-sm:row-start-1 max-sm:h-10 max-sm:w-10">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            );
          })}
          <button
            onClick={() => setDraft((d) => [...d, firstCond()])}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface2 hover:text-text max-sm:min-h-11"
          >
            <Plus className="h-4 w-4" aria-hidden /> Adicionar condição
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-3">
          <button onClick={() => setDraft([])} className="text-sm text-faint hover:text-muted max-sm:min-h-11">Limpar tudo</button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface2 max-sm:min-h-11">Cancelar</button>
            <button
              onClick={() => { onApply(draft.filter((c) => VALUELESS.includes(c.op) || (c.value ?? "") !== "")); onClose(); }}
              className="rounded-lg bg-[#e91e8c] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-all hover:bg-[#d81b80] active:translate-y-px max-sm:min-h-11"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
