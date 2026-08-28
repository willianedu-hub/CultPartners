"use client";

import { useEffect, useRef, useState } from "react";
import { SERIES } from "./palette";
import { formatValue, formatAxis, type ValueFormat } from "./format";

export type Point = { label: string; value: number };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Série temporal — linha 2px + área com gradiente, crosshair no hover. */
export function TrendArea({
  data, height = 200, color = SERIES[0], format = "number",
}: {
  data: Point[];
  height?: number;
  color?: string;
  format?: ValueFormat; // preset serializável (RSC não passa função para client)
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  // padRight > padX: reserva espaço p/ o marcador do último ponto não ser cortado.
  const padX = 8, padRight = 12, padTop = 16, padBottom = 22;
  const width = Math.max(w, 10);
  const peak = Math.max(...data.map((d) => d.value), 0);
  const max = Math.max(1, peak);
  const allZero = peak === 0;
  const innerW = width - padX - padRight;
  const innerH = height - padTop - padBottom;
  const n = data.length;
  const x = (i: number) => padX + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padTop + innerH - (v / max) * innerH;
  const gid = `grad-${color.replace("#", "")}`;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.value)}`).join(" ");
  const area = n > 0 ? `${line} L ${x(n - 1)} ${padTop + innerH} L ${x(0)} ${padTop + innerH} Z` : "";

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) { const d = Math.abs(x(i) - px); if (d < bd) { bd = d; best = i; } }
    setHi(best);
  }

  return (
    // onPointerDown cobre o toque (mobile não tem hover) — mesma lógica do onMouseMove
    <div ref={ref} className="relative w-full" style={{ height }} onMouseMove={onMove} onPointerDown={onMove} onMouseLeave={() => setHi(null)}>
      {w > 0 && (
        <svg width={width} height={height} className="block">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Grade + escala do eixo Y: sem os rótulos não se sabe a magnitude da série. */}
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1={padX} x2={width - padRight} y1={padTop + innerH * (1 - f)} y2={padTop + innerH * (1 - f)} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
          ))}
          {area && <path d={area} fill={`url(#${gid})`} />}
          {line && <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {/* Rótulos da escala acima de cada linha de grade (0 fica sobre a base). */}
          {(allZero ? [0] : [0, 0.5, 1]).map((f) => (
            <text
              key={`t${f}`}
              x={padX + 1}
              y={padTop + innerH * (1 - f) - 3}
              fontSize="10"
              fill="var(--faint)"
              className="tabular-nums"
            >
              {formatAxis(format, max * f)}
            </text>
          ))}
          {/* Marcador do último ponto — dá âncora de leitura ao fim da série. */}
          {n > 1 && !allZero && (
            <circle cx={x(n - 1)} cy={y(data[n - 1].value)} r="3" fill={color} stroke="var(--surface)" strokeWidth="1.5" />
          )}
          {hi != null && (
            <>
              <line x1={x(hi)} x2={x(hi)} y1={padTop} y2={padTop + innerH} stroke="var(--faint)" strokeWidth="1" />
              <circle cx={x(hi)} cy={y(data[hi].value)} r="4" fill={color} stroke="var(--surface)" strokeWidth="2" />
            </>
          )}
        </svg>
      )}
      {hi != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[11px] shadow-[var(--shadow-lg)]"
          style={{ left: Math.min(Math.max(x(hi), 40), width - 40), top: 0 }}
        >
          <div className="font-semibold tabular-nums text-text">{formatValue(format, data[hi].value)}</div>
          <div className="text-faint">{data[hi].label}</div>
        </div>
      )}
      {/* rótulos do eixo x (extremos + meio) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-2 text-[10px] text-faint">
        <span>{data[0]?.label}</span>
        {n > 2 && <span>{data[Math.floor((n - 1) / 2)]?.label}</span>}
        <span>{data[n - 1]?.label}</span>
      </div>
    </div>
  );
}
