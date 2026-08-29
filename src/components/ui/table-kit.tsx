"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Filter, Columns3, Check, ArrowUp, ArrowDown, ArrowUpDown, ArrowLeft,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { matchesConditions, type FieldDef, type FilterCond, type FilterType } from "@/lib/filters";

export type SortDir = "asc" | "desc";

export type ColDef = {
  key: string;
  label: string;
  Icon: LucideIcon;
  field?: string;      // chave do FieldDef p/ filtro de coluna (opcional)
  right?: boolean;     // alinha à direita (números)
  center?: boolean;    // centraliza (contagens/chips)
  noSort?: boolean;    // desabilita ordenação
};

/** Colunas visíveis persistidas por usuário (localStorage). */
export function useLocalCols(storageKey: string, defaults: string[]): [string[], (v: string[]) => void] {
  const [cols, setCols] = useState<string[]>(defaults);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) { const arr = JSON.parse(raw) as string[]; if (Array.isArray(arr)) setCols(arr); }
    } catch { /* ignore */ }
  }, [storageKey]);
  const set = (next: string[]) => {
    setCols(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
  };
  return [cols, set];
}

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

/** Motor client-side: filtra, ordena e pagina as linhas. */
export function useClientTable<T extends Record<string, unknown>>({
  rows, fields, getValue, sortAccessor, initialSort, initialDir = "asc", defaultSize = 15,
}: {
  rows: T[];
  fields: FieldDef[];
  getValue?: (row: T, key: string) => unknown;
  sortAccessor: (row: T, key: string) => string | number | null;
  initialSort: string;
  initialDir?: SortDir;
  defaultSize?: number;
}) {
  const [conditions, setConditions] = useState<FilterCond[]>([]);
  const [sort, setSort] = useState(initialSort);
  const [dir, setDir] = useState<SortDir>(initialDir);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(defaultSize);

  const typeByField = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, f.type])) as Record<string, FilterType>, [fields]);

  const filtered = useMemo(
    () => (conditions.length ? rows.filter((r) => matchesConditions(r, conditions, typeByField, getValue)) : rows),
    [rows, conditions, typeByField, getValue],
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = sortAccessor(a, sort); const bv = sortAccessor(b, sort);
      if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : 1; // nulls por último
      if (bv === null || bv === undefined) return -1;
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = collator.compare(String(av), String(bv));
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort, dir, sortAccessor]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const curPage = Math.min(page, totalPages);
  const view = sorted.slice((curPage - 1) * size, curPage * size);
  const from = total === 0 ? 0 : (curPage - 1) * size + 1;
  const to = Math.min(curPage * size, total);

  function sortBy(key: string, numericDefault = false) {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(key); setDir(numericDefault ? "desc" : "asc"); }
    setPage(1);
  }
  function replaceField(field: string, next: FilterCond[]) {
    setConditions((cs) => [...cs.filter((c) => c.field !== field), ...next]);
    setPage(1);
  }
  function applyConditions(next: FilterCond[]) { setConditions(next); setPage(1); }

  return {
    conditions, setConditions: applyConditions, replaceField,
    sort, dir, sortBy,
    page: curPage, setPage, size, setSize,
    view, total, totalPages, from, to,
  };
}

export function HeaderCell({
  col, sort, dir, onSort, conditions, onReplaceField, fields, enumOptions,
}: {
  col: ColDef; sort: string; dir: SortDir; onSort: (key: string) => void;
  conditions: FilterCond[]; onReplaceField: (field: string, conds: FilterCond[]) => void;
  fields: Record<string, FieldDef>; enumOptions: (field: string) => { value: string; label: string }[];
}) {
  const active = sort === col.key;
  const activeFilter = col.field ? conditions.some((c) => c.field === col.field) : false;
  return (
    <th className={`px-4 py-3 font-bold ${col.right ? "text-right" : col.center ? "text-center" : ""}`}>
      <div className={`inline-flex items-center gap-1 ${col.right ? "flex-row-reverse" : ""}`}>
        <button
          onClick={() => !col.noSort && onSort(col.key)}
          disabled={col.noSort}
          className={`group inline-flex items-center gap-1.5 transition-colors ${col.noSort ? "cursor-default" : "hover:text-ink-magenta"} ${active ? "text-ink-magenta" : "text-text"}`}
        >
          <col.Icon className="h-3.5 w-3.5" aria-hidden />
          {col.label}
          {!col.noSort && (active
            ? (dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />)
            : <ArrowUpDown className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />)}
        </button>
        {col.field && fields[col.field] && (
          <ColumnFilter field={fields[col.field]} label={col.label} conditions={conditions} onReplaceField={onReplaceField} enumOptions={enumOptions} active={activeFilter} />
        )}
      </div>
    </th>
  );
}

function ColumnFilter({
  field, label, conditions, onReplaceField, enumOptions, active,
}: {
  field: FieldDef; label: string; conditions: FilterCond[];
  onReplaceField: (field: string, conds: FilterCond[]) => void;
  enumOptions: (field: string) => { value: string; label: string }[]; active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const type = field.type;
  const current = conditions.filter((c) => c.field === field.key);
  const inp = "campo w-full rounded-md px-2 py-1 text-xs";

  const [text, setText] = useState(current.find((c) => c.op === "contains")?.value ?? "");
  const [enumVal, setEnumVal] = useState(current.find((c) => c.op === "eq")?.value ?? "");
  const [min, setMin] = useState(current.find((c) => c.op === "gte")?.value ?? "");
  const [max, setMax] = useState(current.find((c) => c.op === "lte")?.value ?? "");
  const [from, setFrom] = useState(current.find((c) => c.op === "after")?.value ?? "");
  const [until, setUntil] = useState(current.find((c) => c.op === "before")?.value ?? "");
  const [boolVal, setBoolVal] = useState<string>(current.find((c) => c.op === "isTrue" || c.op === "isFalse")?.op ?? "");

  function apply() {
    const next: FilterCond[] = [];
    if (type === "text" && text.trim()) next.push({ field: field.key, op: "contains", value: text.trim() });
    if (type === "enum" && enumVal) next.push({ field: field.key, op: "eq", value: enumVal });
    if (type === "number") {
      if (min !== "") next.push({ field: field.key, op: "gte", value: min });
      if (max !== "") next.push({ field: field.key, op: "lte", value: max });
    }
    if (type === "date") {
      if (from) next.push({ field: field.key, op: "after", value: from });
      if (until) next.push({ field: field.key, op: "before", value: until });
    }
    if (type === "boolean" && boolVal) next.push({ field: field.key, op: boolVal as "isTrue" | "isFalse" });
    onReplaceField(field.key, next);
    setOpen(false);
  }
  function clear() {
    setText(""); setEnumVal(""); setMin(""); setMax(""); setFrom(""); setUntil(""); setBoolVal("");
    onReplaceField(field.key, []);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={(e) => e.stopPropagation()}
        title="Filtrar coluna"
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors ${active ? "bg-[#00BCD4]/15 text-[#00BCD4]" : "text-faint hover:bg-surface hover:text-text"}`}
      >
        <Filter className="h-3 w-3" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Filtrar {label}</div>
        {type === "text" && <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()} placeholder="contém…" className={inp} />}
        {type === "enum" && (
          <select value={enumVal} onChange={(e) => setEnumVal(e.target.value)} className={inp}>
            <option value="">Todos</option>
            {enumOptions(field.key).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {type === "number" && (
          <div className="flex items-center gap-1.5">
            <input value={min} onChange={(e) => setMin(e.target.value)} type="number" placeholder="mín" className={inp} />
            <span className="text-xs text-faint">–</span>
            <input value={max} onChange={(e) => setMax(e.target.value)} type="number" placeholder="máx" className={inp} />
          </div>
        )}
        {type === "date" && (
          <div className="space-y-1.5">
            <label className="block text-[10px] text-faint">De<input value={from} onChange={(e) => setFrom(e.target.value)} type="date" className={inp} /></label>
            <label className="block text-[10px] text-faint">Até<input value={until} onChange={(e) => setUntil(e.target.value)} type="date" className={inp} /></label>
          </div>
        )}
        {type === "boolean" && (
          <select value={boolVal} onChange={(e) => setBoolVal(e.target.value)} className={inp}>
            <option value="">Todos</option>
            <option value="isTrue">Sim</option>
            <option value="isFalse">Não</option>
          </select>
        )}
        <div className="mt-3 flex items-center justify-between">
          <button onClick={clear} className="text-xs text-faint hover:text-muted">Limpar</button>
          <button onClick={apply} className="rounded-md bg-[#e91e8c] px-3 py-1 text-xs font-semibold text-white hover:bg-[#d81b80]">Aplicar</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ColumnChooser({ all, visible, onChange }: { all: ColDef[]; visible: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  function toggle(k: string) {
    const set = new Set(visible);
    if (set.has(k)) set.delete(k); else set.add(k);
    onChange(all.filter((c) => set.has(c.key)).map((c) => c.key));
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Escondido no mobile: lá a lista vira cards, sem colunas configuráveis */}
      <PopoverTrigger className="hidden items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface2 hover:text-text md:inline-flex">
        <Columns3 className="h-4 w-4" aria-hidden /> Colunas
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1.5" align="end">
        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Colunas visíveis</div>
        {all.map((c) => {
          const on = visible.includes(c.key);
          return (
            <button key={c.key} onClick={() => toggle(c.key)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text transition-colors hover:bg-surface2">
              <span className={`grid h-4 w-4 place-items-center rounded border ${on ? "border-[#e91e8c] bg-[#e91e8c] text-white" : "border-border"}`}>{on && <Check className="h-3 w-3" aria-hidden />}</span>
              <c.Icon className="h-3.5 w-3.5 text-faint" aria-hidden />
              {c.label}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

export function Pagination({
  page, totalPages, size, sizeOpts, from, to, total, onPage, onSize,
}: {
  page: number; totalPages: number; size: number; sizeOpts: number[];
  from: number; to: number; total: number; onPage: (p: number) => void; onSize: (n: number) => void;
}) {
  return (
    // Mobile: uma linha só (sem "por página" e sem « »); no desktop nada muda.
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-4 py-2.5 text-sm max-md:rounded-b-2xl max-sm:flex-nowrap max-sm:gap-2">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="hidden sm:inline">Por página</span>
        <select value={size} onChange={(e) => onSize(Number(e.target.value))} className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text outline-none focus:border-[#e91e8c] max-sm:hidden">
          {sizeOpts.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="ml-1 tabular-nums text-faint max-sm:ml-0 max-sm:text-[11px]">{from}–{to} de {total}</span>
      </div>
      <div className="flex items-center gap-1">
        <PageBtn onClick={() => onPage(1)} disabled={page <= 1} title="Primeira" desktopOnly><ChevronsLeft className="h-4 w-4" /></PageBtn>
        <PageBtn onClick={() => onPage(page - 1)} disabled={page <= 1} title="Anterior"><ChevronLeft className="h-4 w-4" /></PageBtn>
        <span className="px-2 text-xs tabular-nums text-muted max-sm:px-1 max-sm:text-[11px]">Página {page} de {totalPages}</span>
        <PageBtn onClick={() => onPage(page + 1)} disabled={page >= totalPages} title="Próxima"><ChevronRight className="h-4 w-4" /></PageBtn>
        <PageBtn onClick={() => onPage(totalPages)} disabled={page >= totalPages} title="Última" desktopOnly><ChevronsRight className="h-4 w-4" /></PageBtn>
      </div>
    </div>
  );
}

/** `desktopOnly`: atalhos « » saem no mobile p/ a paginação caber em uma linha. */
function PageBtn({ children, onClick, disabled, title, desktopOnly }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string; desktopOnly?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={`grid h-8 w-8 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface2 hover:text-text disabled:pointer-events-none disabled:opacity-40 max-sm:h-10 max-sm:w-10 ${desktopOnly ? "max-sm:hidden" : ""}`}>
      {children}
    </button>
  );
}

/** Destino do Voltar → rótulo acessível (o texto visível segue "Voltar"). */
function backLabel(href: string): string {
  if (href === "/" || href === "/painel") return "Voltar ao Painel";
  return "Voltar";
}

/** Cabeçalho padrão das listas: Voltar · divisor · ícone gradiente · título · contagem.
 *  `primary` é o CTA principal: no mobile ele fica na linha do título (o track de ações
 *  rola na horizontal e o esconderia); no desktop volta ao fim da linha de ações.
 *  `backHref`: destino do Voltar. */
export function ListHeader({
  title, count, Icon, children, primary, backHref = "/",
}: { title: string; count: number; Icon: LucideIcon; children?: React.ReactNode; primary?: React.ReactNode; backHref?: string }) {
  const back = backLabel(backHref);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3 max-md:w-full max-sm:gap-2">
        {/* No mobile só o ícone aparece — o aria-label carrega o destino */}
        <Link href={backHref} title={back} aria-label={back} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text shadow-[var(--shadow-sm)] transition-colors hover:bg-surface2 max-sm:min-h-10">
          <ArrowLeft className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Voltar</span>
        </Link>
        <span className="h-7 w-px shrink-0 bg-border" aria-hidden />
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-[var(--shadow-sm)]" style={{ background: "linear-gradient(135deg, #e91e8c, #3f5cab)" }}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
          <span className="truncate">{title}</span>
          <span className="shrink-0 rounded-full bg-surface2 px-2 py-0.5 text-xs font-medium tabular-nums text-muted">{count}</span>
        </h1>
        {primary && <div className="ml-auto flex shrink-0 items-center md:hidden">{primary}</div>}
      </div>
      {/* No mobile as ações rolam na horizontal em vez de empilhar; o fade à direita
          sinaliza que há mais (em vez de parecer chip cortado na borda) */}
      <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto pb-1 max-sm:pr-4 max-sm:[-webkit-mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0 [&>*]:shrink-0">
        {children}
        {primary && <div className="hidden shrink-0 items-center md:flex">{primary}</div>}
      </div>
    </div>
  );
}

/** Botão "Filtro avançado" com contagem de condições. */
export function AdvancedFilterButton({ count, onClick, Icon }: { count: number; onClick: () => void; Icon: LucideIcon }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${count ? "border-[#00BCD4]/40 bg-[#00BCD4]/10 text-[#00BCD4] hover:bg-[#00BCD4]/20" : "border-border text-muted hover:bg-surface2 hover:text-text"}`}
    >
      <Icon className="h-4 w-4" aria-hidden /> Filtro avançado
      {count > 0 && <span className="rounded-full bg-[#00BCD4] px-1.5 text-[10px] font-bold text-white">{count}</span>}
    </button>
  );
}
