"use client";

import { SERIES } from "./palette";

/** Mini-tendência para KPIs. Sem eixos — só a forma. */
export function Sparkline({ data, width = 96, height = 28, color = SERIES[0] }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const span = max - min || 1;
  const pad = 2;
  const x = (i: number) => pad + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (width - pad * 2));
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const gid = `spark-${color.replace("#", "")}`;
  return (
    <svg width={width} height={height} className="block overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L ${x(data.length - 1)} ${height} L ${x(0)} ${height} Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="2" fill={color} />
    </svg>
  );
}
