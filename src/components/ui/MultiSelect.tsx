"use client";

// Irmão multi do `Combobox`: mesma anatomia (Popover + Command/cmdk), mesmo visual,
// mesma forma de submeter. Existe para relações N:N de verdade — por exemplo os
// papéis/permissões de um usuário — em que um `<select multiple>` nativo é hostil
// no toque (exige arrastar/segurar para marcar mais de um).
//
// Submete um `<input type="hidden">` por valor selecionado, todos com o mesmo `name`,
// então a server action lê com `fd.getAll(name)` e o formulário continua sendo um
// `<form action={serverAction}>` comum — sem estado no cliente para sincronizar.

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type MultiOption = { value: string; label: string; hint?: string };

export function MultiSelect({
  name,
  options,
  value,
  defaultValue,
  onChange,
  placeholder = "Selecione…",
  emptyLabel = "Nenhuma opção.",
  className,
  id,
  disabled = false,
  sort = true,
  /** Quantos rótulos cabem no botão antes de virar "+N". */
  maxLabels = 2,
}: {
  name?: string;
  options: MultiOption[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (v: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  sort?: boolean;
  maxLabels?: number;
}) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState<string[]>(defaultValue ?? []);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = controlled ? (value ?? []) : internal;

  const opts = useMemo(
    () => (sort ? [...options].sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" })) : options),
    [options, sort],
  );

  function toggle(v: string) {
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    if (!controlled) setInternal(next);
    onChange?.(next);
    // O popover NÃO fecha ao marcar: marcar vários é o caso de uso.
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? opts.filter((o) => o.label.toLowerCase().includes(q)) : opts;

  const chosen = opts.filter((o) => current.includes(o.value));
  const resumo =
    chosen.length === 0
      ? placeholder
      : chosen.length <= maxLabels
        ? chosen.map((o) => o.label).join(", ")
        : `${chosen.slice(0, maxLabels).map((o) => o.label).join(", ")} +${chosen.length - maxLabels}`;

  return (
    <>
      {name && current.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          className={cn(className, "flex items-center justify-between gap-2 text-left disabled:opacity-60")}
        >
          <span className={cn("truncate", chosen.length === 0 && "text-faint")}>{resumo}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-faint" />
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-56 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={query} onValueChange={setQuery} placeholder="Buscar…" />
            <CommandList>
              {filtered.length === 0 && <CommandEmpty>{q ? "Nada encontrado." : emptyLabel}</CommandEmpty>}
              <CommandGroup>
                {filtered.map((o) => (
                  <CommandItem key={o.value} value={o.value} onSelect={() => toggle(o.value)}>
                    <Check className={cn("h-3.5 w-3.5", current.includes(o.value) ? "text-ink-magenta opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="shrink-0 text-[10px] text-faint">{o.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
