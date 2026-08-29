// Limpeza de texto de terceiro — módulo PURO, sem Prisma e sem Next.
//
// Este arquivo era metade de `src/lib/mcp/envelope.ts`, e foi separado quando a API REST
// entrou. O motivo é o que distingue as duas superfícies:
//
//   MCP  → limpa **e marca** (`texto-livre[campo]:`). A marca é um aviso ao MODELO.
//   REST → limpa e **não** marca. Num programa a marca corromperia o valor: `nome` viria
//          como `"texto-livre[nome]: Acme"` e cairia assim no banco de quem integrou.
//
// **A limpeza vale para as duas.** Bidi e *tag characters* de U+E0000 fazem mal a qualquer
// consumidor — num CSV gerado pela API, um caractere de reordenação viaja adiante e
// reaparece na planilha de outra pessoa. Só a MARCA é específica de LLM.
//
// Nada aqui é blindagem contra injeção de prompt: não existe defesa completa hoje. O que
// limita o dano é as duas superfícies serem somente leitura (`forbidden.test.ts`).

/**
 * Invisíveis que somem. Preserva `\n` e `\t` (são formatação legítima de nota).
 *
 * Escrito SÓ com escapes `\uXXXX` de propósito. A primeira versão deste regex trazia os
 * caracteres literais — e um scan achou **38 invisíveis dentro do próprio arquivo cujo
 * trabalho é removê-los**. Num arquivo de segurança, código-fonte que ninguém consegue ler
 * direito é o problema, não um detalhe de estilo. (Aconteceu de novo ao mover o regex para
 * cá: copiar e colar o arquivo trouxe os literais de volta.)
 *
 * O que cada faixa cobre:
 *  - U+0000-U+0008, U+000B, U+000C, U+000E-U+001F: controles C0 (mantém `\t` e `\n`).
 *  - U+007F-U+009F: DEL e controles C1.
 *  - U+00AD, U+180E, U+200B-U+200D, U+2060-U+2064, U+FEFF: largura zero.
 *  - U+061C, U+200E, U+200F, U+202A-U+202E, U+2066-U+206F: **bidi**. Reordenam o texto na
 *    tela sem mudar os bytes — o truque do "Trojan Source".
 *  - U+E0000-U+E007F: *tag characters*. Carregam ASCII completamente invisível; é o jeito
 *    mais direto de esconder uma instrução dentro de uma nota de lead.
 */
export const INVISIVEIS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]|[\u{E0000}-\u{E007F}]/gu;

/** Teto por campo de texto livre no MCP. Nota de 40 KB não ajuda o modelo e custa token. */
export const MAX_TEXTO = 500;

/**
 * Teto por campo na API REST — mais generoso, e por um motivo concreto: o consumidor aqui é
 * um programa que vai GRAVAR o valor em algum lugar. Cortar uma observação de 3 KB no meio
 * significa dado mutilado no sistema do outro lado, não uma janela de contexto salva.
 * Ainda existe teto porque um campo sem limite é uma resposta sem limite.
 */
export const MAX_TEXTO_API = 20_000;

/**
 * Limpa um texto de terceiro: normaliza fim de linha, remove invisíveis, corta no teto.
 * Devolve também se cortou — porque truncar em silêncio faz o consumidor (modelo ou
 * programa) concluir que aquilo é o valor inteiro.
 */
export function limparTexto(bruto: string, max = MAX_TEXTO): { texto: string; cortado: boolean } {
  const limpo = bruto
    .replace(/\r\n?/g, "\n")
    .replace(INVISIVEIS, "")
    // Normaliza para forma canônica composta: evita duas grafias do mesmo texto passando
    // por comparações diferentes mais adiante.
    .normalize("NFC")
    .trim();
  if (limpo.length <= max) return { texto: limpo, cortado: false };
  return { texto: limpo.slice(0, max), cortado: true };
}

/** Como cada string encontrada deve ser tratada. */
export type Tratamento = {
  /** Teto por campo. */
  max: number;
  /** Trecho a remover de dentro do valor (o nonce da cerca do MCP). */
  remover?: string;
  /**
   * Recebe o campo e o valor já limpo, e devolve o valor final. É o gancho da MARCA: o MCP
   * passa uma função que prefixa `texto-livre[campo]:`, a REST não passa nada.
   */
  marcar?: (campo: string | undefined, limpo: string, cortado: boolean) => string;
};

/**
 * Percorre o dado e aplica `Tratamento` a **toda string**, em qualquer profundidade.
 *
 * A separação entre limpar e marcar é a correção mais importante desta família de funções:
 *
 *  - **Limpar é incondicional.** Antes, só campo listado era limpo — então um campo de
 *    texto livre que ninguém tivesse listado passava com bidi e *tag characters* intactos.
 *    Era o furo de verdade: uma instrução invisível dentro de uma nota chegava ao modelo
 *    porque a chave se chamava `nome` e não `name`. Agora esquecer um campo custa uma marca
 *    a menos, não um invisível a mais — o erro passou a ser cosmético, não de segurança.
 *  - **Marcar é por campo**, e só faz sentido quando quem lê é um modelo.
 *
 * `Date` vira ISO aqui e não no `JSON.stringify` para a saída ser a mesma nas duas
 * superfícies (a REST serializa objeto, o MCP serializa texto).
 */
export function percorrerTexto(valor: unknown, t: Tratamento, campo?: string): unknown {
  if (typeof valor === "string") {
    const { texto, cortado } = limparTexto(valor, t.max);
    const semRemovido = t.remover ? texto.split(t.remover).join("") : texto;
    if (t.marcar) return t.marcar(campo, semRemovido, cortado);
    // Sem marca, o corte é sinalizado no próprio valor — é a única forma de o consumidor
    // saber, já que aqui não há campo de aviso ao lado.
    return cortado ? `${semRemovido}… [cortado em ${t.max} caracteres]` : semRemovido;
  }
  if (Array.isArray(valor)) return valor.map((v) => percorrerTexto(v, t, campo));
  if (valor && typeof valor === "object") {
    if (valor instanceof Date) return valor.toISOString();
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      out[k] = percorrerTexto(v, t, k);
    }
    return out;
  }
  return valor;
}

/**
 * O que a API REST usa: limpa tudo, não marca nada, teto generoso.
 *
 * O nome diz o que garante e o que não garante — o valor está **limpo**, não **confiável**.
 * Continua sendo texto que um cliente escreveu, e quem consumir precisa tratá-lo como tal.
 */
export function limparProfundo(dados: unknown, max = MAX_TEXTO_API): unknown {
  return percorrerTexto(dados, { max });
}
