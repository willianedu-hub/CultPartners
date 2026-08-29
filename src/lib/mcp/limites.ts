// Teto de resposta — módulo PURO.
//
// Por que existe: MCP devolve TEXTO para um modelo. Uma listagem de 5.000 leads não é
// "muito dado", é uma resposta que não cabe na janela de contexto, custa caro e chega
// truncada por quem está do outro lado — sem ninguém saber que truncou.
//
// A regra que organiza o arquivo: **nunca cortar em silêncio.** Uma lista cortada sem aviso
// faz o modelo concluir "são só esses" e responder com confiança um número errado. Isso é
// pior do que não responder, porque o erro não parece erro.

/** Máximo de registros por página de listagem. */
export const MAX_LISTA = 50;
/** Máximo de registros aninhados dentro de um detalhe (itens, contatos, tarefas). */
export const MAX_ANINHADO = 25;

export type Pagina<T> = {
  itens: T[];
  /** Quantos existem no total, dentro do escopo — não quantos couberam. */
  total: number;
  /** Quantos ficaram de fora desta resposta. Zero quando trouxe tudo. */
  faltaram: number;
  /** Cursor opaco para a página seguinte. `null` quando acabou. */
  proximoCursor: string | null;
  /** Frase pronta para o modelo. Presente SÓ quando cortou — para ele ter que ler. */
  aviso?: string;
};

/** Entrada de paginação vinda da ferramenta. */
export type Cursor = { offset: number };

/**
 * Lê o cursor opaco. Opaco de propósito: se fosse `{"offset":50}` legível, o modelo
 * inventaria valores em vez de usar o que devolvemos — e um offset inventado devolve
 * dado certo na posição errada, que é um erro silencioso.
 */
export function lerCursor(bruto: string | null | undefined): Cursor {
  if (!bruto) return { offset: 0 };
  try {
    const json = JSON.parse(Buffer.from(bruto, "base64url").toString("utf8"));
    const offset = Number(json?.o);
    // Cursor inválido volta ao começo em vez de estourar: a ferramenta responde algo útil.
    if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000) return { offset: 0 };
    return { offset };
  } catch {
    return { offset: 0 };
  }
}

export function escreverCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), "utf8").toString("base64url");
}

/** Quantos registros pedir ao banco, respeitando o teto. `+1` fica a cargo do chamador. */
export function tamanhoPagina(pedido: number | null | undefined, teto = MAX_LISTA): number {
  if (!pedido || !Number.isFinite(pedido) || pedido < 1) return teto;
  return Math.min(Math.floor(pedido), teto);
}

/**
 * Monta a página a partir do que veio do banco.
 *
 * `total` é a contagem completa dentro do escopo (um `count` separado), e é o que permite
 * dizer quantos faltaram. Sem ele daria para saber apenas "tem mais", que é menos útil:
 * "217 no total, 50 aqui" muda a resposta do modelo; "tem mais" não.
 */
export function paginar<T>(itens: T[], total: number, offset: number, take: number): Pagina<T> {
  const cortados = itens.slice(0, take);
  const fim = offset + cortados.length;
  const faltaram = Math.max(0, total - fim);
  const p: Pagina<T> = {
    itens: cortados,
    total,
    faltaram,
    proximoCursor: faltaram > 0 ? escreverCursor(fim) : null,
  };
  if (faltaram > 0) {
    p.aviso =
      `RESPOSTA PARCIAL: ${cortados.length} de ${total} registros. Faltaram ${faltaram}. ` +
      `Não conclua nada sobre o total a partir desta amostra — para continuar, chame a mesma ` +
      `ferramenta com cursor="${p.proximoCursor}", ou reduza o escopo com filtros.`;
  }
  return p;
}

/**
 * Corta uma lista aninhada (itens de uma oportunidade, contatos de uma conta) e devolve o
 * aviso junto. Mesma regra do `paginar`, sem cursor: quem quer o resto usa a ferramenta
 * específica daquela entidade.
 */
export function cortarAninhado<T>(itens: T[], teto = MAX_ANINHADO): { itens: T[]; faltaram: number; aviso?: string } {
  if (itens.length <= teto) return { itens, faltaram: 0 };
  const faltaram = itens.length - teto;
  return {
    itens: itens.slice(0, teto),
    faltaram,
    aviso: `LISTA PARCIAL: ${teto} de ${itens.length}; ${faltaram} não vieram nesta resposta.`,
  };
}
