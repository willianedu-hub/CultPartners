"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type ComboOption = { value: string; label: string };

function normalize(options: (string | ComboOption)[]): ComboOption[] {
  return options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

/**
 * Combobox único (Popover + Command/cmdk): busca, teclado e visual do DS.
 * - Aceita `string[]` ou `{value,label}[]` (enums/relacionais).
 * - `allowCustom`: permite digitar um valor novo (ex.: verticais).
 * - `clearable`: mostra "limpar" para campos opcionais.
 * - Ordena o conteúdo alfabeticamente pelo rótulo (pt-BR).
 * - Controlado (value/onChange) ou não-controlado (defaultValue); submete via `name`.
 */
export function Combobox({
  name,
  options,
  value,
  defaultValue,
  onChange,
  placeholder,
  className,
  id,
  allowCustom = false,
  clearable = false,
  sort = true,
  emptyLabel = "— limpar seleção",
}: {
  name?: string;
  options: (string | ComboOption)[];
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  allowCustom?: boolean;
  clearable?: boolean;
  sort?: boolean;
  emptyLabel?: string;
}) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = controlled ? (value ?? "") : internal;

  const opts = useMemo(() => {
    const list = normalize(options);
    return sort ? [...list].sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" })) : list;
  }, [options, sort]);
  const currentLabel = opts.find((o) => o.value === current)?.label ?? current;

  function choose(v: string) {
    if (!controlled) setInternal(v);
    onChange?.(v);
    setOpen(false);
    setQuery("");
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? opts.filter((o) => o.label.toLowerCase().includes(q)) : opts;
  const exact = opts.some((o) => o.label.toLowerCase() === q);

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(className, "flex items-center justify-between gap-2 text-left")}
        >
          <span className={cn("truncate", !current && "text-faint")}>{current ? currentLabel : placeholder || "Selecione ou digite…"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-faint" />
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-56 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={query} onValueChange={setQuery} placeholder={placeholder ?? "Buscar…"} />
            <CommandList>
              {filtered.length === 0 && !query && <CommandEmpty>Nenhuma opção.</CommandEmpty>}
              <CommandGroup>
                {clearable && current && !q && (
                  <CommandItem value="__clear__" onSelect={() => choose("")}>
                    <X className="h-3.5 w-3.5 text-faint" />
                    <span className="text-faint">{emptyLabel}</span>
                  </CommandItem>
                )}
                {filtered.map((o) => (
                  <CommandItem key={o.value} value={o.value} onSelect={() => choose(o.value)}>
                    <Check className={cn("h-3.5 w-3.5", current === o.value ? "text-ink-magenta opacity-100" : "opacity-0")} />
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                ))}
                {allowCustom && query.trim() && !exact && (
                  <CommandItem value={`__use__${query}`} onSelect={() => choose(query.trim())}>
                    <span className="text-faint">Usar</span>
                    <span className="truncate font-medium">“{query.trim()}”</span>
                  </CommandItem>
                )}
                {!allowCustom && filtered.length === 0 && query && <CommandEmpty>Nada encontrado.</CommandEmpty>}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
