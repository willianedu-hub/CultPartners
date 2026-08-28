"use client";

import { useState } from "react";
import { seriesColor } from "./palette";
import { formatValue, type ValueFormat } from "./format";

export type Bar = { label: string; value: number; color?: string; sub?: string };

/** Barras verticais (magnitude por categoria). Marcas finas, topo arredondado. */
export function BarChart({
  data, height = 180, format = "number", single = true,
}: {
  data: Bar[];
  height?: number;
  format?: ValueFormat; // preset serializável (RSC não passa função para client)
  single?: boolean; // true = uma cor (azul) para todas; false = cor por categoria
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          const color = d.color ?? (single ? seriesColor(0) : seriesColor(i));
          const active = hover === i;
          return (
            <div
              key={i}
              className="group relative flex min-w-0 flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onPointerDown={() => setHover(i)} // toque destaca a barra (sem hover no mobile)
            >
              <div className={`mb-1 text-[11px] font-semibold tabular-nums transition-colors ${active ? "text-text" : "text-faint"}`}>
                {formatValue(format, d.value)}
              </div>
              <div className="flex w-full justify-center">
                <div
                  className="w-full max-w-[46px] rounded-t-[4px] transition-all duration-150"
                  style={{ height: `${Math.max(2, (pct / 100) * (height - 28))}px`, background: color, opacity: hover == null || active ? 1 : 0.55 }}
                />
              </div>
              {active && d.sub && (
                <div className="pointer-events-none absolute -top-6 z-10 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-text shadow-[var(--shadow-lg)]">
                  {d.sub}
                </div>
              )}
              {/* alvo de toque: numa barra baixa/zerada a coluna tem ~20px de altura —
                  esta camada invisível estende o alvo por toda a altura do gráfico.
                  Só em ponteiro grosso, então o hover do desktop não muda. */}
              <span aria-hidden style={{ height }} className="absolute inset-x-0 bottom-0 hidden pointer-coarse:block" />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 h-px w-full bg-border" />
      <div className="mt-1.5 flex gap-2">
        {data.map((d, i) => (
          <div key={i} className="min-w-0 flex-1 truncate text-center text-[10px] uppercase tracking-wide text-faint" title={d.label}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
