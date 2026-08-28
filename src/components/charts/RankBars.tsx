"use client";

import { useState } from "react";
import { SERIES } from "./palette";
import { formatValue, type ValueFormat } from "./format";

export type RankBar = { label: string; value: number; sub?: string };

/**
 * Barras HORIZONTAIS para ranking por categoria — pessoas, equipes, motivos de perda.
 *
 * Por que não o `BarChart` vertical: ali o rótulo vive numa coluna de ~40px e "Perdeu
 * para concorrente" vira "Perde…". Com nome de gente e motivo de perda, ler o rótulo é
 * metade do gráfico.
 *
 * **Uma cor só, de propósito.** Isto é magnitude, não identidade: pintar cada barra de
 * uma cor faria a cor seguir o *ranking*, e a mesma pessoa mudaria de cor ao trocar de
 * posição entre um período e outro.
 */
export function RankBars({ data, format = "number", max = 10 }: { data: RankBar[]; format?: ValueFormat; max?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const itens = data.slice(0, max);
  const topo = Math.max(1, ...itens.map((d) => d.value));

  return (
    <ul className="space-y-2.5">
      {itens.map((d, i) => {
        const pct = (d.value / topo) * 100;
        const ativo = hover === i;
        return (
          <li
            key={`${d.label}-${i}`}
            className="min-w-0"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onPointerDown={() => setHover(i)}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-xs text-muted" title={d.label}>
                {d.label}
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-text">{formatValue(format, d.value)}</span>
            </div>
            {/* Trilho: dá referência de escala mesmo para a barra menor da lista. */}
            <div className="mt-1 h-2 w-full rounded-full bg-field">
              <div
                className="h-2 rounded-full transition-all duration-150"
                style={{
                  width: `${Math.max(2, pct)}%`,
                  background: SERIES[0],
                  opacity: hover === null || ativo ? 1 : 0.55,
                }}
              />
            </div>
            {d.sub && <div className="mt-0.5 text-[11px] text-faint">{d.sub}</div>}
          </li>
        );
      })}
    </ul>
  );
}
