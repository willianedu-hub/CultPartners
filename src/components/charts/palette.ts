// Paleta de gráficos do CRM — validada (scripts/validate_palette.js) para os
// dois modos (claro sobre #fff, escuro sobre #14161d): banda de luminância,
// piso de croma, separação para daltonismo (CVD) e contraste ≥ 3:1.
//
// Categórica: use SEMPRE nesta ordem fixa, nunca cíclica. A 7ª série vira
// "Outros" ou small multiples. Cor segue a ENTIDADE, não o ranking.

export const SERIES = [
  "#5f7bde", // 1 azul
  "#d93a89", // 2 magenta
  "#1391ad", // 3 ciano
  "#18946c", // 4 esmeralda
  "#ba842c", // 5 âmbar
  "#8867dd", // 6 violeta
] as const;

/** Cores de estado — reservadas (bom/atenção/sério/crítico). Nunca como série. */
export const STATUS = {
  good: "#18946c",
  warning: "#ba842c",
  serious: "#e0602a",
  critical: "#d64550",
} as const;

/** Rampa sequencial (magnitude) — um hue, claro→escuro. */
export const SEQ_BLUE = ["#c9d4f7", "#9fb0ee", "#7d97ef", "#5f7bde", "#4257bd", "#2f3f96"];

export function seriesColor(i: number): string {
  return SERIES[i % SERIES.length];
}
