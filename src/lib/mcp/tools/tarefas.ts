import "server-only";

// `cp_list_tasks` — tarefas de uma oportunidade.
//
// A tarefa não tem escopo próprio: ela herda o da oportunidade. Por isso a checagem é feita
// na oportunidade (fora do alcance → `encontrada: false`, sem revelar se o id existe), no
// mesmo estilo de cp_get_opportunity.

import { z } from "zod";
import { listTasks } from "../dados";
import { ehInterno, type Contexto, type Ferramenta } from "../catalog";

const entrada = z.object({
  opportunityId: z
    .number()
    .int()
    .describe("Id da oportunidade (de cp_list_opportunities). As tarefas retornadas são as dela."),
});

export const FERRAMENTAS_TAREFAS: Ferramenta[] = [
  {
    nome: "cp_list_tasks",
    titulo: "Tarefas de uma oportunidade",
    descricao:
      "Lista as tarefas de uma oportunidade, com descrição, prazo, responsável e se estão concluídas, " +
      "mais a contagem de pendentes. Responde 'o que falta fazer neste negócio'. Só funciona se a " +
      "oportunidade estiver no seu alcance — senão responde `encontrada: false`.",
    entrada,
    exige: ehInterno,
    escreve: false,
    run: async (args: z.infer<typeof entrada>, { user }: Contexto) => {
      return listTasks(user, args.opportunityId);
    },
  },
];
