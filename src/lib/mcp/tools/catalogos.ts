import "server-only";

// Catálogos de apoio: parceiros, produtos e etapas do funil. São o que transforma um NOME
// que a pessoa falou ('a Acme', 'o produto de firewall', 'os que estão em negociação') no id
// que as ferramentas de oportunidade pedem — e o glossário de etapas para ler o pipeline.
//
// `cp_list_partners` respeita escopo (executivo de canal vê só os seus) e NUNCA expõe
// `senhaHash`. Produtos e etapas são catálogos globais: não há dado de parceiro neles.

import { z } from "zod";
import { listPartners, listProducts, listStatus } from "../dados";
import { ehInterno, type Contexto, type Ferramenta } from "../catalog";

const semEntrada = z.object({});

export const FERRAMENTAS_CATALOGOS: Ferramenta[] = [
  {
    nome: "cp_list_partners",
    titulo: "Listar parceiros",
    descricao:
      "Lista os parceiros ATIVOS do seu alcance, com id, nome, CNPJ, site e e-mail. É o jeito de " +
      "achar o id de um parceiro para filtrar oportunidades. Executivo de canal vê só os parceiros " +
      "do seu escopo; admin vê todos. Nunca inclui senha nem hash de senha.",
    entrada: semEntrada,
    exige: ehInterno,
    escreve: false,
    run: async (_args: z.infer<typeof semEntrada>, { user }: Contexto) => {
      const parceiros = await listPartners(user);
      return { parceiros, total: parceiros.length };
    },
  },
  {
    nome: "cp_list_products",
    titulo: "Listar produtos",
    descricao:
      "Lista os produtos ativos do catálogo, na ordem de exibição, com id, nome, categoria e " +
      "descrição. Use para traduzir o nome de um produto no id, ou para saber o que o canal vende.",
    entrada: semEntrada,
    exige: ehInterno,
    escreve: false,
    run: async (_args: z.infer<typeof semEntrada>) => {
      const produtos = await listProducts();
      return { produtos, total: produtos.length };
    },
  },
  {
    nome: "cp_list_status",
    titulo: "Listar etapas do funil",
    descricao:
      "Lista as etapas ativas do funil de vendas, na ordem, com id, nome e cor. É o glossário para " +
      "ler o pipeline e o valor do filtro `status` de cp_list_opportunities. As etapas 'Ganho' e " +
      "'Perdido' são as que cp_reports_summary usa para calcular conversão.",
    entrada: semEntrada,
    exige: ehInterno,
    escreve: false,
    run: async (_args: z.infer<typeof semEntrada>) => {
      const status = await listStatus();
      return { status, total: status.length };
    },
  },
];
