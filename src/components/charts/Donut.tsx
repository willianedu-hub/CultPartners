"use client";

import { useState } from "react";
import { seriesColor } from "./palette";

export type Slice = { label: string; value: number; color?: string };

function polar(cx: number, cy: number, r: number, a: number) {
  const rad = ((a - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/** Donut de identidade/proporção. Legenda sempre presente para ≥2 fatias. */
export function Donut({
  data, size = 160, thickness = 16, centerValue, centerLabel, unit = "",
}: {
  data: Slice[];
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const gap = data.length > 1 ? 3 : 0; // graus de folga entre fatias
  let acc = 0;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface2)" strokeWidth={thickness} />
          {data.map((d, i) => {
            const frac = d.value / total;
            const a0 = acc * 360 + gap / 2;
            const a1 = (acc + frac) * 360 - gap / 2;
            acc += frac;
            if (a1 <= a0) return null;
            const color = d.color ?? seriesColor(i);
            const active = hover === i;
            const d0 = arcPath(cx, cy, r, a0, a1);
            return (
              <g key={i}>
                <path
                  d={d0}
                  fill="none"
                  stroke={color}
                  strokeWidth={active ? thickness + 3 : thickness}
                  strokeLinecap="round"
                  className="transition-[stroke-width] duration-150"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onPointerDown={() => setHover(i)} // toque destaca a fatia (sem hover no mobile)
                />
                {/* alvo de toque: o arco tem 16px — invisível de ~30px só em ponteiro
                    grosso (no desktop o hover continua exatamente igual) */}
                <path
                  d={d0}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={thickness + 14}
                  strokeLinecap="butt"
                  className="hidden pointer-coarse:block"
                  onPointerDown={() => setHover(i)}
                />
              </g>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {hover != null ? (
            <>
              <div className="text-lg font-semibold tabular-nums text-text">{data[hover].value}{unit}</div>
              <div className="max-w-[70%] truncate text-[10px] uppercase tracking-wider text-faint">{data[hover].label}</div>
            </>
          ) : (
            <>
              <div className="text-xl font-semibold tabular-nums text-text">{centerValue ?? total}</div>
              {centerLabel && <div className="text-[10px] uppercase tracking-wider text-faint">{centerLabel}</div>}
            </>
          )}
        </div>
      </div>
      {data.length > 1 && (
        // no celular a legenda passa para a linha de baixo (largura cheia): ao lado do
        // donut de 160px sobravam ~50px e todo rótulo ficava truncado. ≥640px inalterado.
        <ul className="min-w-0 space-y-1.5 max-sm:basis-full sm:flex-1">
          {data.map((d, i) => {
            const pct = Math.round((d.value / total) * 100);
            return (
              <li
                key={i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onPointerDown={() => setHover(i)}
                // max-sm:py-2 — linha da legenda também é alvo de toque (≥32px no celular)
                className={`flex items-center gap-2 rounded-md px-1.5 py-0.5 text-xs transition-colors max-sm:py-2 ${hover === i ? "bg-surface2" : ""}`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: d.color ?? seriesColor(i) }} />
                <span className="min-w-0 flex-1 truncate text-muted">{d.label}</span>
                <span className="shrink-0 tabular-nums text-text">{d.value}{unit}</span>
                <span className="w-9 shrink-0 text-right tabular-nums text-faint">{pct}%</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
