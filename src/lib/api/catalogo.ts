import "server-only";

// O catálogo de endereços da API REST do CultPartners — a tabela ferramenta ↔ endpoint.
//
// Existe num arquivo só porque **três coisas precisam concordar**: a rota que atende, o OpenAPI
// que documenta e o e2e que verifica. Se cada uma soubesse por conta própria qual ferramenta
// responde `/opportunities`, o OpenAPI documentaria o parâmetro de uma e a rota chamaria outra
// — e a divergência apareceria como campo faltando na resposta de alguém.
//
// Onde o mapeamento NÃO é 1-para-1, e por quê:
//
//   `GET /me`                 ← `cp_whoami` é identidade, não coleção.
//   `GET /opportunities/pipeline` ← foto agregada de agora; precede `/{id}` no roteamento do
//                                Next (segmento estático vence o dinâmico).
//   `GET /tasks`              ← `cp_list_tasks` pede `opportunityId`: a tarefa não tem escopo
//                                próprio, ela é sempre de UMA oportunidade. Por isso o filtro é
//                                obrigatório e não há listagem "de todas as tarefas".

import { inteiro, texto, type DefinicaoRota } from "./rota";
import {
  SAIDA_ME,
  SAIDA_OPP,
  SAIDA_OPPS,
  SAIDA_PARCEIROS,
  SAIDA_PIPELINE,
  SAIDA_PRODUTOS,
  SAIDA_RELATORIOS,
  SAIDA_STATUS,
  SAIDA_TAREFAS,
} from "./saidas";

/**
 * Todos os endereços. A ordem é a de leitura da documentação: o que a pessoa usa primeiro (quem
 * sou) e depois as coleções e os catálogos de apoio.
 */
export const ROTAS: DefinicaoRota[] = [
  {
    metodo: "GET",
    caminho: "/api/v1/me",
    resumo:
      "Em nome de quem a credencial fala, se é admin ou executivo de canal, e QUAIS parceiros ela " +
      "alcança (com ids). Chame primeiro: é o que distingue 'o canal é pequeno' de 'eu só vejo os " +
      "meus parceiros'.",
    ferramenta: "cp_whoami",
    args: () => ({}),
    saida: SAIDA_ME,
  },

  // ── oportunidades ──
  {
    metodo: "GET",
    caminho: "/api/v1/opportunities",
    resumo:
      "Oportunidades do seu alcance, cada uma com empresa, contato, parceiro, etapa do funil, estado " +
      "de aprovação, valor estimado (número e BRL), produtos e contagem de tarefas. Filtre por etapa " +
      "(`status`), aprovação, parceiro, período (data de cadastro) ou texto (`busca`). Página de no " +
      "máximo 50 — use `page` para continuar.",
    ferramenta: "cp_list_opportunities",
    args: ({ url }) => ({
      status: texto(url, "status"),
      aprovacao: texto(url, "aprovacao"),
      parceiroId: inteiro(url, "parceiroId"),
      periodo: texto(url, "periodo"),
      busca: texto(url, "busca"),
      page: inteiro(url, "page"),
    }),
    saida: SAIDA_OPPS,
    escopo: true,
  },
  {
    metodo: "GET",
    caminho: "/api/v1/opportunities/pipeline",
    resumo:
      "Quantidade de oportunidades e soma do valor estimado POR ETAPA do funil, no seu alcance. Foto " +
      "de agora, não recorte de período — devolve os ids de etapa para usar como filtro em " +
      "/opportunities.",
    ferramenta: "cp_pipeline_by_stage",
    args: () => ({}),
    saida: SAIDA_PIPELINE,
    escopo: true,
  },
  {
    metodo: "GET",
    caminho: "/api/v1/opportunities/{id}",
    resumo:
      "Uma oportunidade com produtos, valor, etapa, parceiro, campos de aprovação (motivo de rejeição, " +
      "datas) e a lista completa de tarefas. Fora do seu alcance responde 404 — o mesmo que para um id " +
      "inexistente, de propósito (o id não é um oráculo sobre a base).",
    ferramenta: "cp_get_opportunity",
    args: ({ params }) => ({ id: Number(params.id) }),
    saida: SAIDA_OPP,
    ausente: (d) => d.encontrada === false,
  },

  // ── parceiros ──
  {
    metodo: "GET",
    caminho: "/api/v1/partners",
    resumo:
      "Parceiros ATIVOS do seu alcance, com id, nome, CNPJ, site e e-mail. É o jeito de achar o id de " +
      "um parceiro para filtrar oportunidades. Nunca inclui senha nem hash de senha.",
    ferramenta: "cp_list_partners",
    args: () => ({}),
    saida: SAIDA_PARCEIROS,
    escopo: true,
  },

  // ── catálogos globais ──
  {
    metodo: "GET",
    caminho: "/api/v1/products",
    resumo:
      "Produtos ativos do catálogo, na ordem de exibição, com id, nome, categoria e descrição. Catálogo " +
      "global: não há recorte de escopo aqui.",
    ferramenta: "cp_list_products",
    args: () => ({}),
    saida: SAIDA_PRODUTOS,
  },
  {
    metodo: "GET",
    caminho: "/api/v1/status",
    resumo:
      "Etapas ativas do funil de vendas, na ordem, com id, nome e cor. É o glossário para ler o pipeline " +
      "e o valor do filtro `status` de /opportunities. Catálogo global.",
    ferramenta: "cp_list_status",
    args: () => ({}),
    saida: SAIDA_STATUS,
  },

  // ── tarefas ──
  {
    metodo: "GET",
    caminho: "/api/v1/tasks",
    resumo:
      "Tarefas de UMA oportunidade (via `opportunityId`, obrigatório), com descrição, prazo, responsável " +
      "e se estão concluídas, mais a contagem de pendentes. Se a oportunidade não estiver no seu alcance, " +
      "responde 404 (a tarefa herda o escopo da oportunidade).",
    ferramenta: "cp_list_tasks",
    args: ({ url }) => ({ opportunityId: inteiro(url, "opportunityId") }),
    saida: SAIDA_TAREFAS,
    ausente: (d) => d.encontrada === false,
  },

  // ── relatórios ──
  {
    metodo: "GET",
    caminho: "/api/v1/reports",
    resumo:
      "Resumo comercial do seu alcance: total de oportunidades, ganhos, perdidos e em aberto; valor " +
      "prospectado, ganho e perdido (número e BRL); e a conversão por quantidade e por valor. Aceita " +
      "`periodo` (recorte por data de cadastro; padrão TUDO). PREFIRA a somar /opportunities à mão: as " +
      "regras de ganho/perdido e o recorte de valor já estão aplicados.",
    ferramenta: "cp_reports_summary",
    args: ({ url }) => ({ periodo: texto(url, "periodo") }),
    saida: SAIDA_RELATORIOS,
    escopo: true,
  },
];

/** Acha a definição pelo caminho declarado. Usado pelas rotas do Next. */
export function rotaDe(caminho: string): DefinicaoRota {
  const r = ROTAS.find((x) => x.caminho === caminho);
  // Estourar na carga do módulo, e não na primeira chamada: um caminho errado aqui é erro de
  // programação, e a hora de descobrir é o `next build`.
  if (!r) throw new Error(`[api] nenhuma rota declarada para ${caminho} em src/lib/api/catalogo.ts`);
  return r;
}
