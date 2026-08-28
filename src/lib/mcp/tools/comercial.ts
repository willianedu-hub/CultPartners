import "server-only";

// Oportunidades e pipeline — o coração do CultPartners.
//
// **Consulta própria, não o DTO da tela.** As telas do portal carregam a oportunidade inteira
// (produtos, tarefas, campos de aprovação) para o kanban e o modal. Num chat isso é contexto
// jogado fora. As ferramentas aqui pedem o mínimo que responde a pergunta e enriquecem no
// `dados.ts`, com o MESMO escopo (`oportunidadeScopeWhere`) que as telas usam.
//
// Alcance de cada ferramenta (a coluna que não pode divergir):
//   cp_list_opportunities / cp_get_opportunity / cp_pipeline_by_stage → oportunidadeScopeWhere
//
// Escopo é SEMPRE do servidor: admin vê tudo, executivo de canal vê só os seus parceiros,
// parceiro (não existe na v1) veria só as suas. Nunca por parâmetro do cliente.

import { z } from "zod";
import { getOpp, loadOpps, pipelineByStage } from "../dados";
import { ehInterno, zAprovacao, zBusca, zPagina, zPeriodo, type Contexto, type Ferramenta } from "../catalog";

const entradaListar = z.object({
  status: z
    .string()
    .optional()
    .describe("Nome da etapa do funil (de cp_list_status), ex.: 'Ganho', 'Perdido', 'Em negociação'."),
  aprovacao: zAprovacao,
  parceiroId: z
    .number()
    .int()
    .optional()
    .describe("Id do parceiro (de cp_list_partners) para recortar dentro do seu alcance. Fora dele, não amplia."),
  periodo: zPeriodo,
  busca: zBusca,
  page: zPagina,
});

const entradaDetalhe = z.object({
  id: z.number().int().describe("Id da oportunidade (de cp_list_opportunities ou cp_get_opportunity)."),
});

const entradaPipeline = z.object({});

export const FERRAMENTAS_COMERCIAL: Ferramenta[] = [
  {
    nome: "cp_list_opportunities",
    titulo: "Listar oportunidades",
    descricao:
      "Lista oportunidades do seu alcance, cada uma com empresa, contato, parceiro, etapa do funil " +
      "(nome e cor), estado de aprovação, valor estimado (número e em BRL), produtos e contagem de " +
      "tarefas (total e pendentes). Filtre por etapa (`status`), aprovação, parceiro, período (data de " +
      "cadastro) ou texto (`busca` em empresa/contato/CNPJ). Traz no máximo 50 por página — se vier " +
      "aviso de resposta parcial, use `page` para continuar. Resultado vazio pode significar 'existe " +
      "mas está fora do seu alcance': não conclua que não existe.",
    entrada: entradaListar,
    exige: ehInterno,
    escreve: false,
    run: async (args: z.infer<typeof entradaListar>, { user }: Contexto) => {
      return loadOpps(user, {
        status: args.status,
        aprovacao: args.aprovacao,
        parceiroId: args.parceiroId,
        periodo: args.periodo,
        busca: args.busca,
        page: args.page,
      });
    },
  },
  {
    nome: "cp_get_opportunity",
    titulo: "Detalhe de uma oportunidade",
    descricao:
      "Traz uma oportunidade com produtos, valor, etapa, parceiro, campos de aprovação (motivo de " +
      "rejeição, datas) e a lista completa de tarefas. Use depois de cp_list_opportunities, que dá o id. " +
      "Se a oportunidade não estiver no seu alcance, responde `encontrada: false` — o mesmo que para um " +
      "id inexistente, de propósito (o id não é um oráculo sobre a base).",
    entrada: entradaDetalhe,
    exige: ehInterno,
    escreve: false,
    run: async (args: z.infer<typeof entradaDetalhe>, { user }: Contexto) => {
      return getOpp(user, args.id);
    },
  },
  {
    nome: "cp_pipeline_by_stage",
    titulo: "Pipeline por etapa",
    descricao:
      "Quantidade de oportunidades e soma do valor estimado POR ETAPA do funil, no seu alcance. " +
      "Responde 'como está o pipeline' numa chamada, sem listar oportunidade por oportunidade, e " +
      "devolve os ids de etapa para usar como filtro em cp_list_opportunities. Conta todas as " +
      "oportunidades não excluídas do escopo (foto de agora, não recorte de período).",
    entrada: entradaPipeline,
    exige: ehInterno,
    escreve: false,
    run: async (_args: z.infer<typeof entradaPipeline>, { user }: Contexto) => {
      return pipelineByStage(user);
    },
  },
];
