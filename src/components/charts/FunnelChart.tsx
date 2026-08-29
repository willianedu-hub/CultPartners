"use client";

import { seriesColor } from "./palette";
import { formatValue, type ValueFormat } from "./format";

export type Step = { label: string; value: number };

/** Funil vertical com taxa de conversão entre etapas. Largura = magnitude. */
export function FunnelChart({ data, format = "number" }: { data: Step[]; format?: ValueFormat }) {
  const first = Math.max(1, data[0]?.value ?? 1);
  return (
    <div className="space-y-1">
      {data.map((s, i) => {
        // Teto de 100%: no retrato do funil uma etapa pode ter MAIS itens que a
        // primeira (ex.: 13 vs 12) e a barra passava por cima da coluna de %.
        const w = Math.min(100, Math.max(6, (s.value / first) * 100));
        const prev = i > 0 ? data[i - 1].value : null;
        const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        const overall = Math.round((s.value / first) * 100);
        return (
          <div key={s.label}>
            {conv != null && (
              <div className="flex items-center justify-center py-0.5 text-[10px] text-faint">
                <span className="rounded-full bg-surface2 px-1.5 py-px tabular-nums">↓ {conv}%</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-28 shrink-0 truncate text-right text-xs text-muted" title={s.label}>{s.label}</div>
              <div className="relative h-8 flex-1">
                <div className="absolute inset-y-0 left-1/2 flex items-center justify-center rounded-md text-[11px] font-semibold text-white transition-all"
                  style={{ width: `${w}%`, transform: "translateX(-50%)", background: seriesColor(0) }}>
                  <span className="tabular-nums">{formatValue(format, s.value)}</span>
                </div>
              </div>
              <div className="w-10 shrink-0 text-right text-[11px] tabular-nums text-faint">{overall}%</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
