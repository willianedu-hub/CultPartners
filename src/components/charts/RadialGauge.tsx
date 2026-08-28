"use client";

/**
 * Medidor radial (ex.: win rate, conversão, atingimento de meta). Cor pelo chamador.
 *
 * `value` desenha o arco e é limitado a 0–100 — um anel não representa 300%.
 * `display` é o número ESCRITO no centro e por padrão acompanha o `value`. Existe porque
 * atingimento de meta passa de 100% com frequência, e mostrar o valor limitado no texto
 * seria informação errada: 695% apareceria como "100%".
 */
export function RadialGauge({
  value, display, size = 132, thickness = 12, color = "#18946c", label,
}: {
  value: number;
  display?: number;
  size?: number;
  thickness?: number;
  color?: string;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const texto = Math.round(display ?? v);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2, cy = size / 2;
  // Em tamanho pequeno o `text-2xl` não cabe dentro do anel.
  const fonte = size < 76 ? (texto >= 1000 ? "text-[10px]" : "text-xs") : "text-2xl";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface2)" strokeWidth={thickness} />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)}
          transform={`rotate(-90 ${cx} ${cy})`}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className={`${fonte} font-semibold tabular-nums text-text`}>{texto}%</div>
        {label && <div className="text-[9px] uppercase tracking-wider text-faint">{label}</div>}
      </div>
    </div>
  );
}
