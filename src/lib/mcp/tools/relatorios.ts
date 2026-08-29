import "server-only";

// `cp_reports_summary` — os números que a página de Relatórios do SPA mostra, prontos.
//
// Espelha `renderReports` (legacy/js/reports.js): totais de prospectado/ganho/perdido e as
// duas conversões — por quantidade (ganhos / total) e por valor (valor ganho / valor total
// prospectado, só oportunidades com valor informado). O cálculo mora em `dados.ts`, sobre o
// escopo do usuário. PREFIRA esta ferramenta a somar cp_list_opportunities à mão: a regra de
// "ganho/perdido é a etapa de mesmo nome" e o recorte de valor já estão aplicados aqui.

import { z } from "zod";
import { reportsSummary } from "../dados";
import { ehInterno, zPeriodo, type Contexto, type Ferramenta } from "../catalog";

const entrada = z.object({
  periodo: zPeriodo,
});

export const FERRAMENTAS_RELATORIOS: Ferramenta[] = [
  {
    nome: "cp_reports_summary",
    titulo: "Resumo de relatórios",
    descricao:
      "Resumo comercial do seu alcance: quantidade total de oportunidades, ganhos, perdidos e em " +
      "aberto; valor prospectado, ganho e perdido (número e em BRL); e a conversão por quantidade e " +
      "por valor. Aceita `periodo` (recorte por data de cadastro; padrão TUDO). É a resposta pronta " +
      "para 'como foi a conversão' e 'quanto prospectamos' sem listar oportunidade por oportunidade.",
    entrada,
    exige: ehInterno,
    escreve: false,
    run: async (args: z.infer<typeof entrada>, { user }: Contexto) => {
      return reportsSummary(user, args.periodo ?? "TUDO");
    },
  },
];
