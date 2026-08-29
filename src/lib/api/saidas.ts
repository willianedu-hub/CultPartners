import { z } from "zod";

// Schemas de SAÍDA da API REST do CultPartners — zod, e a fonte da verdade do OpenAPI.
//
// POR QUE ISTO EXISTE, e por que é o trabalho de verdade da F6 (espelha `saidas.ts` do CRM):
//
// As ferramentas MCP declaram schema de ENTRADA (é o que o modelo lê para saber o que mandar)
// e devolvem `Promise<unknown>`. Para um MODELO isso basta — ele lê o JSON e se entende. Para
// um PROGRAMA não: quem integra precisa saber que `valorEstimado` pode ser `null` e que
// `status` é `{id,nome,cor}|null`, e descobrir isso inspecionando respostas reais significa
// descobrir errado no primeiro caso de borda.
//
// COMO ISTO NÃO ENVELHECE, que é o risco central:
//
//   Em desenvolvimento (ou com `CP_VALIDA_SAIDA=1`), a casca (`rota.ts`) roda `safeParse` na
//   resposta e **estoura** se a forma divergir. Os objetos são `.strict()`, então um campo
//   NOVO num `select` do Prisma quebra o teste em vez de aparecer sem documentação. Em
//   produção nada é validado — o custo fica no desenvolvimento, onde ele tem valor.
//
//   ⚠️ A validação **nunca altera o payload**. A casca serializa o objeto ORIGINAL (já limpo),
//   não o resultado do `parse`: `z.object` remove chave desconhecida em silêncio, e
//   "documentar" apagando dado do cliente seria pior que não documentar.
//
// As formas já são centralizadas em poucas funções de `dados.ts` (`resumoOpp`, `montarPagina`,
// `reportsSummary`), então os schemas são escritos sobre ELAS — não em cada endpoint.

// ───────────────────────────── blocos compartilhados ─────────────────────────────

/** `{ id, nome }` — como parceiro/produto/etapa saem das ferramentas (ids já em Number). */
const zRef = z.object({ id: z.number().int(), nome: z.string() }).strict();

/**
 * Página de listagem, o formato do `montarPagina()` em `src/lib/mcp/dados.ts`.
 *
 * `total` é a contagem completa DENTRO DO ESCOPO — não quantos couberam nesta página. É a
 * diferença que permite ao consumidor saber que faltou coisa, em vez de só "tem mais".
 */
function zPagina<T extends z.ZodType>(item: T) {
  return z.object({
    itens: z.array(item),
    pagina: z.number().int(),
    porPagina: z.number().int(),
    total: z.number().int(),
    totalPaginas: z.number().int(),
    temMais: z.boolean(),
    /** Presente SÓ quando há mais páginas. Ver o comentário de `montarPagina`. */
    aviso: z.string().optional(),
  });
}

/**
 * A noção de escopo que valeu na resposta, **estruturada**.
 *
 * No MCP a assimetria é avisada em prosa (`avisoDeEscopo` do `cp_whoami`). Um cliente
 * programático não lê prosa: ele vai concluir em silêncio que o pipeline está vazio quando na
 * verdade está olhando só os parceiros de um executivo. Este campo impede isso — `ALL` = admin
 * (todo o canal), `TEAM` = executivo (só os seus parceiros), `OWNER` = parceiro (só as suas).
 */
export const zEscopo = z.enum(["OWNER", "TEAM", "ALL"]);

/** O `resumoOpp()` de `dados.ts`: uma oportunidade enxuta, valor em número e em BRL. */
export const zResumoOpp = z
  .object({
    id: z.number().int(),
    empresa: z.string(),
    cnpj: z.string().nullable(),
    siteEmpresa: z.string().nullable(),
    contato: z.string().nullable(),
    cargo: z.string().nullable(),
    obs: z.string().nullable(),
    aprovacao: z.string(),
    status: z.object({ id: z.number().int(), nome: z.string(), cor: z.string() }).strict().nullable(),
    parceiro: zRef.nullable(),
    produtos: z.array(zRef),
    valorEstimado: z.number().nullable(),
    valorEstimadoBRL: z.string().nullable(),
    fechamento: z.string().nullable(),
    criadaEm: z.string().nullable(),
    tarefas: z.object({ total: z.number().int(), pendentes: z.number().int() }).strict(),
  })
  .strict();

// ───────────────────────────── oportunidades ─────────────────────────────

export const SAIDA_OPPS = zPagina(zResumoOpp)
  .extend({
    filtro: z
      .object({
        status: z.string().nullable(),
        aprovacao: z.string().nullable(),
        parceiroId: z.number().int().nullable(),
        periodo: z.string(),
      })
      .strict(),
    escopo: zEscopo,
  })
  .strict();

const zTarefaDetalhe = z
  .object({
    id: z.number().int(),
    descricao: z.string().nullable(),
    prazo: z.string().nullable(),
    responsavel: z.string().nullable(),
    concluida: z.boolean(),
    concluidaEm: z.string().nullable(),
  })
  .strict();

export const SAIDA_OPP = zResumoOpp
  .extend({
    encontrada: z.literal(true),
    motivoRejeicao: z.string().nullable(),
    aprovadaEm: z.string().nullable(),
    rejeitadaEm: z.string().nullable(),
    tarefasDetalhe: z.array(zTarefaDetalhe),
  })
  .strict();

export const SAIDA_PIPELINE = z
  .object({
    etapas: z.array(
      z
        .object({
          etapaId: z.number().int(),
          etapa: z.string(),
          cor: z.string(),
          ordem: z.number().int(),
          quantidade: z.number().int(),
          valorEstimado: z.number(),
          valorEstimadoBRL: z.string(),
        })
        .strict(),
    ),
    totais: z
      .object({
        quantidade: z.number().int(),
        valorEstimado: z.number(),
        valorEstimadoBRL: z.string(),
      })
      .strict(),
    semEtapa: z.number().int().optional(),
    avisoSemEtapa: z.string().optional(),
    escopo: zEscopo,
  })
  .strict();

// ───────────────────────────── parceiros ─────────────────────────────

export const SAIDA_PARCEIROS = z
  .object({
    parceiros: z.array(
      z
        .object({
          id: z.number().int(),
          nome: z.string(),
          cnpj: z.string().nullable(),
          site: z.string().nullable(),
          email: z.string().nullable(),
        })
        .strict(),
    ),
    total: z.number().int(),
    escopo: zEscopo,
  })
  .strict();

// ───────────────────────────── catálogos globais ─────────────────────────────

export const SAIDA_PRODUTOS = z
  .object({
    produtos: z.array(
      z
        .object({
          id: z.number().int(),
          nome: z.string(),
          categoria: z.string().nullable(),
          descricao: z.string().nullable(),
          ordem: z.number().int(),
        })
        .strict(),
    ),
    total: z.number().int(),
  })
  .strict();

export const SAIDA_STATUS = z
  .object({
    status: z.array(
      z
        .object({
          id: z.number().int(),
          nome: z.string(),
          cor: z.string(),
          ordem: z.number().int(),
        })
        .strict(),
    ),
    total: z.number().int(),
  })
  .strict();

// ───────────────────────────── tarefas ─────────────────────────────

/**
 * Sem `escopo` estruturado: a tarefa não tem escopo próprio, ela herda o da oportunidade. A
 * checagem é na oportunidade (fora do alcance → 404, via `ausente` na casca), então quando esta
 * forma chega, a oportunidade já está no alcance. Anotar `escopo` aqui repetiria o que o 404 já
 * garante.
 */
export const SAIDA_TAREFAS = z
  .object({
    encontrada: z.literal(true),
    oportunidadeId: z.number().int(),
    tarefas: z.array(zTarefaDetalhe),
    total: z.number().int(),
    pendentes: z.number().int(),
  })
  .strict();

// ───────────────────────────── identidade ─────────────────────────────

export const SAIDA_ME = z
  .object({
    pessoa: z
      .object({ id: z.string(), nome: z.string().nullable(), email: z.string().nullable() })
      .strict(),
    audiencia: z.enum(["internal", "partner"]),
    papeis: z.array(z.string()),
    alcancaTodoOCanal: z.boolean(),
    /** `"todos"` (admin) ou a lista de parceiros alcançados, com id e nome (nunca senha). */
    escopo: z.union([z.literal("todos"), z.array(zRef)]),
    avisos: z.array(z.string()),
    avisoDeEscopo: z.string().nullable(),
  })
  .strict();

// ───────────────────────────── relatórios ─────────────────────────────

export const SAIDA_RELATORIOS = z
  .object({
    periodo: z
      .object({
        chave: z.string(),
        rotulo: z.string(),
        inicio: z.string().nullable(),
        fimExclusivo: z.string().nullable(),
      })
      .strict(),
    quantidade: z
      .object({
        total: z.number().int(),
        ganhos: z.number().int(),
        perdidos: z.number().int(),
        emAberto: z.number().int(),
        conversaoPct: z.number(),
      })
      .strict(),
    valor: z
      .object({
        oportunidadesComValor: z.number().int(),
        prospectado: z.number(),
        ganho: z.number(),
        perdido: z.number(),
        prospectadoBRL: z.string(),
        ganhoBRL: z.string(),
        perdidoBRL: z.string(),
        conversaoPct: z.number(),
      })
      .strict(),
    observacao: z.string(),
    escopo: zEscopo,
  })
  .strict();

// ───────────────────────────── erro ─────────────────────────────

/**
 * Formato único de erro. `codigo` é o campo que o PROGRAMA lê para decidir — texto em português
 * não serve para isso, e um número HTTP sozinho não distingue "não existe" de "existe e não é
 * seu" (que aqui são o mesmo 404 de propósito).
 */
export const SAIDA_ERRO = z
  .object({
    error: z
      .object({
        codigo: z.enum([
          "nao_autenticado",
          "sem_permissao",
          "escopo_insuficiente",
          "nao_encontrado",
          "parametro_invalido",
          "limite_excedido",
          "indisponivel",
          "erro_interno",
        ]),
        mensagem: z.string(),
        detalhe: z.string().optional(),
      })
      .strict(),
  })
  .strict();

export type CodigoErro = z.infer<typeof SAIDA_ERRO>["error"]["codigo"];
