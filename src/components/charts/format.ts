import { formatBRL } from "@/lib/money";

// Formato de valor como PRESET serializável — Server Components não podem passar
// funções como prop para Client Components (fronteira RSC), então o gráfico
// recebe o nome do formato e resolve a função aqui, do lado client.
export type ValueFormat = "number" | "brl";

export function formatValue(format: ValueFormat, n: number): string {
  return format === "brl" ? formatBRL(n) : String(n);
}

/** Número curto em pt-BR: 1,2 mil · 42,3 mi · 1,1 bi (até 1 decimal, sem zero à direita). */
function compact(v: number): string {
  const abs = Math.abs(v);
  const [div, suf] = abs >= 1e9 ? [1e9, " bi"] : abs >= 1e6 ? [1e6, " mi"] : abs >= 1e3 ? [1e3, " mil"] : [1, ""];
  const n = v / div;
  // 1 decimal só quando ajuda (abaixo de 10 e não inteiro)
  const s = Math.abs(n) < 10 && !Number.isInteger(n) ? n.toFixed(1) : n.toFixed(0);
  return s.replace(".", ",") + suf;
}

/**
 * Rótulo compacto para escala de eixo — cabe em 10px sem estourar o gráfico.
 * Valores "brl" chegam em CENTAVOS (padrão do CRM), então dividimos por 100.
 */
export function formatAxis(format: ValueFormat, n: number): string {
  return format === "brl" ? `R$ ${compact(n / 100)}` : compact(n);
}
