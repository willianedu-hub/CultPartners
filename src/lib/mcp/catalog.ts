import "server-only";

// Catálogo de ferramentas do servidor MCP do CultPartners — declarativo, espelhando
// `src/lib/mcp/catalog.ts` do CRM.
//
// A regra que organiza o arquivo, a mesma do CRM: **nenhuma ferramenta remonta escopo.**
// Cada `run` passa o `SessionUser` adiante para `oportunidadeScopeWhere` /
// `parceiroScopeWhere` (em `@/lib/rbac` e `@/lib/mcp/dados`), que são o MESMO recorte que as
// telas usam. Reimplementar o filtro aqui criaria um segundo lugar para a regra divergir — e
// o sintoma não seria exceção, seria um número de outra pessoa.
//
// IDENTIDADE: na v1 todo token MCP pertence a um usuário INTERNO (admin ou executivo de
// canal — tabela `usuarios_internos`, modelo `User`). Não há token de parceiro. Por isso as
// ferramentas de domínio exigem apenas sessão interna; o recorte fino (admin vê tudo,
// executivo vê só os seus parceiros) mora dentro de cada `run`, no servidor.

import { z } from "zod";
import type { SessionUser } from "@/lib/rbac";

export type Contexto = { user: SessionUser };

export type Ferramenta = {
  /** Nome que o modelo chama. Prefixo `cp_` para não colidir com ferramenta de outro servidor. */
  nome: string;
  titulo: string;
  /** É o que o modelo LÊ para decidir usar. Vale mais que o nome — escreva para ele. */
  descricao: string;
  entrada: z.ZodType;
  /** Filtra `tools/list`: quem não pode usar não vê. */
  exige: (u: SessionUser) => boolean;
  /**
   * v1: sempre `false`. O campo existe para a escrita, quando vier, ser uma DECISÃO
   * explícita por ferramenta e não efeito colateral de alguém copiar um `run`. Este servidor
   * é somente leitura: nenhuma ferramenta escreve no banco.
   */
  escreve: false;
  run: (args: never, ctx: Contexto) => Promise<unknown>;
};

/**
 * `z.toJSONSchema` do zod 4 com `io: "input"`.
 *
 * O `io` não é detalhe: no modo `output` (o padrão) um campo com `.default()` entra em
 * `required`, porque na SAÍDA ele sempre existe. Aqui o schema descreve a ENTRADA, onde é
 * opcional — sem isso o modelo é obrigado a preencher todo campo com default, e passa a
 * inventar período e página em vez de deixar o nosso. O `$schema` sai porque alguns clientes
 * recusam chave desconhecida em `inputSchema`.
 */
export function jsonSchemaDe(entrada: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(entrada, { io: "input" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

/** O que `tools/list` devolve para ESTE usuário. */
export function ferramentasDe(u: SessionUser, todas: Ferramenta[]): Ferramenta[] {
  return todas.filter((f) => f.exige(u));
}

/**
 * O escopo OAuth que esta ferramenta exige. Deriva de `escreve` de propósito, em vez de ser
 * um campo novo a preencher: derivando, não existe a combinação "escreve mas autorizado por
 * consentimento de leitura".
 */
export function escopoDe(f: Ferramenta): string {
  return f.escreve ? "write" : "read";
}

export function acharFerramenta(nome: unknown, todas: Ferramenta[]): Ferramenta | null {
  if (typeof nome !== "string") return null;
  return todas.find((f) => f.nome === nome) ?? null;
}

// ───────────────────────────── gates de acesso ─────────────────────────────

/**
 * Portão das ferramentas de domínio: exige sessão INTERNA. Na v1 todo token MCP já é
 * interno (ver `tokenAuth.ts`), então na prática todas as ferramentas ficam visíveis — mas o
 * gate fica escrito, para o dia em que existir token de parceiro não bastar esquecer um
 * `exige` para o portal inteiro vazar pelo MCP.
 */
export function ehInterno(u: SessionUser): boolean {
  return u.audience === "internal";
}

// ───────────────────────────── entradas comuns ─────────────────────────────

export const zPagina = z
  .number()
  .int()
  .min(1)
  .optional()
  .describe("Página da listagem (1 = primeira). Omita para a primeira. Cada página traz no máximo 50 registros.");

export const zBusca = z
  .string()
  .optional()
  .describe("Texto a procurar no nome da empresa, no contato ou no CNPJ da oportunidade.");

/**
 * Janela de tempo dos relatórios e listagens. As chaves são um vocabulário único (não
 * traduzido em cada ferramenta) para as saídas serem comparáveis. Filtra por `createdAt`
 * (data de cadastro da oportunidade). Padrão: TUDO — o portal legado lista tudo, sem recorte.
 */
export const zPeriodo = z
  .enum(["MES", "MES_PASSADO", "TRIMESTRE", "ANO", "12M", "TUDO"])
  .optional()
  .describe(
    'Janela por data de cadastro: "MES" (mês corrente), "MES_PASSADO", "TRIMESTRE" (90 dias), ' +
      '"ANO" (ano corrente), "12M" (últimos 12 meses) ou "TUDO". Padrão: TUDO.',
  );

export const zAprovacao = z
  .enum(["Pendente", "Aprovado", "Rejeitado"])
  .optional()
  .describe("Filtra pelo estado de aprovação da oportunidade. Omita para todos.");
