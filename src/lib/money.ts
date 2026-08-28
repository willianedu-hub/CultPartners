// Dinheiro em CENTAVOS (inteiro) em todo o sistema — evita erro de ponto flutuante.
// Formatação sempre em BRL/pt-BR.

/** Converte reais (ex.: 1234.56) para centavos inteiros (123456). */
export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

/** Converte centavos inteiros (123456) para reais (1234.56). */
export function centsToReais(cents: number): number {
  return cents / 100;
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata centavos como moeda BRL: 123456 -> "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  return BRL.format(cents / 100);
}
