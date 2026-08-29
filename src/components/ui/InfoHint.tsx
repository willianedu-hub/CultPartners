"use client";

import { useState } from "react";
import { Info } from "lucide-react";

/**
 * Ícone de informação (ⓘ) com dica ao passar o mouse / focar: explicação do
 * campo e exemplos de preenchimento. Usa <span> internamente para poder viver
 * dentro de um <label> sem HTML inválido.
 */
export function InfoHint({
  title,
  description,
  examples,
  className = "",
}: {
  title?: string;
  description: string;
  examples?: readonly string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={`relative inline-flex align-middle ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Ajuda sobre o campo"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className="text-faint transition-colors hover:text-[#00BCD4] focus:text-[#00BCD4] focus:outline-none"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        /* Mobile: cartão fixo acima do bottom-nav (não vaza da tela); desktop: balão inalterado. */
        <span
          role="tooltip"
          className="absolute left-0 top-6 z-50 w-80 max-w-[min(20rem,80vw)] rounded-xl border border-border bg-surface p-3 text-left text-xs font-normal normal-case shadow-[var(--shadow-lg)] max-sm:fixed max-sm:left-3 max-sm:right-3 max-sm:bottom-[calc(var(--bnav)+0.75rem)] max-sm:top-auto max-sm:z-[95] max-sm:w-auto max-sm:max-w-none"
        >
          {title && <span className="mb-1 block font-semibold leading-snug text-text">{title}</span>}
          <span className="block leading-relaxed text-muted">{description}</span>
          {examples && examples.length > 0 && (
            <span className="mt-2 block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-faint">Exemplos</span>
              <span className="block space-y-1">
                {examples.map((ex, i) => (
                  <span key={i} className="flex gap-1.5 leading-snug text-muted">
                    <span className="shrink-0 text-[#00BCD4]">•</span>
                    <span>{ex}</span>
                  </span>
                ))}
              </span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
