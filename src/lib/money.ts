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

/**
 * Interpreta uma string pt-BR de valor ("1.234,56", "R$ 1.234,56", "1234.56") em REAIS.
 * Espelha `parseBRL` do SPA legado: remove tudo que não é dígito/vírgula/ponto, trata a
 * vírgula como separador decimal (formato pt-BR). Devolve `null` quando não há número.
 */
export function parseBRL(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;
  // Só dígitos, ponto e vírgula.
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;
  // pt-BR: ponto é milhar, vírgula é decimal. Se há vírgula, ela manda.
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Formato compacto para dashboards (recebe REAIS): "R$ 1,2M", "R$ 850K", ou o BRL cheio
 * abaixo de mil. Espelha `fmtBRLShort` do SPA legado. Nulo/NaN → "—".
 */
export function formatBRLShort(reais: number | null | undefined): string {
  if (reais == null || !Number.isFinite(Number(reais))) return "—";
  const n = Number(reais);
  if (n >= 1_000_000) return "R$ " + (n / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "M";
  if (n >= 1_000) return "R$ " + (n / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + "K";
  return formatBRL(reaisToCents(n));
}

/**
 * Máscara progressiva para o campo de valor (uso em `onChange`): mantém só dígitos e
 * formata como moeda pt-BR com 2 casas (centavos), sem o "R$". "" quando vazio.
 * Ex.: "123456" -> "1.234,56".
 */
export function maskBRLInput(input: string): string {
  const digits = String(input).replace(/\D/g, "");
  if (!digits) return "";
  const cents = Number(digits);
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
